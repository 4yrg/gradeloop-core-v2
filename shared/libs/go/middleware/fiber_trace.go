package middleware

import (
	"context"

	"github.com/4YRG/gradeloop-core-v2/shared/libs/go/logger"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// FiberTrace middleware extracts or generates a trace ID for request correlation across the GradeLoop ecosystem.
// It prioritizes X-Trace-ID (standard internal header), then X-Request-ID (common gateway header).
//
// The trace ID is injected into:
// 1. The Fiber Context Locals (key: "trace_id") for convenient access within Fiber handlers.
// 2. The standard Go Context (key: logger.TraceIDKey) for the shared logger library.
// 3. The response header (key: "X-Trace-ID") to allow end-to-end visibility.
func FiberTrace(serviceName string) fiber.Handler {
	return func(c fiber.Ctx) error {
		// Attempt to extract trace ID from headers forwarded by the Gateway or upstream services
		traceID := c.Get("X-Trace-ID")
		if traceID == "" {
			traceID = c.Get("X-Request-ID")
		}

		// Fallback for internal or direct service calls if no ID was provided
		if traceID == "" {
			traceID = serviceName + "-" + uuid.New().String()
		}

		// Store in Fiber locals for easy access in handlers via c.Locals("trace_id")
		c.Locals("trace_id", traceID)

		// Enrich the user context for the structured logger.
		// This allows logger.WithContext(ctx, l) to automatically pick up the ID.
		ctx := context.WithValue(c.Context(), logger.TraceIDKey, traceID)
		c.SetContext(ctx)

		// Ensure the trace ID is returned to the caller/gateway for correlation in access logs
		c.Set("X-Trace-ID", traceID)

		return c.Next()
	}
}
