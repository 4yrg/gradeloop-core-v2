package tests

import (
	"net/http/httptest"
	"testing"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/4YRG/gradeloop-core-v2/shared/libs/go/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestTraceCorrelation(t *testing.T) {
	// Setup In-Memory Database for testing audit log correlation
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate AuditLog with the new TraceID field
	err = db.AutoMigrate(&models.AuditLog{})
	assert.NoError(t, err)

	auditRepo := repositories.NewAuditRepository(db)

	// Setup Fiber App (IAM Service uses Fiber v3)
	app := fiber.New()

	// Apply the shared Trace Middleware
	app.Use(middleware.FiberTrace("iam-service-test"))

	// Test Route that simulates a business operation resulting in an audit log
	app.Post("/api/test/audit", func(c fiber.Ctx) error {
		auditLog := &models.AuditLog{
			Action:   "test.correlation",
			Entity:   "test_resource",
			EntityID: "test-123",
		}

		// The CreateAuditLog method in the repository automatically extracts TraceID from UserContext
		err := auditRepo.CreateAuditLog(c.UserContext(), auditLog)
		if err != nil {
			return c.Status(500).SendString(err.Error())
		}

		return c.SendStatus(fiber.StatusCreated)
	})

	t.Run("Should correlate logs using provided X-Trace-ID", func(t *testing.T) {
		customTraceID := "gateway-trace-xyz-789"
		req := httptest.NewRequest("POST", "/api/test/audit", nil)
		req.Header.Set("X-Trace-ID", customTraceID)

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

		// 1. Verify Trace ID is returned in response headers
		assert.Equal(t, customTraceID, resp.Header.Get("X-Trace-ID"))

		// 2. Verify Audit Log in DB is correlated with the same Trace ID
		var savedLog models.AuditLog
		err = db.Where("action = ?", "test.correlation").First(&savedLog).Error
		assert.NoError(t, err)
		assert.Equal(t, customTraceID, savedLog.TraceID)
	})

	t.Run("Should generate and correlate internal ID when header is missing", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/test/audit", nil)
		resp, err := app.Test(req)
		assert.NoError(t, err)

		generatedID := resp.Header.Get("X-Trace-ID")
		assert.NotEmpty(t, generatedID)
		assert.Contains(t, generatedID, "iam-service-test-")

		var savedLog models.AuditLog
		err = db.Where("trace_id = ?", generatedID).First(&savedLog).Error
		assert.NoError(t, err)
	})
}
