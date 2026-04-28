package middleware

import (
	"log"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/utils"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

func Logger() fiber.Handler {
	return func(c fiber.Ctx) error {
		start := time.Now()

		err := c.Next()

		logger := utils.GetLogger()
		logger.Info("request",
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.Int("status", c.Response().StatusCode()),
			zap.String("ip", c.IP()),
			zap.Duration("latency", time.Since(start)),
		)

		return err
	}
}

func Recovery() fiber.Handler {
	return func(c fiber.Ctx) error {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic recovered: %v", r)

				_ = c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"code":    fiber.StatusInternalServerError,
					"message": "Internal server error",
				})
			}
		}()

		return c.Next()
	}
}
