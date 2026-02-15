# Gateway Authentication Flow (Kong)

## Overview

This document describes the zero-trust authentication architecture implemented using Kong as the API Gateway (DB-less / declarative mode). The gateway validates requests using JWT verification (preferred via JWKS) or by delegating validation to the IAM service when necessary, then routes requests to downstream services.

## Architecture

### Components

- **Kong Gateway (DB-less)**: Edge proxy running in declarative mode (Kong reads a `kong.yml` manifest)
- **IAM Service**: Authentication and authorization service; ideally exposes a JWKS endpoint (`/.well-known/jwks.json`) or an introspection/validate endpoint
- **Downstream Services**: Protected microservices (auth-service, api-service, etc.)

### Authentication Flow (preferred: JWKS)
1. Client sends request with Authorization: Bearer <JWT>
2. Kong validates the JWT signature and claims using a JWKS (no per-request round-trip to IAM)
3. If valid, Kong allows request and (optionally) injects user/context headers
4. Kong routes request to the downstream service

Authentication Flow (fallback: IAM validation)
1. Client sends request with Authorization: Bearer <JWT>
2. A Kong plugin (serverless pre-function or external auth plugin) forwards token to IAM `/validate` endpoint
3. IAM returns 200 + user context headers or 401/403
4. Kong allows or blocks the request and forwards user headers downstream

## Quickstart (DB-less Kong with declarative config)

- Use `KONG_DATABASE=off` and mount a declarative `kong.yml` into the container via `KONG_DECLARATIVE_CONFIG=/kong/kong.yml`.
- Expose the proxy port (default 8000) to accept HTTP requests.
- Keep the Admin API locked down (do not expose in production).

Example docker-compose snippet (dev/local)
```yaml
version: "3.8"
services:
  kong:
    image: kong:3.0  # choose a compatible Kong version
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /kong/kong.yml
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
    ports:
      - "8000:8000"  # proxy
      - "8443:8443"  # proxy https (optional)
      - "8001:8001"  # admin (lock down in prod)
    volumes:
      - ./infra/kong/kong.yml:/kong/kong.yml:ro
    networks:
      - gateway_network

  auth-service:
    image: my-registry/auth-service:latest
    networks:
      - gateway_network

networks:
  gateway_network:
    driver: bridge
```

## Kong Declarative Configuration (concepts)

- Services: upstream services (e.g., `auth-service`, `api-service`)
- Routes: paths/hosts that map to Services
- Plugins: auth plugins (JWT, oidc, rate-limiting, CORS, etc.)

Example skeleton (details live in `infra/kong/kong.yml`):
- Define `auth-service` and `api-service` as Kong `services` with `routes` for `/api/auth` and `/api` respectively.
- Configure either:
  - A JWT/OIDC plugin that uses `jwks_uri` to validate tokens locally, or
  - A `serverless-functions` pre-function plugin that calls IAM validation endpoint and rejects/accepts requests.

Notes on plugin choices:
- Preferred: Use an OIDC/JWKS-capable plugin (community `kong-oidc` or enterprise OIDC) or Kong's built-in JWT plugin configured with keys from your IAM. This enables signature verification using public keys and avoids per-request calls to IAM.
- Fallback: Use `serverless-functions` (Lua) or an external auth plugin to forward tokens to `http://iam-service:3000/api/v1/auth/validate` and behave like Traefik's ForwardAuth.

## Example: JWKS-based JWT Validation (preferred)

If IAM provides `http://iam-service:3000/.well-known/jwks.json`, configure an OIDC/JWKS plugin:

- The plugin validates `exp`, `iss`, `aud` claims and the signature using public keys from the JWKS.
- No per-request network call to IAM necessary.
- Kong can map claims to headers for downstream services (e.g., `X-User-Id`, `X-User-Roles`).

Example declarative config snippet (conceptual):
```yaml
plugins:
  - name: oidc
    service: api-service
    config:
      issuer: "http://iam-service"
      jwks_uri: "http://iam-service:3000/.well-known/jwks.json"
      bearer_only: true
      client_id: "gradeloop-gateway"
```
(Replace with the exact plugin name and keys supported by the plugin you install.)

## Example: Forward-to-IAM (ForwardAuth-like)

If IAM only exposes a validation endpoint, implement a pre-function Lua plugin or use an external auth plugin:

- Pre-function calls `GET/POST http://iam-service:3000/api/v1/auth/validate` with the incoming `Authorization` header.
- On 200, retrieve user context headers (or response body) and set headers forwarded to upstream (e.g., `X-User-Id`, `X-User-Roles`).
- On 401/403, respond with the same status to the client.

