package middleware

import (
	"errors"
	"log"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/utils"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

func Logger() fiber.Handler {
	return func(c fiber.Ctx) error {
		start := time.Now()

		err := c.Next()

		status := c.Response().StatusCode()
		if err != nil {
			var fe *fiber.Error
			if errors.As(err, &fe) {
				status = fe.Code
			} else if status == fiber.StatusOK {
				// Error handler may set 500 after handler returned; avoid misleading 200 in logs.
				status = fiber.StatusInternalServerError
			}
		}

		logger := utils.GetLogger()
		logFields := []zap.Field{
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.Int("status", status),
			zap.String("ip", c.IP()),
			zap.Duration("latency", time.Since(start)),
		}
		if err != nil {
			logFields = append(logFields, zap.Error(err))
		}
		logger.Info("request", logFields...)

		return err
	}
}

func Recovery() fiber.Handler {
	return func(c fiber.Ctx) error {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic recovered: %v", r)

				_ = c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"code":    fiber.StatusInternalServerError,
					"message": "Internal server error",
				})
			}
		}()

		return c.Next()
	}
}
