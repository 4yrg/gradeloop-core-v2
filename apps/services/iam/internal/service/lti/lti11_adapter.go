package lti

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// LTI role constants (mirrored from domain for adapter use)
const (
	LTI1p1RoleAdministrator = "http://purl.imsglobal.org/vocab/lti/v1/role#Administrator"
	LTI1p1RoleInstructor    = "http://purl.imsglobal.org/vocab/lti/v1/role#Instructor"
	LTI1p1RoleTA            = "http://purl.imsglobal.org/vocab/lti/v1/role#TA"
	LTI1p1RoleLearner       = "http://purl.imsglobal.org/vocab/lti/v1/role#Learner"
)

var (
	ErrInvalidLTI11Signature = errors.New("invalid LTI 1.1 signature")
	ErrInvalidLTI11Consumer  = errors.New("invalid LTI 1.1 consumer")
)

// LTI1p1Adapter adapts LTI 1.1 launches to LTI 1.3 format
type LTI1p1Adapter struct {
	cfg      *config.LTIConfig
	consumer map[string]string // consumer_key -> oauth_secret
}

// NewLTI1p1Adapter creates a new LTI 1.1 adapter
func NewLTI1p1Adapter(cfg *config.LTIConfig) *LTI1p1Adapter {
	// Default consumers for mock mode
	consumers := map[string]string{
		"dev-consumer": "dev-secret",
	}

	// Add configured consumer
	if cfg.LTI11Secret != "" {
		consumers[cfg.ClientID] = cfg.LTI11Secret
	}

	return &LTI1p1Adapter{
		cfg:      cfg,
		consumer: consumers,
	}
}

// LTI1p1Form represents LTI 1.1 POST data
type LTI1p1Form struct {
	// Required LTI 1.1 parameters
	OAuthConsumerKey string `form:"oauth_consumer_key"`
	OAuthSignature   string `form:"oauth_signature"`
	OAuthTimestamp   string `form:"oauth_timestamp"`
	OAuthNonce       string `form:"oauth_nonce"`
	ResourceLinkID   string `form:"resource_link_id"`
	UserID           string `form:"user_id"`

	// LTI parameters
	ContextID    string `form:"context_id"`
	ContextTitle string `form:"context_title"`
	ContextLabel string `form:"context_label"`
	Roles        string `form:"roles"`
	RoleScope    string `form:"lis_person_sourcedid"`
	UserEmail    string `form:"lis_person_contact_email_primary"`
	UserName     string `form:"lis_person_name_full"`
	GivenName    string `form:"lis_person_name_given"`
	FamilyName   string `form:"lis_person_name_family"`

	// Deployment
	ToolConsumerInfoProductFamily string `form:"tool_consumer_info_product_family_code"`
	ToolConsumerInfoVersion       string `form:"tool_consumer_info_version"`

	// Custom
	Custom map[string]string
}

// ParseForm parses LTI 1.1 form data
func (a *LTI1p1Adapter) ParseForm(values map[string][]string) (*LTI1p1Form, error) {
	form := &LTI1p1Form{
		Custom: make(map[string]string),
	}

	// Required
	getString := func(key string) string {
		if v, ok := values[key]; ok && len(v) > 0 {
			return v[0]
		}
		return ""
	}

	form.OAuthConsumerKey = getString("oauth_consumer_key")
	form.OAuthSignature = getString("oauth_signature")
	form.OAuthTimestamp = getString("oauth_timestamp")
	form.OAuthNonce = getString("oauth_nonce")
	form.ResourceLinkID = getString("resource_link_id")
	form.UserID = getString("user_id")

	// LTI params
	form.ContextID = getString("context_id")
	form.ContextTitle = getString("context_title")
	form.ContextLabel = getString("context_label")
	form.Roles = getString("roles")
	form.RoleScope = getString("lis_person_sourcedid")
	form.UserEmail = getString("lis_person_contact_email_primary")
	form.UserName = getString("lis_person_name_full")
	form.GivenName = getString("lis_person_name_given")
	form.FamilyName = getString("lis_person_name_family")

	form.ToolConsumerInfoProductFamily = getString("tool_consumer_info_product_family_code")
	form.ToolConsumerInfoVersion = getString("tool_consumer_info_version")

	// Custom parameters
	for k, v := range values {
		if strings.HasPrefix(k, "custom_") {
			form.Custom[strings.TrimPrefix(k, "custom_")] = v[0]
		}
	}

	// Validate required fields
	if form.OAuthConsumerKey == "" || form.OAuthSignature == "" {
		return nil, fmt.Errorf("%w: missing required OAuth parameters", ErrInvalidLTI11Signature)
	}

	return form, nil
}

