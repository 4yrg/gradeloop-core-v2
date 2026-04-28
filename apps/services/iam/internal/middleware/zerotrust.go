package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/middleware/identity"
	"github.com/gofiber/fiber/v3"
)

// ZeroTrustMiddleware provides Zero Trust request validation
type ZeroTrustMiddleware struct {
	cfg *config.ZeroTrustConfig
}

// NewZeroTrustMiddleware creates Zero Trust middleware
func NewZeroTrustMiddleware(cfg *config.ZeroTrustConfig) *ZeroTrustMiddleware {
	return &ZeroTrustMiddleware{cfg: cfg}
}

// Handle performs Zero Trust validation on request
func (m *ZeroTrustMiddleware) Handle(c fiber.Ctx) error {
	// Relaxed mode - skip validation in local dev
	if m.cfg.IsRelaxedMode() {
		return c.Next()
	}

	// Get identity from context
	idCtx, ok := c.Locals("identity").(*identity.Context)
	if !ok || idCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":  "access_denied",
			"reason": "no_identity",
		})
	}

	// Validate tenant isolation
	if err := m.validateTenant(c, idCtx); err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":  "access_denied",
			"reason": err.Error(),
		})
	}

	return c.Next()
}

func (m *ZeroTrustMiddleware) validateTenant(c fiber.Ctx, idCtx *identity.Context) error {
	// Tenant isolation is always enforced
	resourceTenantID := c.Locals("resource_tenant_id")
	if resourceTenantID != nil {
		if resTenant, ok := resourceTenantID.(string); ok {
			if resTenant != "" && resTenant != idCtx.TenantID {
				return fmt.Errorf("tenant_isolation_violation")
			}
		}
	}

	// Also check from header for additional isolation
	tenantHeader := c.Get("X-Tenant-ID")
	if tenantHeader != "" && tenantHeader != idCtx.TenantID {
		return fmt.Errorf("tenant_isolation_violation")
	}

	return nil
}

// ExtractDeviceContext extracts device information from request
func ExtractDeviceContext(c fiber.Ctx) *domain.DeviceContext {
	ip := c.IP()
	if xff := c.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			ip = strings.TrimSpace(ips[0])
		}
	}

	ua := c.Get("User-Agent")
	acceptLang := c.Get("Accept-Language")

	fingerprint := GenerateDeviceFingerprint(ip, ua, acceptLang)

	return &domain.DeviceContext{
		DeviceID:    fingerprint,
		Fingerprint: fingerprint,
		IPAddress:   ip,
		UserAgent:   ua,
		Platform:    DetectPlatform(ua),
		Browser:     DetectBrowser(ua),
		Trusted:     true, // Will be validated separately
	}
}

// GenerateDeviceFingerprint generates device fingerprint
func GenerateDeviceFingerprint(ip, userAgent, acceptLang string) string {
	data := fmt.Sprintf("%s|%s|%s", ip, userAgent, acceptLang)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])[:32]
}

// DetectPlatform detects OS from User-Agent
func DetectPlatform(ua string) string {
	ua = strings.ToLower(ua)
	switch {
	case strings.Contains(ua, "windows"):
		return "windows"
	case strings.Contains(ua, "macintosh"):
		return "macos"
	case strings.Contains(ua, "linux"):
		return "linux"
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad"):
		return "ios"
	case strings.Contains(ua, "android"):
		return "android"
	default:
		return "unknown"
	}
}

// DetectBrowser detects browser from User-Agent
func DetectBrowser(ua string) string {
	ua = strings.ToLower(ua)
	switch {
	case strings.Contains(ua, "chrome"):
		return "chrome"
	case strings.Contains(ua, "firefox"):
		return "firefox"
	case strings.Contains(ua, "safari"):
		return "safari"
	case strings.Contains(ua, "edge"):
		return "edge"
	default:
		return "unknown"
	}
}

// ExtractRealIP extracts real IP considering proxies
func ExtractRealIP(c fiber.Ctx) string {
	if xff := c.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	if xri := c.Get("X-Real-IP"); xri != "" {
		return xri
	}

	return c.IP()
}

// ValidateSessionTTL checks if session is within valid time
func ValidateSessionTTL(issuedAt time.Time, maxAge time.Duration) bool {
	return time.Since(issuedAt) < maxAge
}
