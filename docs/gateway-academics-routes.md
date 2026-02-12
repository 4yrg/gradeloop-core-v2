# API Gateway - Academics Service Routes

This document outlines the secure exposure of Academics Service endpoints via the API Gateway.

## Authentication

All routes require a valid JWT token issued by the IAM service.
- **Header**: `Authorization: Bearer <JWT>`
- **Validation**: The gateway validates signature, issuer, and expiry.

## Authorization

Each route is protected by a specific permission. The gateway maps incoming requests to permissions based on the `routes.yaml` configuration.

| Route Pattern | Method | Required Permission |
|---------------|--------|---------------------|
| `/api/academics/faculties/**` | GET | `academics:faculties:read` |
| `/api/academics/faculties/**` | POST/PATCH/DELETE | `academics:faculties:write` |
| `/api/academics/departments/**` | GET | `academics:departments:read` |
| `/api/academics/departments/**` | POST/PATCH/DELETE | `academics:departments:write` |
| `/api/academics/degrees/**` | GET | `academics:degrees:read` |
| `/api/academics/degrees/**` | POST/PATCH/DELETE | `academics:degrees:write` |
| `/api/academics/batches/**` | GET | `academics:batches:read` |
| `/api/academics/batches/**` | POST/PATCH/DELETE | `academics:batches:write` |
| `/api/academics/courses/**` | GET | `academics:courses:read` |
| `/api/academics/courses/**` | POST/PATCH/DELETE | `academics:courses:write` |

## Error Responses

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 401 | `unauthorized` | Missing, invalid, or expired JWT. |
| 403 | `insufficient_permissions` | JWT lacks the required permission for the route. |
| 404 | `not_found` | Route not registered in the gateway. |

## Logging & Observability

Denied access attempts are logged with:
- `user_id`: Extracted from JWT `sub` claim.
- `requested_route`: Full path and method.
- `required_permission`: The mapped permission for the route.
- `result`: `denied`.

## CI Verification

Route coverage is enforced via `scripts/validate-gateway-routes.go`. This script ensures that any new routes added to the `academics-service` are explicitly registered in the gateway with a permission mapping.