// ValidateSignature validates LTI 1.1 OAuth signature
func (a *LTI1p1Adapter) ValidateSignature(form *LTI1p1Form, formData string, method string) error {
	oauthSecret, ok := a.consumer[form.OAuthConsumerKey]
	if !ok {
		return ErrInvalidLTI11Consumer
	}

	// Parse timestamp
	ts, err := time.Parse("2006-01-02 15:04:05", form.OAuthTimestamp)
	if err != nil {
		return fmt.Errorf("invalid timestamp: %v", err)
	}

	// Check timestamp not too old (5 min)
	if time.Since(ts) > 5*time.Minute {
		return fmt.Errorf("timestamp too old")
	}

	// Build signature base string
	sigBase := a.buildSignatureBase(form, formData, method)

	// Compute HMAC-SHA1
	key := oauthSecret + "&"
	mac := hmac.New(sha1.New, []byte(key))
	mac.Write([]byte(sigBase))
	signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	if signature != form.OAuthSignature {
		return ErrInvalidLTI11Signature
	}

	return nil
}

// buildSignatureBase builds OAuth signature base string
func (a *LTI1p1Adapter) buildSignatureBase(form *LTI1p1Form, formData string, method string) string {
	// Build parameter list
	params := []string{
		"oauth_consumer_key=" + form.OAuthConsumerKey,
		"oauth_signature_method=HMAC-SHA1",
		"oauth_timestamp=" + form.OAuthTimestamp,
		"oauth_nonce=" + form.OAuthNonce,
		"oauth_version=1.0",
		"resource_link_id=" + form.ResourceLinkID,
		"user_id=" + form.UserID,
	}

	if form.ContextID != "" {
		params = append(params, "context_id="+form.ContextID)
	}
	if form.Roles != "" {
		params = append(params, "roles="+form.Roles)
	}

	// Sort and concatenate
	sort.Strings(params)
	base := method + "&" + url.QueryEscape(a.cfg.RedirectURI) + "&"
	base += url.QueryEscape(strings.Join(params, "&"))

	return base
}

// ToClaims converts LTI 1.1 form to LTI 1.3 claims
func (a *LTI1p1Adapter) ToClaims(ctx context.Context, form *LTI1p1Form, deploymentID string) (*LTIClaims, error) {
	// Determine user ID
	externalUserID := form.UserID
	if form.RoleScope != "" {
		externalUserID = form.RoleScope
	}

	// Determine email
	email := form.UserEmail
	if email == "" {
		email = fmt.Sprintf("%s@lti-1.1.local", externalUserID)
	}

	// Determine name
	name := form.UserName
	if name == "" {
		if form.GivenName != "" || form.FamilyName != "" {
			name = strings.TrimSpace(form.GivenName + " " + form.FamilyName)
		} else {
			name = email
		}
	}

	// Map role
	role := a.mapRole(form.Roles)

	now := time.Now()

	claims := &LTIClaims{
		// Standard JWT
		Iss:   a.cfg.PlatformURL,
		Sub:   externalUserID,
		Aud:   a.cfg.ClientID,
		Exp:   now.Add(5 * time.Minute).Unix(),
		Iat:   now.Unix(),
		Nonce: form.OAuthNonce,
		Jti:   uuid.New().String(),

		// LTI
		DeploymentID:  deploymentID,
		TargetLinkURI: a.cfg.RedirectURI,

		// Context
		Context: &ContextClaim{
			ID:    form.ContextID,
			Title: form.ContextTitle,
			Label: form.ContextLabel,
			Type:  []string{"http://purl.imsglobal.org/vocab/lti/v1/context#CourseOffering"},
		},

		// Role
		Roles: []string{role},

		// Resource Link
		ResourceLink: &ResourceLink{
			ID: form.ResourceLinkID,
		},

		// User
		GivenName:  form.GivenName,
		FamilyName: form.FamilyName,
		Name:       name,
		Email:      email,

		// Custom
		Custom: form.Custom,

		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	return claims, nil
}

// mapRole maps LTI 1.1 role to LTI 1.3 role URI
func (a *LTI1p1Adapter) mapRole(role string) string {
	switch strings.ToLower(role) {
	case "administrator":
		return LTI1p1RoleAdministrator
	case "instructor", "mentor":
		return LTI1p1RoleInstructor
	case "ta":
		return LTI1p1RoleTA
	case "learner", "student":
		return LTI1p1RoleLearner
	default:
		return LTI1p1RoleLearner
	}
}

// ToUser converts form to domain user
func (a *LTI1p1Adapter) ToUser(form *LTI1p1Form) *domain.User {
	email := form.UserEmail
	if email == "" {
		email = fmt.Sprintf("%s@lti-1.1.local", form.UserID)
	}

	name := form.UserName
	if name == "" {
		if form.GivenName != "" || form.FamilyName != "" {
			name = strings.TrimSpace(form.GivenName + " " + form.FamilyName)
		} else {
			name = email
		}
	}

	return &domain.User{
		ID:       uuid.Nil,
		Email:    email,
		FullName: name,
		UserType: MapLTIRoleToIAM(a.mapRole(form.Roles)),
	}
}
