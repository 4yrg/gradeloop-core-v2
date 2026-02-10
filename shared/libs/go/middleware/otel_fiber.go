package middleware

import (
	"github.com/gofiber/fiber/v3"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	"go.opentelemetry.io/otel/trace"
)

// OtelFiber is a middleware for Fiber that adds OpenTelemetry tracing to requests.
func OtelFiber(serviceName string) fiber.Handler {
	return func(c fiber.Ctx) error {
		// Extract trace context from request headers
		ctx := otel.GetTextMapPropagator().Extract(c.Context(), propagation.HeaderCarrier(c.GetReqHeaders()))

		// Create a new span
		tracer := otel.Tracer(serviceName)
		spanName := string(c.Request().URI().Path())
		opts := []trace.SpanStartOption{
			trace.WithAttributes(semconv.HTTPMethodKey.String(c.Method())),
			trace.WithAttributes(semconv.HTTPTargetKey.String(spanName)),
			trace.WithAttributes(semconv.HTTPURLKey.String(c.OriginalURL())),
			trace.WithSpanKind(trace.SpanKindServer),
		}

		ctx, span := tracer.Start(ctx, spanName, opts...)
		defer span.End()

		// Pass the context with the span to the next handler
		c.SetUserContext(ctx)

		// Process request
		err := c.Next()

		// Set span status based on response
		if err != nil {
			span.RecordError(err)
			span.SetStatus(trace.StatusCodeError, err.Error())
		} else {
			status := c.Response().StatusCode()
			span.SetAttributes(semconv.HTTPStatusCodeKey.Int(status))
			if status >= 500 {
				span.SetStatus(trace.StatusCodeError, "server error")
			}
		}

		return err
	}
}
