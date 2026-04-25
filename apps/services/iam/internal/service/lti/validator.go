package lti

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidJWT        = errors.New("invalid JWT")
	ErrInvalidNonce     = errors.New("invalid or used nonce")
	ErrInvalidIssuer    = errors.New("invalid issuer")
	ErrInvalidAudience  = errors.New("invalid audience")
	ErrInvalidDeployment = errors.New("invalid deployment_id")
	ErrInvalidSignature = errors.New("invalid JWT signature")
	ErrExpiredToken     = errors.New("token expired")
	ErrMissingClaim     = errors.New("missing required claim")
	ErrInvalidClaim     = errors.New("invalid claim value")
)

// LTI Claims namespaces
const (
	ClaimContext     = "https://purl.imsglobal.org/spec/lti/claim/context"
	ClaimRoles      = "https://purl.imsglobal.org/spec/lti/claim/roles"
	ClaimResourceLink = "https://purl.imsglobal.org/spec/lti/claim/resource_link"
	ClaimLaunchPresentation = "https://purl.imsglobal.org/spec/lti/claim/launch_presentation"
	ClaimAGS       = "https://purl.imsglobal.org/spec/lti-ags/claim/lineitems"
	ClaimNRPS     = "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice"
)

// LTIClaims represents LTI 1.3 launch claims
type LTIClaims struct {
	// Standard JWT claims
	Iss string `json:"iss"`
	Sub string `json:"sub"`
	Aud interface{} `json:"aud"` // Can be string or []string
	Exp int64 `json:"exp"`
	Iat int64 `json:"iat"`
	Nbf int64 `json:"nbf"`
	Jti string `json:"jti"`

	// LTI specific
	Nonce          string          `json:"nonce"`
	DeploymentID   string          `json:"deployment_id"`
	TargetLinkURI  string          `json:"target_link_uri"`
	Context       *ContextClaim   `json:"https://purl.imsglobal.org/spec/lti/claim/context,omitempty"`
	Roles         []string        `json:"https://purl.imsglobal.org/spec/lti/claim/roles,omitempty"`
	ResourceLink  *ResourceLink   `json:"https://purl.imsglobal.org/spec/lti/claim/resource_link,omitempty"`
	LaunchPresentation *LaunchPresentation `json:"https://purl.imsglobal.org/spec/lti/claim/launch_presentation,omitempty"`

	// Name/email
	GivenName  string `json:"given_name,omitempty"`
	FamilyName string `json:"family_name,omitempty"`
	Email     string `json:"email,omitempty"`
	Name      string `json:"name,omitempty"` // Full name

	// Custom parameters
	Custom map[string]string `json:"custom,omitempty"`

	jwt.RegisteredClaims
}

// ContextClaim represents LTI context claim
type ContextClaim struct {
	ID      string `json:"id"`
	Label  string `json:"label,omitempty"`
	Title  string `json:"title,omitempty"`
	Type   []string `json:"type,omitempty"`
}

// ResourceLink represents resource link claim
type ResourceLink struct {
	ID      string `json:"id,omitempty"`
	Title  string `json:"title,omitempty"`
	Url    string `json:"url,omitempty"`
}

// LaunchPresentation represents launch presentation claim
type LaunchPresentation struct {
	ReturnURL string `json:"return_url,omitempty"`
	Locale  string `json:"locale,omitempty"`
}

// Validator validates LTI 1.3 JWTs
type Validator struct {
	cfg          *config.LTIConfig
	toolRepo    repository.LTIToolRepository
	nonceStore  *NonceStore
	jwksProvider interface {
		GetKey(ctx context.Context, kid string) (*rsa.PublicKey, error)
	}
}

// NewValidator creates a new LTI validator
func NewValidator(
	cfg *config.LTIConfig,
	toolRepo repository.LTIToolRepository,
	nonceStore *NonceStore,
) *Validator {
	return &Validator{
		cfg:         cfg,
		toolRepo:   toolRepo,
		nonceStore: nonceStore,
	}
}

// ValidateLaunch validates an LTI launch JWT
func (v *Validator) ValidateLaunch(ctx context.Context, jwtString string) (*LTIClaims, error) {
	// Parse JWT without validation first to get header
	token, parts, err := jwt.NewParser().ParseUnverified(jwtString, &LTIClaims{})
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidJWT, err)
	}

	claims := token.Claims.(*LTIClaims)

	// Mock mode: skip most validations
	if v.cfg.IsMockMode() {
		return claims, v.validateMock(ctx, claims)
	}

	// Strict mode: full validation
	if err := v.validateStandard(claims); err != nil {
		return nil, err
	}

	// Validate nonce
	if err := v.nonceStore.Validate(ctx, claims.Nonce); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidNonce, err)
	}

	// Validate signature
	if err := v.validateSignature(ctx, jwtString, parts); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidSignature, err)
	}

	return claims, nil
}

