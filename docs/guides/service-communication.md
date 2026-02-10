# Service Communication Patterns

> **Guidelines for inter-service communication in GradeLoop V2**

---

## Table of Contents

- [Overview](#overview)
- [Communication Protocols](#communication-protocols)
- [Synchronous Communication (gRPC)](#synchronous-communication-grpc)
- [Asynchronous Communication (Message Queue)](#asynchronous-communication-message-queue)
- [REST API Guidelines](#rest-api-guidelines)
- [Error Handling](#error-handling)
- [Authentication & Authorization](#authentication--authorization)
- [Timeouts & Retries](#timeouts--retries)
- [Circuit Breaker Pattern](#circuit-breaker-pattern)
- [Service Discovery](#service-discovery)
- [Best Practices](#best-practices)

---

## Overview

GradeLoop V2 uses a **hybrid communication strategy** that balances performance, reliability, and developer experience:

| Pattern | Use Case | Protocol |
|---------|----------|----------|
| **Client → Gateway** | Frontend to backend | REST/HTTP |
| **Gateway → Services** | Request routing | gRPC |
| **Service → Service** | Synchronous calls | gRPC |
| **Async Events** | Fire-and-forget operations | NATS/RabbitMQ |
| **Real-time Updates** | Notifications, live updates | WebSockets/SSE |

---

## Communication Protocols

### 1. gRPC (Primary)

**Used for:**
- Service-to-service synchronous communication
- Gateway to microservices
- High-performance internal APIs

**Advantages:**
- ✅ Type-safe contracts (Protocol Buffers)
- ✅ Bi-directional streaming
- ✅ Built-in load balancing
- ✅ Better performance than REST

**Example:**
```proto
// shared/protos/academics/v1/academics.proto
syntax = "proto3";

package academics.v1;

service AcademicsService {
  rpc GetCourse(GetCourseRequest) returns (GetCourseResponse);
  rpc ListCourses(ListCoursesRequest) returns (ListCoursesResponse);
  rpc CreateCourse(CreateCourseRequest) returns (CreateCourseResponse);
}

message GetCourseRequest {
  int64 id = 1;
  string user_id = 2;
}

message GetCourseResponse {
  Course course = 1;
}

message Course {
  int64 id = 1;
  string title = 2;
  string code = 3;
  string instructor_id = 4;
  int32 semester_id = 5;
}
```

### 2. REST (External APIs)

**Used for:**
- Frontend to API Gateway
- External integrations
- Webhooks

**Advantages:**
- ✅ Widely understood
- ✅ Easy to debug (cURL, Postman)
- ✅ Browser-friendly

### 3. Message Queue (Async)

**Used for:**
- Background jobs (email sending, report generation)
- Event-driven workflows
- Decoupled services

**Advantages:**
- ✅ Fault tolerance (retry mechanism)
- ✅ Load leveling
- ✅ Temporal decoupling

---

## Synchronous Communication (gRPC)

### Proto Contract Management

All `.proto` files live in `shared/protos/` and follow this structure:

```
shared/protos/
├── academics/v1/
│   └── academics.proto
├── assignments/v1/
│   └── assignments.proto
├── iam/v1/
│   └── iam.proto
└── common/
    ├── errors.proto
    ├── pagination.proto
    └── timestamps.proto
```

### Code Generation

```bash
# Generate Go code
./scripts/generate-protos.sh go

# Generate Python code
./scripts/generate-protos.sh python

# Generate all
./scripts/generate-protos.sh all
```

### Go Client Example

```go
// apps/services/assignment-service/internal/clients/academics.go
package clients

import (
    "context"
    "time"

    academicsv1 "github.com/gradeloop/gradeloop-core-v2/shared/protos/gen/go/academics/v1"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
)

type AcademicsClient struct {
    client academicsv1.AcademicsServiceClient
}

func NewAcademicsClient(addr string) (*AcademicsClient, error) {
    conn, err := grpc.Dial(
        addr,
        grpc.WithTransportCredentials(insecure.NewCredentials()),
        grpc.WithTimeout(5*time.Second),
    )
    if err != nil {
        return nil, err
    }

    return &AcademicsClient{
        client: academicsv1.NewAcademicsServiceClient(conn),
    }, nil
}

func (c *AcademicsClient) GetCourse(ctx context.Context, courseID int64) (*academicsv1.Course, error) {
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()

    resp, err := c.client.GetCourse(ctx, &academicsv1.GetCourseRequest{
        Id: courseID,
    })
    if err != nil {
        return nil, err
    }

    return resp.Course, nil
}
```

### Python Client Example

```python
# apps/services/cipas-service/src/clients/academics_client.py
import grpc
from shared.protos.gen.python.academics.v1 import academics_pb2, academics_pb2_grpc

class AcademicsClient:
    def __init__(self, addr: str):
        self.channel = grpc.insecure_channel(addr)
        self.stub = academics_pb2_grpc.AcademicsServiceStub(self.channel)

    def get_course(self, course_id: int, user_id: str):
        request = academics_pb2.GetCourseRequest(
            id=course_id,
            user_id=user_id
        )
        
        try:
            response = self.stub.GetCourse(
                request,
                timeout=3.0
            )
            return response.course
        except grpc.RpcError as e:
            # Handle gRPC errors
            raise Exception(f"gRPC error: {e.code()}, {e.details()}")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.channel.close()
```

### gRPC Server Example (Go)

```go
// apps/services/academics-service/internal/handlers/grpc/server.go
package grpc

import (
    "context"

    academicsv1 "github.com/gradeloop/gradeloop-core-v2/shared/protos/gen/go/academics/v1"
    "github.com/gradeloop/gradeloop-core-v2/apps/services/academics-service/internal/domain"
)

type Server struct {
    academicsv1.UnimplementedAcademicsServiceServer
    repo domain.Repository
}

func NewServer(repo domain.Repository) *Server {
    return &Server{repo: repo}
}

func (s *Server) GetCourse(ctx context.Context, req *academicsv1.GetCourseRequest) (*academicsv1.GetCourseResponse, error) {
    course, err := s.repo.GetCourse(ctx, req.Id)
    if err != nil {
        return nil, err
    }

    return &academicsv1.GetCourseResponse{
        Course: &academicsv1.Course{
            Id:           course.ID,
            Title:        course.Title,
            Code:         course.Code,
            InstructorId: course.InstructorID,
            SemesterId:   course.SemesterID,
        },
    }, nil
}
```

---

## Asynchronous Communication (Message Queue)

### NATS Configuration

GradeLoop V2 uses **NATS** for asynchronous messaging.

**Connection Configuration:**

```go
// shared/libs/go/messaging/nats.go
package messaging

import (
    "github.com/nats-io/nats.go"
)

func NewNATSConnection(url string) (*nats.Conn, error) {
    nc, err := nats.Connect(
        url,
        nats.MaxReconnects(-1),
        nats.ReconnectWait(2*time.Second),
    )
    return nc, err
}
```

### Event Publishing (Go)

```go
// apps/services/assignment-service/internal/events/publisher.go
package events

import (
    "encoding/json"

    "github.com/nats-io/nats.go"
)

type AssignmentCreatedEvent struct {
    AssignmentID int64  `json:"assignment_id"`
    CourseID     int64  `json:"course_id"`
    Title        string `json:"title"`
    DueDate      string `json:"due_date"`
}

type Publisher struct {
    nc *nats.Conn
}

func NewPublisher(nc *nats.Conn) *Publisher {
    return &Publisher{nc: nc}
}

func (p *Publisher) PublishAssignmentCreated(event AssignmentCreatedEvent) error {
    data, err := json.Marshal(event)
    if err != nil {
        return err
    }

    return p.nc.Publish("assignments.created", data)
}
```

### Event Subscription (Python)

```python
# apps/services/email-notify-service/src/subscribers/assignment_subscriber.py
import asyncio
import json
from nats.aio.client import Client as NATS

class AssignmentSubscriber:
    def __init__(self, nats_url: str):
        self.nc = NATS()
        self.nats_url = nats_url

    async def connect(self):
        await self.nc.connect(self.nats_url)

    async def subscribe_assignment_created(self):
        async def message_handler(msg):
            data = json.loads(msg.data.decode())
            assignment_id = data['assignment_id']
            course_id = data['course_id']
            
            # Send email notification
            await self.send_notification(assignment_id, course_id)

        await self.nc.subscribe("assignments.created", cb=message_handler)

    async def send_notification(self, assignment_id: int, course_id: int):
        # Email notification logic
        pass
```

### Event Naming Convention

```
<domain>.<action>.<resource>

Examples:
- assignments.created
- assignments.updated
- assignments.deleted
- submissions.graded
- users.enrolled
- courses.published
```

---

## REST API Guidelines

### Endpoint Structure

```
/api/v1/<resource>/<id>/<sub-resource>

Examples:
GET    /api/v1/courses
GET    /api/v1/courses/123
POST   /api/v1/courses
PUT    /api/v1/courses/123
DELETE /api/v1/courses/123
GET    /api/v1/courses/123/assignments
POST   /api/v1/assignments/456/submissions
```

### HTTP Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable Entity | Business logic error |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service down |

### Request/Response Format

**Request:**
```json
POST /api/v1/assignments
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Week 5 Assignment",
  "course_id": 123,
  "due_date": "2024-02-15T23:59:59Z",
  "max_points": 100,
  "description": "Complete exercises 1-10"
}
```

**Response (Success):**
```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data": {
    "id": 456,
    "title": "Week 5 Assignment",
    "course_id": 123,
    "due_date": "2024-02-15T23:59:59Z",
    "max_points": 100,
    "description": "Complete exercises 1-10",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Response (Error):**
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "due_date",
        "message": "must be a future date"
      }
    ]
  }
}
```

---

## Error Handling

### gRPC Error Codes

```go
import (
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
)

// Not found
return nil, status.Error(codes.NotFound, "course not found")

// Invalid argument
return nil, status.Error(codes.InvalidArgument, "invalid course ID")

// Permission denied
return nil, status.Error(codes.PermissionDenied, "insufficient permissions")

// Internal error
return nil, status.Error(codes.Internal, "database error")
```

### Custom Error Types

```go
// shared/libs/go/errors/errors.go
package errors

type AppError struct {
    Code    string
    Message string
    Err     error
}

func (e *AppError) Error() string {
    return e.Message
}

func NotFound(resource string) *AppError {
    return &AppError{
        Code:    "NOT_FOUND",
        Message: fmt.Sprintf("%s not found", resource),
    }
}

func ValidationError(msg string) *AppError {
    return &AppError{
        Code:    "VALIDATION_ERROR",
        Message: msg,
    }
}
```

---

## Authentication & Authorization

### JWT Propagation

Every service-to-service call should propagate the user context:

**Go Example:**
```go
// Extract JWT from incoming request
token := extractTokenFromContext(ctx)

// Add to outgoing gRPC metadata
md := metadata.Pairs("authorization", "Bearer "+token)
ctx = metadata.NewOutgoingContext(ctx, md)

// Make gRPC call with context
resp, err := client.GetCourse(ctx, req)
```

**Python Example:**
```python
# Extract token from incoming request
token = extract_token_from_context(context)

# Add to gRPC metadata
metadata = [('authorization', f'Bearer {token}')]

# Make gRPC call
response = stub.GetCourse(request, metadata=metadata)
```

### Service-to-Service Authentication

For backend service calls, use service tokens:

```go
// Gateway adds service identity
md := metadata.Pairs(
    "authorization", "Bearer "+userToken,
    "x-service-name", "assignment-service",
    "x-service-token", serviceToken,
)
```

---

## Timeouts & Retries

### Context Timeouts

**Always set timeouts for external calls:**

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

resp, err := client.GetCourse(ctx, req)
if err != nil {
    if err == context.DeadlineExceeded {
        // Handle timeout
    }
}
```

### Retry Logic

```go
// shared/libs/go/retry/retry.go
package retry

import (
    "context"
    "time"
)

func WithExponentialBackoff(ctx context.Context, maxRetries int, fn func() error) error {
    var err error
    delay := 100 * time.Millisecond

    for i := 0; i < maxRetries; i++ {
        if err = fn(); err == nil {
            return nil
        }

        if i < maxRetries-1 {
            select {
            case <-time.After(delay):
                delay *= 2
            case <-ctx.Done():
                return ctx.Err()
            }
        }
    }

    return err
}
```

---

## Circuit Breaker Pattern

Prevent cascading failures when a service is down:

```go
// shared/libs/go/circuitbreaker/breaker.go
package circuitbreaker

import (
    "github.com/sony/gobreaker"
)

func NewCircuitBreaker(name string) *gobreaker.CircuitBreaker {
    settings := gobreaker.Settings{
        Name:        name,
        MaxRequests: 3,
        Interval:    10 * time.Second,
        Timeout:     30 * time.Second,
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 3 && failureRatio >= 0.6
        },
    }

    return gobreaker.NewCircuitBreaker(settings)
}
```

**Usage:**
```go
cb := circuitbreaker.NewCircuitBreaker("academics-service")

result, err := cb.Execute(func() (interface{}, error) {
    return client.GetCourse(ctx, req)
})
```

---

## Service Discovery

### Environment-based Configuration

```bash
# infra/env/.env.example
ACADEMICS_SERVICE_URL=academics-service:8081
ASSIGNMENT_SERVICE_URL=assignment-service:8082
EMAIL_SERVICE_URL=email-notify-service:8083
```

**Go Client:**
```go
academicsURL := os.Getenv("ACADEMICS_SERVICE_URL")
client, err := NewAcademicsClient(academicsURL)
```

### Kubernetes Service Discovery

```yaml
# Service name resolution via DNS
ACADEMICS_SERVICE_URL=academics-service.default.svc.cluster.local:8081
```

---

## Best Practices

### 1. **Use Protocol Buffers for Shared Types**
- Define all DTOs in `.proto` files
- Version your APIs (`v1`, `v2`)
- Never break backward compatibility

### 2. **Implement Health Checks**
```go
func (s *Server) HealthCheck(ctx context.Context, req *healthv1.HealthCheckRequest) (*healthv1.HealthCheckResponse, error) {
    return &healthv1.HealthCheckResponse{
        Status: healthv1.HealthCheckResponse_SERVING,
    }, nil
}
```

### 3. **Log Request IDs**
```go
requestID := uuid.New().String()
ctx = context.WithValue(ctx, "request_id", requestID)
logger.Info("processing request", "request_id", requestID)
```

### 4. **Use Middleware for Cross-cutting Concerns**
- Authentication
- Logging
- Metrics
- Tracing

### 5. **Avoid Chatty Communication**
- Batch requests when possible
- Use caching for frequently accessed data
- Consider async messaging for non-critical operations

### 6. **Document Your APIs**
- Keep proto files well-commented
- Generate API documentation
- Provide usage examples

---

## Related Documentation

- [Observability Setup](observability.md)
- [Local Development Guide](local-dev-guide.md)
- [Database Migrations](migrations.md)

---

**Questions?** Reach out in `#gradeloop-architecture` Slack channel.