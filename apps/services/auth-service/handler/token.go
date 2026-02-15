package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/auth-service/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/auth-service/database"
	"github.com/4yrg/gradeloop-core-v2/apps/services/auth-service/model"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

// helper: generate cryptographically secure random token (hex)
func generateRandomToken(nBytes int) (string, error) {
	b := make([]byte, nBytes)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// helper: SHA256 hex hash of token (used for lookup/storage)
func hashToken(t string) string {
	h := sha256.Sum256([]byte(t))
	return hex.EncodeToString(h[:])
}

// createAccessToken issues a JWT access token valid for provided duration (minutes)
func createAccessToken(username string, userID uint, minutes int) (string, error) {
	token := jwt.New(jwt.SigningMethodHS256)
	claims := token.Claims.(jwt.MapClaims)
	claims["username"] = username
	claims["user_id"] = userID
	claims["exp"] = time.Now().Add(time.Duration(minutes) * time.Minute).Unix()
	return token.SignedString([]byte(config.Config("SECRET")))
}

// Refresh handler - rotate refresh token and return new access + refresh tokens.
// Accepts refresh token from cookie "refresh_token" or JSON { "refresh_token": "<token>" }.
func Refresh(c fiber.Ctx) error {
	type RefreshInput struct {
		RefreshToken string `json:"refresh_token"`
	}

	var in RefreshInput
	rtFromCookie := c.Cookies("refresh_token", "")

	if rtFromCookie == "" {
		if err := c.Bind().Body(&in); err != nil {
			// allow empty body - will be handled below
		}
	} else {
		in.RefreshToken = rtFromCookie
	}

	if in.RefreshToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "refresh token required", "data": nil})
	}

	db := database.DB
	hashed := hashToken(in.RefreshToken)

	var stored model.RefreshToken
	if err := db.Where(&model.RefreshToken{TokenHash: hashed}).First(&stored).Error; err != nil {
		// Do not leak which case; return unauthorized
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "invalid refresh token", "data": nil})
	}

	if stored.Revoked || stored.IsExpired() {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "refresh token revoked or expired", "data": nil})
	}

	// Load user
	var user model.User
	if err := db.First(&user, stored.UserID).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "internal error", "data": nil})
	}

	// Create new refresh token
	newToken, err := generateRandomToken(32)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't generate token", "data": nil})
	}
	newHash := hashToken(newToken)
	rtTTLdays := 30
	expiresAt := time.Now().Add(time.Duration(rtTTLdays) * 24 * time.Hour)

	newRT := model.RefreshToken{
		TokenHash: newHash,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
		IP:        c.IP(),
		UserAgent: c.Get("User-Agent"),
	}

	// Save new token and revoke old one in a transaction
	tx := db.Begin()
	if tx.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "internal error", "data": nil})
	}

	if err := tx.Create(&newRT).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't save refresh token", "data": nil})
	}

	// mark old token revoked and reference new token hash
	if err := tx.Model(&stored).Updates(map[string]interface{}{
		"revoked":                true,
		"revoked_at":             time.Now(),
		"replaced_by_token_hash": newHash,
	}).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't revoke old token", "data": nil})
	}

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "transaction failed", "data": nil})
	}

	// create access token
	accessTTLMin := 15
	at, err := createAccessToken(user.Username, user.ID, accessTTLMin)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't create access token", "data": nil})
	}

	// Return both tokens. In production you'd set refresh token as httpOnly secure cookie.
	return c.JSON(fiber.Map{"status": "success", "message": "tokens refreshed", "data": fiber.Map{
		"access_token":  at,
		"refresh_token": newToken,
	}})
}

// Logout handler - revoke a refresh token (or all user's tokens if 'all=true' and request JWT authenticated).
// If "refresh_token" provided in cookie or body, revoke that one. If Protected middleware used and query param all=true, revoke all for user.
func Logout(c fiber.Ctx) error {
	type LogoutInput struct {
		RefreshToken string `json:"refresh_token"`
		All          bool   `json:"all"`
	}
	var in LogoutInput
	_ = c.Bind().Body(&in)

	// allow cookie
	if in.RefreshToken == "" {
		in.RefreshToken = c.Cookies("refresh_token", "")
	}

	db := database.DB

	// If JWT protected and user wants to revoke all, try to read from locals
	if in.All {
		// Attempt to get user id from token if present (middleware must set "user")
		if tLocal := c.Locals("user"); tLocal != nil {
			if tok, ok := tLocal.(*jwt.Token); ok {
				claims := tok.Claims.(jwt.MapClaims)
				if uidFloat, ok := claims["user_id"].(float64); ok {
					uid := uint(uidFloat)
					// revoke all active tokens for this user
					if err := db.Model(&model.RefreshToken{}).Where("user_id = ? AND revoked = ?", uid, false).Updates(map[string]interface{}{
						"revoked":    true,
						"revoked_at": time.Now(),
					}).Error; err != nil {
						return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't revoke tokens", "data": nil})
					}
					return c.JSON(fiber.Map{"status": "success", "message": "all refresh tokens revoked", "data": nil})
				}
			}
		}
		// If we didn't get user id, return bad request
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "can't revoke all without valid jwt", "data": nil})
	}

	if in.RefreshToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "refresh token required", "data": nil})
	}

	hashed := hashToken(in.RefreshToken)
	var rt model.RefreshToken
	if err := db.Where(&model.RefreshToken{TokenHash: hashed}).First(&rt).Error; err != nil {
		// Even if not found, return success to avoid token probing
		return c.JSON(fiber.Map{"status": "success", "message": "logged out", "data": nil})
	}

	if rt.Revoked {
		return c.JSON(fiber.Map{"status": "success", "message": "already logged out", "data": nil})
	}

	if err := db.Model(&rt).Updates(map[string]interface{}{
		"revoked":    true,
		"revoked_at": time.Now(),
	}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't revoke token", "data": nil})
	}

	return c.JSON(fiber.Map{"status": "success", "message": "logged out", "data": nil})
}

