# Observability Setup Guide

> **Monitoring, Logging, and Tracing for GradeLoop V2**

---

## Table of Contents

- [Overview](#overview)
- [The Three Pillars](#the-three-pillars)
- [Observability Stack](#observability-stack)
- [Metrics (Prometheus)](#metrics-prometheus)
- [Logging (Loki)](#logging-loki)
- [Tracing (Jaeger)](#tracing-jaeger)
- [Visualization (Grafana)](#visualization-grafana)
- [Alerting](#alerting)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

GradeLoop V2 implements comprehensive observability to ensure system health, performance monitoring, and rapid debugging. Our observability stack enables:

- **Real-time monitoring** of service health and performance
- **Distributed tracing** across microservices
- **Centralized logging** with structured log aggregation
- **Proactive alerting** for critical issues
- **Performance profiling** and optimization

---

## The Three Pillars

### 1. Metrics (What is happening?)
- System resource usage (CPU, memory, disk)
- Application-level metrics (request rate, latency, error rate)
- Business metrics (assignments created, submissions graded)

### 2. Logs (Why is it happening?)
- Structured event logs from all services
- Error traces and stack traces
- Request/response payloads (sanitized)

### 3. Traces (Where is it happening?)
- End-to-end request flow across services
- Performance bottleneck identification
- Service dependency mapping

---

## Observability Stack

| Component | Technology | Purpose | Port |
|-----------|-----------|---------|------|
| **Metrics** | Prometheus | Time-series metrics storage | 9090 |
| **Logging** | Loki | Log aggregation | 3100 |
| **Tracing** | Jaeger | Distributed tracing | 16686 |
| **Visualization** | Grafana | Dashboards & alerts | 3000 |
| **Exporters** | Node Exporter, cAdvisor | System metrics | 9100, 8080 |

---

## Metrics (Prometheus)

### Starting Prometheus

```bash
# Start observability stack
docker compose -f ops/docker-compose.observability.yml up -d

# Access Prometheus UI
open http://localhost:9090
```

### Instrumenting Go Services

**Install Dependencies:**
```bash
go get github.com/prometheus/client_golang/prometheus
go get github.com/prometheus/client_golang/prometheus/promhttp
```

**Define Metrics:**
```go
// apps/services/assignment-service/internal/metrics/metrics.go
package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    // Counter: Total requests
    RequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "assignment_service_requests_total",
            Help: "Total number of requests processed",
        },
        []string{"method", "endpoint", "status"},
    )

    // Histogram: Request duration
    RequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "assignment_service_request_duration_seconds",
            Help:    "Request duration in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "endpoint"},
    )

    // Gauge: Active connections
    ActiveConnections = promauto.NewGauge(
        prometheus.GaugeOpts{
            Name: "assignment_service_active_connections",
            Help: "Number of active database connections",
        },
    )

    // Counter: Business metrics
    AssignmentsCreated = promauto.NewCounter(
        prometheus.CounterOpts{
            Name: "assignments_created_total",
            Help: "Total number of assignments created",
        },
    )
)
```

**Expose Metrics Endpoint:**
```go
// apps/services/assignment-service/cmd/server/main.go
package main

import (
    "net/http"
    
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
    // ... other setup

    // Expose metrics endpoint
    http.Handle("/metrics", promhttp.Handler())
    go http.ListenAndServe(":9091", nil)

    // ... start gRPC server
}
```

**Record Metrics:**
```go
// apps/services/assignment-service/internal/handlers/grpc/server.go
func (s *Server) CreateAssignment(ctx context.Context, req *assignmentsv1.CreateAssignmentRequest) (*assignmentsv1.CreateAssignmentResponse, error) {
    start := time.Now()
    
    // Business logic
    assignment, err := s.repo.CreateAssignment(ctx, req)
    
    // Record metrics
    duration := time.Since(start).Seconds()
    status := "success"
    if err != nil {
        status = "error"
    }
    
    metrics.RequestsTotal.WithLabelValues("CreateAssignment", "/api/v1/assignments", status).Inc()
    metrics.RequestDuration.WithLabelValues("CreateAssignment", "/api/v1/assignments").Observe(duration)
    
    if err == nil {
        metrics.AssignmentsCreated.Inc()
    }
    
    return assignment, err
}
```

### Instrumenting Python Services

**Install Dependencies:**
```bash
pip install prometheus-client
```

**Define Metrics:**
```python
# apps/services/cipas-service/src/metrics/metrics.py
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Counter: Total requests
requests_total = Counter(
    'cipas_service_requests_total',
    'Total number of requests processed',
    ['method', 'endpoint', 'status']
)

# Histogram: Request duration
request_duration = Histogram(
    'cipas_service_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint']
)

# Gauge: Active analysis jobs
active_jobs = Gauge(
    'cipas_service_active_jobs',
    'Number of active plagiarism analysis jobs'
)

# Counter: Business metrics
plagiarism_checks = Counter(
    'plagiarism_checks_total',
    'Total number of plagiarism checks performed'
)
```

**Expose Metrics:**
```python
# apps/services/cipas-service/src/main.py
from prometheus_client import start_http_server
from metrics.metrics import requests_total, request_duration

# Start Prometheus metrics server on port 9092
start_http_server(9092)

# Your application logic
```

**Record Metrics:**
```python
import time
from metrics.metrics import requests_total, request_duration, plagiarism_checks

def analyze_plagiarism(submission_id: int):
    start_time = time.time()
    
    try:
        # Analysis logic
        result = perform_analysis(submission_id)
        
        # Record success
        requests_total.labels(
            method='analyze',
            endpoint='/analyze',
            status='success'
        ).inc()
        
        plagiarism_checks.inc()
        
        return result
        
    except Exception as e:
        # Record error
        requests_total.labels(
            method='analyze',
            endpoint='/analyze',
            status='error'
        ).inc()
        raise
        
    finally:
        # Record duration
        duration = time.time() - start_time
        request_duration.labels(
            method='analyze',
            endpoint='/analyze'
        ).observe(duration)
```

### Prometheus Configuration

```yaml
# ops/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Gateway
  - job_name: 'gateway'
    static_configs:
      - targets: ['gateway:9090']

  # Go Services
  - job_name: 'academics-service'
    static_configs:
      - targets: ['academics-service:9091']

  - job_name: 'assignment-service'
    static_configs:
      - targets: ['assignment-service:9091']

  # Python Services
  - job_name: 'cipas-service'
    static_configs:
      - targets: ['cipas-service:9092']

  - job_name: 'ivas-service'
    static_configs:
      - targets: ['ivas-service:9092']

  # System Metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### Common Prometheus Queries

```promql
# Request rate (requests per second)
rate(assignment_service_requests_total[5m])

# Error rate
rate(assignment_service_requests_total{status="error"}[5m]) / rate(assignment_service_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(assignment_service_request_duration_seconds_bucket[5m]))

# CPU usage
100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100
```

---

## Logging (Loki)

### Structured Logging in Go

**Install Dependencies:**
```bash
go get log/slog
```

**Configure Logger:**
```go
// shared/libs/go/logger/logger.go
package logger

import (
    "log/slog"
    "os"
)

func New(serviceName string) *slog.Logger {
    handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    })
    
    logger := slog.New(handler)
    
    // Add service name to all logs
    return logger.With("service", serviceName)
}
```

**Usage:**
```go
// apps/services/assignment-service/cmd/server/main.go
package main

import "github.com/gradeloop/gradeloop-core-v2/shared/libs/go/logger"

func main() {
    log := logger.New("assignment-service")
    
    log.Info("starting service",
        "port", 8082,
        "environment", "development",
    )
    
    // In request handlers
    log.Info("processing request",
        "request_id", requestID,
        "user_id", userID,
        "method", "CreateAssignment",
    )
    
    // Errors
    log.Error("database error",
        "error", err.Error(),
        "query", "INSERT INTO assignments",
    )
}
```

### Structured Logging in Python

**Install Dependencies:**
```bash
pip install structlog
```

**Configure Logger:**
```python
# shared/libs/py/logger/logger.py
import structlog

def configure_logger(service_name: str):
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    return structlog.get_logger(service=service_name)
```

**Usage:**
```python
# apps/services/cipas-service/src/main.py
from shared.libs.py.logger import configure_logger

logger = configure_logger("cipas-service")

logger.info("starting service", port=8085, environment="development")

# In handlers
logger.info(
    "analyzing submission",
    submission_id=submission_id,
    user_id=user_id,
    request_id=request_id
)

# Errors
logger.error(
    "analysis failed",
    submission_id=submission_id,
    error=str(e),
    exc_info=True
)
```

### Loki Configuration

```yaml
# ops/loki/loki-config.yml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb:
    directory: /loki/index
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
```

### Promtail Configuration (Log Shipping)

```yaml
# ops/promtail/promtail-config.yml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'
```

---

## Tracing (Jaeger)

### OpenTelemetry Setup (Go)

**Install Dependencies:**
```bash
go get go.opentelemetry.io/otel
go get go.opentelemetry.io/otel/exporters/jaeger
go get go.opentelemetry.io/otel/sdk/trace
```

**Initialize Tracer:**
```go
// shared/libs/go/tracing/tracer.go
package tracing

import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/jaeger"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
)

func InitTracer(serviceName, jaegerURL string) (*sdktrace.TracerProvider, error) {
    exporter, err := jaeger.New(
        jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(jaegerURL)),
    )
    if err != nil {
        return nil, err
    }

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(serviceName),
        )),
    )

    otel.SetTracerProvider(tp)
    return tp, nil
}
```

**Instrument Code:**
```go
// apps/services/assignment-service/internal/handlers/grpc/server.go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("assignment-service")

func (s *Server) CreateAssignment(ctx context.Context, req *assignmentsv1.CreateAssignmentRequest) (*assignmentsv1.CreateAssignmentResponse, error) {
    // Start span
    ctx, span := tracer.Start(ctx, "CreateAssignment")
    defer span.End()
    
    // Add attributes
    span.SetAttributes(
        attribute.String("course_id", req.CourseId),
        attribute.String("title", req.Title),
    )
    
    // Create assignment
    assignment, err := s.repo.CreateAssignment(ctx, req)
    if err != nil {
        span.RecordError(err)
        return nil, err
    }
    
    span.SetAttributes(attribute.Int64("assignment_id", assignment.Id))
    
    return assignment, nil
}
```

### OpenTelemetry Setup (Python)

**Install Dependencies:**
```bash
pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-jaeger
```

**Initialize Tracer:**
```python
# shared/libs/py/tracing/tracer.py
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

def init_tracer(service_name: str, jaeger_host: str, jaeger_port: int):
    trace.set_tracer_provider(
        TracerProvider(
            resource=Resource.create({SERVICE_NAME: service_name})
        )
    )
    
    jaeger_exporter = JaegerExporter(
        agent_host_name=jaeger_host,
        agent_port=jaeger_port,
    )
    
    trace.get_tracer_provider().add_span_processor(
        BatchSpanProcessor(jaeger_exporter)
    )
    
    return trace.get_tracer(service_name)
```

**Instrument Code:**
```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def analyze_plagiarism(submission_id: int):
    with tracer.start_as_current_span("analyze_plagiarism") as span:
        span.set_attribute("submission_id", submission_id)
        
        # Fetch submission
        with tracer.start_as_current_span("fetch_submission"):
            submission = get_submission(submission_id)
        
        # Run analysis
        with tracer.start_as_current_span("run_analysis"):
            result = perform_analysis(submission)
        
        span.set_attribute("similarity_score", result.score)
        
        return result
```

---

## Visualization (Grafana)

### Access Grafana

```bash
# Start Grafana
docker compose -f ops/docker-compose.observability.yml up grafana

# Access UI
open http://localhost:3000

# Default credentials
# Username: admin
# Password: admin
```

### Add Data Sources

1. **Prometheus:**
   - Configuration → Data Sources → Add data source
   - Select Prometheus
   - URL: `http://prometheus:9090`
   - Save & Test

2. **Loki:**
   - Configuration → Data Sources → Add data source
   - Select Loki
   - URL: `http://loki:3100`
   - Save & Test

3. **Jaeger:**
   - Configuration → Data Sources → Add data source
   - Select Jaeger
   - URL: `http://jaeger:16686`
   - Save & Test

### Import Dashboards

Pre-built dashboards are in `ops/grafana/dashboards/`:

```bash
# Import dashboard via UI
# Dashboards → Import → Upload JSON file
ops/grafana/dashboards/service-overview.json
ops/grafana/dashboards/system-metrics.json
ops/grafana/dashboards/business-metrics.json
```

### Create Custom Dashboard

**Example: Assignment Service Dashboard**

```json
{
  "dashboard": {
    "title": "Assignment Service",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(assignment_service_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(assignment_service_requests_total{status=\"error\"}[5m])"
          }
        ]
      },
      {
        "title": "P95 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(assignment_service_request_duration_seconds_bucket[5m]))"
          }
        ]
      }
    ]
  }
}
```

---

## Alerting

### Prometheus Alerting Rules

```yaml
# ops/prometheus/alerts.yml
groups:
  - name: service_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(assignment_service_requests_total{status="error"}[5m]) / 
          rate(assignment_service_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate in assignment service"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, rate(assignment_service_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency in assignment service"
          description: "P95 latency is {{ $value }}s"

      # Service down
      - alert: ServiceDown
        expr: up{job="assignment-service"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Assignment service is down"
          description: "Service has been down for more than 1 minute"

  - name: system_alerts
    interval: 30s
    rules:
      # High CPU usage
      - alert: HighCPUUsage
        expr: |
          100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}%"

      # High memory usage
      - alert: HighMemoryUsage
        expr: |
          (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / 
          node_memory_MemTotal_bytes * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}%"
```

### Alertmanager Configuration

```yaml
# ops/alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'

route:
  group_by: ['alertname', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack'
  
  routes:
    - match:
        severity: critical
      receiver: 'slack-critical'
      
    - match:
        severity: warning
      receiver: 'slack-warning'

receivers:
  - name: 'slack'
    slack_configs:
      - channel: '#gradeloop-alerts'
        title: 'GradeLoop Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'slack-critical'
    slack_configs:
      - channel: '#gradeloop-critical'
        title: '🚨 CRITICAL: GradeLoop Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'slack-warning'
    slack_configs:
      - channel: '#gradeloop-alerts'
        title: '⚠️ WARNING: GradeLoop Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

## Best Practices

### 1. **Use Consistent Labels**
```go
// Good
metrics.RequestsTotal.WithLabelValues("CreateAssignment", "/api/v1/assignments", "success")

// Bad (inconsistent)
metrics.RequestsTotal.WithLabelValues("create_assignment", "/assignments", "ok")
```

### 2. **Log Contextual Information**
```go
log.Info("processing request",
    "request_id", requestID,
    "user_id", userID,
    "operation", "CreateAssignment",
    "duration_ms", duration.Milliseconds(),
)
```

### 3. **Trace Cross-Service Calls**
Always propagate trace context across services

### 4. **Set Appropriate Retention**
- Metrics: 15 days
- Logs: 7 days (or based on compliance)
- Traces: 3 days (sampling for production)

### 5. **Use Sampling for High-Volume Traces**
```go
sampler := sdktrace.ParentBased(sdktrace.TraceIDRatioBased(0.1)) // 10% sampling
```

### 6. **Sanitize Sensitive Data**
Never log passwords, API keys, or PII

### 7. **Create Runbooks for Alerts**
Every alert should have a corresponding runbook

---

## Troubleshooting

### Metrics Not Showing Up

```bash
# Check if service is exposing metrics
curl http://localhost:9091/metrics

# Check Prometheus targets
open http://localhost:9090/targets

# Check Prometheus logs
docker logs prometheus
```

### Logs Not Appearing in Loki

```bash
# Check Promtail logs
docker logs promtail

# Check Loki API
curl http://localhost:3100/ready

# Verify log format (must be JSON for structured logging)
docker logs assignment-service | head -1
```

### Traces Not Showing in Jaeger

```bash
# Check Jaeger collector
curl http://localhost:14269/

# Verify trace exporter configuration
# Ensure JAEGER_ENDPOINT is set correctly

# Check for sampling issues (increase sampling rate for testing)
```

---

## Related Documentation

- [Local Development Guide](local-dev-guide.md)
- [Service Communication Patterns](service-communication.md)
- [Deployment Guide](deployment.md)

---

**Questions?** Reach out in `#gradeloop-observability` Slack channel.