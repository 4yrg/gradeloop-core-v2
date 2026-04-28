package jwt

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token has expired")
	ErrInvalidAlgorithm = errors.New("invalid signing algorithm")
	ErrInvalidKey = errors.New("invalid key for signing method")
)

type Claims struct {
	UserID     uuid.UUID  `json:"user_id"`
	Email      string     `json:"email"`
	UserType   string     `json:"user_type"`
	FullName   string     `json:"full_name"`
	TenantID   *uuid.UUID `json:"tenant_id,omitempty"`
	TenantSlug string     `json:"tenant_slug,omitempty"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

type JWKSProvider interface {
	GetPublicKey(ctx context.Context, kid string) (*rsa.PublicKey, error)
}

type JWKS struct {
	mu    sync.RWMutex
	keys  map[string]*rsa.PublicKey
	jwksURL string
	client *http.Client
	ttl    time.Duration
	lastFetch time.Time
}

func NewJWKS(jwksURL string, ttl time.Duration) *JWKS {
	return &JWKS{
		keys:  make(map[string]*rsa.PublicKey),
		jwksURL: jwksURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		ttl: ttl,
	}
}

func (j *JWKS) GetPublicKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	j.mu.RLock()
	key, exists := j.keys[kid]
	j.mu.RUnlock()

	if exists {
		return key, nil
	}

	if err := j.fetchKeys(ctx); err != nil {
		return nil, err
	}

	j.mu.RLock()
	defer j.mu.RUnlock()
	key, exists = j.keys[kid]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", kid)
	}
	return key, nil
}

func (j *JWKS) fetchKeys(ctx context.Context) error {
	j.mu.Lock()
	defer j.mu.Unlock()

	if time.Since(j.lastFetch) < j.ttl {
		return nil
	}

	req, err := http.NewRequestWithContext(ctx, "GET", j.jwksURL, nil)
	if err != nil {
		return err
	}

	resp, err := j.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch JWKS: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			Use string `json:"use"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}

	if err := json.Unmarshal(body, &jwks); err != nil {
		return err
	}

	j.keys = make(map[string]*rsa.PublicKey)
	for _, key := range jwks.Keys {
		if key.Kty != "RSA" {
			continue
		}

		nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
		if err != nil {
			continue
		}

		eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
		if err != nil {
			continue
		}

		var n, e big.Int
		n.SetBytes(nBytes)
		e.SetBytes(eBytes)

		pubKey := &rsa.PublicKey{
			N: &n,
			E: int(e.Int64()),
		}

		j.keys[key.Kid] = pubKey
	}

	j.lastFetch = time.Now()
	return nil
}

type JWT struct {
	secretKey          []byte
	accessTokenExpiry  time.Duration
	refreshTokenExpiry time.Duration
	useRS256          bool
	jwks             JWKSProvider
}

func NewJWT(secretKey string, accessTokenExpiryMinutes, refreshTokenExpiryDays int64) *JWT {
	return &JWT{
		secretKey:          []byte(secretKey),
		accessTokenExpiry:  time.Duration(accessTokenExpiryMinutes) * time.Minute,
		refreshTokenExpiry: time.Duration(refreshTokenExpiryDays) * 24 * time.Hour,
	}
}

func NewJWTWithKeycloak(secretKey string, accessTokenExpiryMinutes, refreshTokenExpiryDays int64, jwksURL string) *JWT {
	return &JWT{
		secretKey:          []byte(secretKey),
		accessTokenExpiry:  time.Duration(accessTokenExpiryMinutes) * time.Minute,
		refreshTokenExpiry: time.Duration(refreshTokenExpiryDays) * 24 * time.Hour,
		useRS256:          true,
		jwks:             NewJWKS(jwksURL, 24*time.Hour),
	}
}

func GenerateAccessToken(userID uuid.UUID, email, fullName, userType string, secretKey []byte, expiry time.Duration) (string, time.Time, error) {
	return GenerateAccessTokenWithTenant(userID, email, fullName, userType, nil, "", secretKey, expiry)
}

func GenerateAccessTokenWithTenant(userID uuid.UUID, email, fullName, userType string, tenantID *uuid.UUID, tenantSlug string, secretKey []byte, expiry time.Duration) (string, time.Time, error) {
	if len(secretKey) == 0 {
		return "", time.Time{}, errors.New("secret key cannot be empty")
	}

	expiresAt := time.Now().Add(expiry)

	claims := Claims{
		UserID:     userID,
		Email:      email,
		FullName:   fullName,
		UserType:   userType,
		TenantID:   tenantID,
		TenantSlug: tenantSlug,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "iam-service",
			Subject:   userID.String(),
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signedToken, err := token.SignedString(secretKey)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("signing token: %w", err)
	}

	return signedToken, expiresAt, nil
}

func GenerateRefreshToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generating random bytes: %w", err)
	}

	token := base64.URLEncoding.EncodeToString(bytes)
	return token, nil
}

func ValidateHS256Token(tokenString string, secretKey []byte) (*Claims, error) {
	if len(secretKey) == 0 {
		return nil, errors.New("secret key cannot be empty")
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, fmt.Errorf("parsing token: %w", err)
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

func ValidateRS256Token(ctx context.Context, tokenString string, jwks JWKSProvider) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, ErrInvalidAlgorithm
		}

		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, ErrInvalidKey
		}

		return jwks.GetPublicKey(ctx, kid)
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, fmt.Errorf("parsing token: %w", err)
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

func ValidateAccessToken(tokenString string, secretKey []byte) (*Claims, error) {
	return ValidateHS256Token(tokenString, secretKey)
}

func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return base64.URLEncoding.EncodeToString(hash[:])
}

func (j *JWT) GenerateTokenPair(userID uuid.UUID, email, fullName, userType string) (*TokenPair, error) {
	if j.useRS256 {
		return nil, errors.New("RS256 mode requires Keycloak token generation")
	}

	accessToken, expiresAt, err := GenerateAccessToken(
		userID,
		email,
		fullName,
		userType,
		j.secretKey,
		j.accessTokenExpiry,
	)
	if err != nil {
		return nil, fmt.Errorf("generating access token: %w", err)
	}

	refreshToken, err := GenerateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("generating refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (j *JWT) ValidateToken(tokenString string) (*Claims, error) {
	if j.useRS256 {
		return ValidateRS256Token(context.Background(), tokenString, j.jwks)
	}
	return ValidateHS256Token(tokenString, j.secretKey)
}

func (j *JWT) GetRefreshTokenExpiry() time.Time {
	return time.Now().Add(j.refreshTokenExpiry)
}
