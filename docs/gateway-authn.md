# Gateway Authentication Flow

## Overview

This document describes the zero-trust authentication architecture implemented in Gradeloop's API Gateway using Traefik v3.6.1+ with ForwardAuth middleware. The gateway validates all requests through the IAM service before routing them to downstream services.

## Architecture

### Components

- **Traefik Gateway (v3.6.1+)**: Edge proxy with ForwardAuth middleware
- **IAM Service**: Authentication and authorization service with JWT validation endpoint
- **Downstream Services**: Protected microservices (academics-service, etc.)

### Authentication Flow

```
1. Client Request with JWT
   ↓
2. Traefik Gateway receives request
   ↓
3. ForwardAuth middleware forwards auth headers to IAM Service
   ↓
4. IAM Service validates JWT token
   ↓
5a. Valid: Returns 200 + user context headers
5b. Invalid: Returns 401/403
   ↓
6. Traefik routes request to downstream service with user headers
```

## Configuration

### Traefik ForwardAuth Middleware

The gateway is configured with the following middleware for JWT validation:

```yaml
# JWT Validation via ForwardAuth - Zero Trust Architecture
- "traefik.http.middlewares.jwt-auth.forwardauth.address=http://iam-service:3000/api/v1/auth/validate"
- "traefik.http.middlewares.jwt-auth.forwardauth.trustForwardHeader=true"
- "traefik.http.middlewares.jwt-auth.forwardauth.authResponseHeaders=X-User-Id,X-User-Roles,X-User-Permissions,X-User-Email,X-User-Name"
```

### Service Routing Examples

#### Protected Routes (Requires JWT)
```yaml
- "traefik.http.routers.service-protected.rule=PathPrefix(`/api/service`)"
- "traefik.http.routers.service-protected.middlewares=jwt-auth,service-replacepath"
```

#### Public Routes (No JWT Required)
```yaml
- "traefik.http.routers.service-public.rule=PathPrefix(`/api/service/public`)"
- "traefik.http.routers.service-public.middlewares=service-replacepath"
```

## IAM Service Validation Endpoint

### Endpoint: `GET /api/v1/auth/validate`

This endpoint is called by Traefik's ForwardAuth middleware for every protected request.

#### Request Headers
- `Authorization: Bearer <jwt_token>`

#### Response Codes
- `200 OK`: Valid token, user context headers included
- `401 Unauthorized`: Invalid, expired, or missing token
- `403 Forbidden`: User inactive or insufficient permissions

#### Response Headers (on success)
```
X-User-Id: <user_uuid>
X-User-Roles: admin,teacher,student
X-User-Permissions: iam:users:read,academics:courses:read
X-User-Email: user@example.com
X-User-Name: John Doe
```

## Security Features

### Zero-Trust Architecture
- Every request to protected endpoints is validated
- No trust assumptions between gateway and services
- User context is validated in real-time

### JWT Token Validation
- HMAC-SHA256 signature verification
- Expiration time validation (15-minute access tokens)
- User active status verification
- Role and permission extraction

### Resilience & Retry
- Automatic retry with exponential backoff for IAM service connections
- Health checks prevent routing to unhealthy services
- Graceful degradation during IAM service startup

## Request Flow Examples

### Successful Authentication

```bash
# Client request with valid JWT
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..." \
     http://localhost/api/iam/v1/users

# 1. Traefik forwards auth headers to IAM service
GET /api/v1/auth/validate HTTP/1.1
Host: iam-service:3000
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

# 2. IAM service validates and responds
HTTP/1.1 200 OK
X-User-Id: 123e4567-e89b-12d3-a456-426614174000
X-User-Roles: admin,teacher
X-User-Permissions: iam:users:read,iam:users:create
X-User-Email: admin@gradeloop.io
X-User-Name: Admin User

# 3. Traefik forwards request with user context
GET /api/v1/users HTTP/1.1
Host: iam-service:3000
X-User-Id: 123e4567-e89b-12d3-a456-426614174000
X-User-Roles: admin,teacher
X-User-Permissions: iam:users:read,iam:users:create
X-User-Email: admin@gradeloop.io
X-User-Name: Admin User
```