// ForgotPassword - generate a one-time reset token and store hashed copy (expires in 15 minutes).
// Input: { "email": "user@example.com" }
// NOTE: In production, you should send the token via email. For dev/testing this returns the token in response.
func ForgotPassword(c fiber.Ctx) error {
	type Input struct {
		Email string `json:"email"`
	}
	var in Input
	if err := c.Bind().Body(&in); err != nil || in.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "email required", "data": nil})
	}

	db := database.DB
	var user model.User
	if err := db.Where(&model.User{Email: in.Email}).First(&user).Error; err != nil {
		// Do not reveal whether email exists; respond success.
		return c.JSON(fiber.Map{"status": "success", "message": "if the email exists, a reset link has been sent", "data": nil})
	}

	// create reset token
	rawToken, err := generateRandomToken(24)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't generate token", "data": nil})
	}
	hashed := hashToken(rawToken)
	prTTLMinutes := 15
	pr := model.PasswordReset{
		TokenHash:    hashed,
		UserID:       user.ID,
		ExpiresAt:    time.Now().Add(time.Duration(prTTLMinutes) * time.Minute),
		RequestIP:    c.IP(),
		RequestAgent: c.Get("User-Agent"),
	}

	if err := db.Create(&pr).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't create reset record", "data": nil})
	}

	// TODO: send email with rawToken to user.Email via email provider.
	// For dev, return token in response (remove in prod).
	return c.JSON(fiber.Map{"status": "success", "message": "password reset created", "data": fiber.Map{
		"reset_token": rawToken,
	}})
}

// ResetPassword - accept reset token and new password and rotate user's password.
// Input: { "token": "...", "password": "newpass" }
func ResetPassword(c fiber.Ctx) error {
	type Input struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	var in Input
	if err := c.Bind().Body(&in); err != nil || in.Token == "" || in.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "token and password required", "data": nil})
	}
	if len(in.Password) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "password too short", "data": nil})
	}
	if len(in.Password) > 72 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "password too long", "data": nil})
	}

	db := database.DB
	hashed := hashToken(in.Token)
	var pr model.PasswordReset
	if err := db.Where(&model.PasswordReset{TokenHash: hashed}).First(&pr).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "invalid or expired token", "data": nil})
	}

	if pr.Used || pr.IsExpired() {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "token expired or already used", "data": nil})
	}

	var user model.User
	if err := db.First(&user, pr.UserID).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "user not found", "data": nil})
	}

	// Hash new password
	passHash, err := hashPassword(in.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't hash password", "data": nil})
	}

	// Update password, mark reset used, revoke refresh tokens in a transaction
	tx := db.Begin()
	if tx.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "internal error", "data": nil})
	}

	if err := tx.Model(&user).Update("password", passHash).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't update password", "data": nil})
	}

	// mark password reset used
	now := time.Now()
	if err := tx.Model(&pr).Updates(map[string]interface{}{
		"used":    true,
		"used_at": now,
	}).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't mark reset used", "data": nil})
	}

	// revoke all refresh tokens for user
	if err := tx.Model(&model.RefreshToken{}).Where("user_id = ? AND revoked = ?", user.ID, false).Updates(map[string]interface{}{
		"revoked":    true,
		"revoked_at": now,
	}).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "couldn't revoke sessions", "data": nil})
	}

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "transaction failed", "data": nil})
	}

	return c.JSON(fiber.Map{"status": "success", "message": "password reset successful", "data": nil})
}

// Use package-level helpers (from other files in this package).
// The auth-service already defines `hashPassword` and `CheckPasswordHash` in other files
// (see `user.go` and `auth.go`). Rely on those implementations rather than providing
// duplicate fallback implementations here. This avoids duplicate symbol definitions
// at link time and keeps the token handlers focused on token logic.