Conceptual serverless pre-function (Lua) does:
- Read `Authorization` header
- Call IAM validate endpoint
- If 200: set headers and continue
- Else: return 401/403

## Service Routing Examples

Protected route (requires JWT/OIDC)
- Route: Path prefix `/api`
- Plugin: OIDC/JWT plugin attached to service/route

Public route (no JWT required)
- Route: Path `/api/public`
- No auth plugin attached (or explicitly disable)

## IAM Service Validation Endpoint (if used)

Endpoint: `GET|POST /api/v1/auth/validate`

Request:
- Headers:
  - `Authorization: Bearer <jwt_token>`

Response codes:
- `200 OK` — valid token. May include user context as headers or JSON.
- `401 Unauthorized` — invalid or expired token
- `403 Forbidden` — insufficient permissions or inactive user

Preferred response (for Kong pre-function):
- Return 200 and include user context in JSON:
```json
{
  "sub": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "roles": ["admin","teacher"],
  "permissions": ["iam:users:read"]
}
```
Pre-function can map these fields to headers forwarded to upstream.

## Request Flow Examples (Kong)

Successful (JWKS)
1. Client -> Kong: Authorization: Bearer <JWT>
2. Kong validates signature and claims via JWKS plugin
3. Kong forwards request to upstream with optional headers:
   - `X-User-Id: <sub>`
   - `X-User-Roles: admin,teacher`
   - `X-User-Permissions: iam:users:read`
4. Upstream receives request and uses headers for authorization

Successful (Forward-to-IAM)
1. Client -> Kong (pre-function forwards token to IAM)
2. IAM -> Kong: 200 + user info
3. Kong sets headers and forwards request

Failed:
- Kong returns 401/403 to client directly.

## Consuming User Context in Services

Downstream services should read standardized headers (configured by Kong mapping) such as:
- `X-User-Id`
- `X-User-Roles`
- `X-User-Permissions`
- `X-User-Email`
Map claim names to headers consistently across the gateway.

Example (Go / Fiber):
```go
func (h *Handler) GetUsers(c fiber.Ctx) error {
    userID := c.Get("X-User-Id")
    roles := strings.Split(c.Get("X-User-Roles"), ",")
    permissions := strings.Split(c.Get("X-User-Permissions"), ",")
    // authorization logic...
}
```

## Security Features & Recommendations

- Prefer JWKS-based validation for performance and reduced IAM load.
- Ensure Admin API is not exposed publicly in production; restrict access with a firewall or bind to localhost.
- Use TLS (HTTPS) for external traffic and for Kong-to-upstream communication where appropriate.
- Protect Kong Admin with authentication and network controls.
- Use Kong rate-limiting and request-size plugins to protect downstream services.

## Troubleshooting

Common checks:
- Verify Kong container logs for plugin errors
- Validate `kong.yml` syntax (Kong CLI has validation tooling)
- If using JWKS: ensure JWKS URL is reachable from the Kong container
- If using forward-to-IAM: ensure IAM validate endpoint responds quickly; add retries/timeouts in Lua pre-function

Health check commands (local dev)
```bash
# Test Kong proxy (example public route)
curl -i http://localhost:8000/api/iam/health

# Test a protected route (with token)
curl -i -H "Authorization: Bearer <token>" http://localhost:8000/api/iam/v1/users
```

## Migration notes (from Traefik)

- Traefik labels and ForwardAuth middleware are replaced by Kong services/routes/plugins.
- Traefik-specific middleware examples (stripPrefix labels, router rules) should be reimplemented as Kong `routes` and optional `request-transformer` plugins.
- Replace Traefik retry and rate limit semantics with Kong's `retry`, `rate-limiting` and circuit-breaker patterns as needed.

## Implementation checklist (suggested)

- [ ] Add `infra/kong/kong.yml` declarative file with services, routes, and plugin config
- [ ] Add `infra/compose/docker-compose.yaml` to run Kong DB-less and example services (auth-service)
- [ ] Choose and install the OIDC/JWKS plugin (community or enterprise) if using JWKS
- [ ] Implement serverless pre-function only if IAM has no JWKS
- [ ] Update dev docs and CI to start Kong for integration tests

## References and links

- Kong declarative configuration: https://docs.konghq.com/gateway/latest/deck/
- Kong plugins: https://docs.konghq.com/hub/
- OIDC / JWKS patterns and best practices (RFC 7517 / OpenID Connect)