### Failed Authentication

```bash
# Client request with invalid JWT
curl -H "Authorization: Bearer invalid_token" \
     http://localhost/api/iam/v1/users

# 1. Traefik forwards auth headers to IAM service
GET /api/v1/auth/validate HTTP/1.1
Host: iam-service:3000
Authorization: Bearer invalid_token

# 2. IAM service rejects token
HTTP/1.1 401 Unauthorized
{"error": "invalid or expired token"}

# 3. Traefik returns 401 to client
HTTP/1.1 401 Unauthorized
```

## Service Integration

### Consuming User Context

Downstream services can access authenticated user information through headers:

```go
// Example in Go service
func (h *Handler) GetUsers(c fiber.Ctx) error {
    userID := c.Get("X-User-Id")
    roles := strings.Split(c.Get("X-User-Roles"), ",")
    permissions := strings.Split(c.Get("X-User-Permissions"), ",")
    
    // Use user context for authorization decisions
    if !hasPermission(permissions, "iam:users:read") {
        return c.Status(403).JSON(fiber.Map{"error": "insufficient permissions"})
    }
    
    // Continue with business logic...
}
```

## Public Endpoints

The following endpoints are accessible without JWT tokens:

### IAM Service
- `POST /api/iam/v1/auth/login` - User login
- `POST /api/iam/v1/auth/refresh` - Token refresh
- `POST /api/iam/v1/auth/activate` - Account activation
- `POST /api/iam/v1/auth/request-activation` - Request activation link
- `GET /api/iam/health` - Health check
- `GET /api/iam/metrics` - Prometheus metrics

### Gateway Management
- `GET /api/v1/auth/validate` - Internal validation endpoint (called by Traefik)

## Troubleshooting

### Common Issues

#### "401 Unauthorized" Responses
- Check JWT token format: `Authorization: Bearer <token>`
- Verify token hasn't expired (15-minute lifespan)
- Ensure user account is still active

#### Gateway Startup Failures
- Verify Traefik version is v3.6.1 or newer
- Check Docker socket permissions: `/var/run/docker.sock`
- Ensure IAM service is healthy before gateway starts

#### ForwardAuth Connectivity Issues
- Check IAM service health: `curl http://iam-service:3000/api/iam/health`
- Verify network connectivity between Traefik and IAM service
- Review retry configuration in Traefik labels

### Health Check Commands

```bash
# Check gateway health
curl -f http://localhost:8080/api/rawdata

# Check IAM service health
curl -f http://localhost:8000/api/iam/health

# Test authentication flow
curl -H "Authorization: Bearer $(cat token.jwt)" \
     http://localhost:8000/api/iam/v1/users
```

## Security Considerations

### Token Security
- Access tokens expire after 15 minutes
- Refresh tokens enable long-term sessions
- All tokens use HMAC-SHA256 signatures

### Network Security
- Internal service communication over Docker network
- JWT secrets stored in HashiCorp Vault
- No hardcoded credentials in configuration

### Monitoring & Alerting
- Failed authentication attempts logged
- Prometheus metrics for authentication rates
- Health checks for service availability

## Migration from JWT Plugin

This implementation replaces the deprecated `github.com/Luka-S/traefik-jwt-validator` plugin with native Traefik ForwardAuth middleware, providing:

- **Better Reliability**: No dependency on external plugins
- **Enhanced Security**: Real-time user validation
- **Improved Observability**: Native Traefik metrics and logging
- **Future Compatibility**: Uses stable Traefik features

### Breaking Changes
- JWT validation now happens via HTTP calls to IAM service
- User context headers may have different names
- Retry behavior is now configured at the gateway level