# Metrics & Observability Reference

This document describes the metrics collection system implemented in GradeLoop, following the **RED (Rate, Errors, Duration)** pattern for service monitoring.

## 1. Metric Definitions

All instrumented services expose the following standard Prometheus metrics at the `/metrics` endpoint.

### Standard RED Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `http_requests_total` | Counter | `service`, `method`, `status_code`, `endpoint` | Total count of HTTP requests processed. |
| `http_request_duration_seconds` | Histogram | `service`, `method`, `status_code`, `endpoint` | Histogram of request latencies. Buckets: 5ms to 10s. |

### Cardinality Control
To prevent memory explosion in Prometheus (high cardinality), the `endpoint` label uses the **Route Pattern** (e.g., `/api/v1/users/:id`) rather than the actual request path (e.g., `/api/v1/users/123`).

## 2. Service Instrumentation (Go/Fiber)

For Go services using the Fiber v3 framework, instrumentation is handled by the shared middleware library.

### Usage
In your service's `server.go` or router setup:

```go
import (
    gl_middleware "github.com/4YRG/gradeloop-core-v2/shared/libs/go/middleware"
)

func Start() {
    app := fiber.New()

    // 1. Register the metrics middleware
    app.Use(gl_middleware.Prometheus("your-service-name"))

    // 2. Expose the /metrics endpoint
    app.Get("/metrics", gl_middleware.PrometheusHandler())
    
    // ... rest of your routes
}
```

## 3. Observability Stack

The observability stack is defined in `infra/compose/compose.dev.yaml` and consists of:

### Prometheus
- **Endpoint**: `http://localhost:9090`
- **Scrape Interval**: 15 seconds.
- **Configuration**: `infra/compose/prometheus/prometheus.yml`.
- **Targets**: Automatically scrapes Traefik and registered microservices.

### Grafana
- **Endpoint**: `http://localhost:3001`
- **Authentication**: Anonymous access is enabled with the `Admin` role for development.
- **Provisioning**: Dashboards and data sources are automatically loaded from `infra/compose/grafana/provisioning`.

## 4. Dashboards

### Service Health Dashboard
A pre-configured dashboard provides an "at-a-glance" view of system health:
- **Request Rate**: Aggregated requests per second per service.
- **Error Ratio**: Percentage of 5xx responses compared to total traffic.
- **Latency (p95)**: The 95th percentile response time, ensuring the tail latency is within limits.

## 5. API Gateway (Traefik) Integration

The API Gateway is configured to emit its own metrics, providing an "Edge" view of the system. This allows monitoring of:
- Entrypoint statistics.
- Service-level breakdown from the gateway's perspective.
- Plugin execution overhead (e.g., JWT validation).

Traefik metrics are available in Prometheus under the `traefik_` namespace.

## 6. Performance & Reliability

- **Overhead**: The Prometheus middleware adds `< 1ms` to the request path as it only involves atomic increments and histogram observations in memory.
- **Scraping**: The `/metrics` endpoint is designed to respond in `< 100ms`.
- **Isolation**: Metrics are stored in a dedicated Docker volume `prometheus-data` to persist across restarts.

## 7. Troubleshooting

### Service not appearing in Prometheus
1. Verify the service is running: `docker ps`.
2. Check if the `/metrics` endpoint is reachable from within the network:
   `docker exec gradeloop-prometheus-dev wget -qO- http://your-service:port/metrics`
3. Ensure the service is added to the `scrape_configs` in `infra/compose/prometheus/prometheus.yml`.

### Dashboard is empty
1. Ensure the `service` variable in the Grafana dashboard is set to "All" or your specific service.
2. Verify that traffic is actually hitting the service (metrics only appear once at least one request is made).
3. Check the Prometheus logs for scrape errors.