package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// ActivationClaims defines the custom claims for account activation JWTs
type ActivationClaims struct {
	jwt.RegisteredClaims
}

// PasswordResetClaims defines the custom claims for password reset JWTs
type PasswordResetClaims struct {
	TokenID string `json:"token_id"`
	jwt.RegisteredClaims
}

// AccessTokenClaims defines the custom claims for access tokens, including roles and permissions
type AccessTokenClaims struct {
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

// GenerateActivationToken creates a cryptographically signed JWT for new users.
// Claims: sub=user_id, exp=duration, jti=token_id
func GenerateActivationToken(userID uuid.UUID, tokenID uuid.UUID, secret string, duration time.Duration) (string, error) {
	claims := ActivationClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        tokenID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// GenerateAccessToken creates a short-lived JWT for user authentication.
// Claims: sub=user_id, exp=duration, roles=[]string, permissions=[]string
func GenerateAccessToken(userID uuid.UUID, roles []string, permissions []string, secret string, duration time.Duration) (string, error) {
	claims := AccessTokenClaims{
		Roles:       roles,
		Permissions: permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateActivationToken verifies the token's signature and expiry.
func ValidateActivationToken(tokenStr string, secret string) (*ActivationClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &ActivationClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, errors.New("token has expired")
		}
		return nil, errors.New("invalid token signature or format")
	}

	if claims, ok := token.Claims.(*ActivationClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token claims")
}

// ValidateAccessToken verifies an access token's signature and expiry.
func ValidateAccessToken(tokenStr string, secret string) (*AccessTokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &AccessTokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, errors.New("token has expired")
		}
		return nil, errors.New("invalid token signature or format")
	}

	if claims, ok := token.Claims.(*AccessTokenClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token claims")
}

// GeneratePasswordResetToken creates a cryptographically signed JWT for password reset.
// Claims: sub=user_id, exp=duration, token_id=reset_token_id
func GeneratePasswordResetToken(userID uuid.UUID, tokenID uuid.UUID, secret string, duration time.Duration) (string, error) {
	claims := PasswordResetClaims{
		TokenID: tokenID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        tokenID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidatePasswordResetToken verifies a password reset token's signature and expiry.
func ValidatePasswordResetToken(tokenStr string, secret string) (*PasswordResetClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &PasswordResetClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, errors.New("token has expired")
		}
		return nil, errors.New("invalid token signature or format")
	}

	if claims, ok := token.Claims.(*PasswordResetClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token claims")
}