// validateMock performs relaxed validation for mock mode
func (v *Validator) validateMock(ctx context.Context, claims *LTIClaims) error {
	// In mock mode, just store nonce without strict validation
	return v.nonceStore.Use(ctx, claims.Nonce)
}

// validateStandard performs strict validation
func (v *Validator) validateStandard(claims *LTIClaims) error {
	// Validate issuer
	if !strings.HasPrefix(claims.Iss, v.cfg.PlatformURL) && claims.Iss != v.cfg.Issuer {
		return fmt.Errorf("%w: %s", ErrInvalidIssuer, claims.Iss)
	}

	// Validate audience
	aud, ok := claims.Aud.(string)
	if !ok {
		if audList, ok := claims.Aud.([]interface{}); ok {
			valid := false
			for _, a := range audList {
				if s, ok := a.(string); ok && s == v.cfg.ClientID {
					valid = true
					break
				}
			}
			if !valid {
				return ErrInvalidAudience
			}
		} else {
			return ErrInvalidAudience
		}
	} else if aud != v.cfg.ClientID {
		return ErrInvalidAudience
	}

	// Validate deployment
	if claims.DeploymentID != v.cfg.DeploymentID {
		return ErrInvalidDeployment
	}

	// Validate timestamps
	now := time.Now().Unix()
	if claims.Exp < now {
		return fmt.Errorf("%w", ErrExpiredToken)
	}
	if claims.Iat > now+60 { // Allow 60s clock skew
		return fmt.Errorf("%w", ErrInvalidClaim)
	}

	// Validate nonce present
	if claims.Nonce == "" {
		return fmt.Errorf("%w: missing nonce", ErrMissingClaim)
	}

	return nil
}

// validateSignature validates JWT signature
func (v *Validator) validateSignature(ctx context.Context, jwtString string, parts []string) error {
	// Get key ID from JWT header
	headerB64 := parts[0]
	headerBytes, err := base64.RawURLEncoding.DecodeString(headerB64)
	if err != nil {
		// Try standard base64
		headerBytes, err = base64.URLEncoding.DecodeString(headerB64)
		if err != nil {
			return fmt.Errorf("invalid JWT header: %v", err)
		}
	}

	var header struct {
		Kid string `json:"kid"`
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return fmt.Errorf("invalid JWT header: %v", err)
	}

	// Verify RS256 only
	if header.Alg != "RS256" {
		return fmt.Errorf("%w: algorithm must be RS256, got %s", ErrInvalidSignature, header.Alg)
	}

	// Get public key from JWKS
	pubKey, err := v.jwksProvider.GetKey(ctx, header.Kid)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidSignature, err)
	}

	// Verify signature
	parser := jwt.NewParser()
	token, err := parser.ParseWithClaims(jwtString, &LTIClaims{}, func(token *jwt.Token) (interface{}, error) {
		return pubKey, nil
	})
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidSignature, err)
	}

	if !token.Valid {
		return ErrInvalidSignature
	}

	return nil
}

// ExtractUserClaims extracts user info from LTI claims
func (v *Validator) ExtractUserClaims(claims *LTIClaims) *domain.User {
	email := claims.Email
	if email == "" && claims.Sub != "" {
		email = fmt.Sprintf("%s@lti.local", claims.Sub)
	}

	name := claims.Name
	if name == "" {
		if claims.GivenName != "" || claims.FamilyName != "" {
			name = strings.TrimSpace(claims.GivenName + " " + claims.FamilyName)
		} else {
			name = email
		}
	}

	role := domain.UserTypeStudent
	if len(claims.Roles) > 0 {
		role = MapLTIRoleToIAM(claims.Roles[0])
	}

	return &domain.User{
		ID:       uuid.Nil,
		Email:    email,
		FullName: name,
		UserType: role,
	}
}

// MapLTIRoleToIAM maps LTI role to IAM UserType
func MapLTIRoleToIAM(ltiRole string) string {
	switch {
	case strings.Contains(ltiRole, "#Administrator"):
		return domain.UserTypeSuperAdmin
	case strings.Contains(ltiRole, "#Instructor"),
		strings.Contains(ltiRole, "#ContentDeveloper"),
		strings.Contains(ltiRole, "#Mentor"),
		strings.Contains(ltiRole, "#Teacher"):
		return domain.UserTypeInstructor
	case strings.Contains(ltiRole, "#TA"):
		return "ta"
	default:
		return domain.UserTypeStudent
	}
}

// GetPrimaryRole extracts primary LTI role
func (v *Validator) GetPrimaryRole(claims *LTIClaims) string {
	if len(claims.Roles) == 0 {
		return domain.UserTypeStudent
	}
	return MapLTIRoleToIAM(claims.Roles[0])
}