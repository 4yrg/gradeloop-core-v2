package middleware

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/adaptor"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// requestCount tracks the total number of requests labeled by service, method, status code, and path.
	requestCount = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests.",
		},
		[]string{"service", "method", "status_code", "endpoint"},
	)

	// requestDuration tracks the request latency in seconds.
	requestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Histogram of HTTP request durations.",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"service", "method", "status_code", "endpoint"},
	)
)

// Prometheus returns a Fiber v3 middleware that records RED metrics.
func Prometheus(serviceName string) fiber.Handler {
	return func(c fiber.Ctx) error {
		// Skip metrics endpoint to avoid self-scraping noise
		if c.Path() == "/metrics" || c.Path() == "/api/metrics" {
			return c.Next()
		}

		start := time.Now()

		// Process request
		err := c.Next()

		// Calculate duration
		elapsed := time.Since(start).Seconds()

		// Extract labels
		status := getStatusCode(c, err)
		method := c.Method()
		// Using c.Route().Path instead of c.Path() to prevent cardinality explosion from IDs/Slugs
		path := "unknown"
		if route := c.Route(); route != nil {
			path = route.Path
		}

		// Update metrics
		labels := prometheus.Labels{
			"service":     serviceName,
			"method":      method,
			"status_code": status,
			"endpoint":    path,
		}

		requestCount.With(labels).Inc()
		requestDuration.With(labels).Observe(elapsed)

		return err
	}
}

// PrometheusHandler returns a Fiber v3 handler for the /metrics endpoint.
func PrometheusHandler() fiber.Handler {
	return adaptor.HTTPHandler(promhttp.Handler())
}

// getStatusCode returns the status code as a string, handling errors from the handler chain.
func getStatusCode(c fiber.Ctx, err error) string {
	if err != nil {
		if e, ok := err.(*fiber.Error); ok {
			return strconv.Itoa(e.Code)
		}
		return "500"
	}

	code := c.Response().StatusCode()
	if code == 0 {
		return "200"
	}
	return strconv.Itoa(code)
}
