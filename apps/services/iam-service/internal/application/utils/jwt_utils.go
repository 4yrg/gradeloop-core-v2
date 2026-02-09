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
