# 🔐 Keycloak IAM Configuration Guide

> Gradeloop LMS Phase 1 - Identity Provider Setup

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Realm Configuration](#2-realm-configuration)
3. [Token Settings](#3-token-settings)
4. [Client Configuration](#4-client-configuration)
5. [Roles & Scopes](#5-roles--scopes)
6. [Identity Providers](#6-identity-providers)
7. [MFA Setup](#7-mfa-setup)
8. [Go Backend Integration](#8-go-backend-integration)
9. [Testing](#9-testing)

---

## 1. Quick Start

### 1.1 Start Keycloak (Dev Mode - No DB)

```bash
# Start Keycloak (uses embedded H2 database)
podman run -d \
  --name gradeloop-keycloak \
  -p 127.0.0.1:8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -e KC_HOSTNAME=127.0.0.1 \
  quay.io/keycloak/keycloak:23.0 start-dev

# Wait for Keycloak to be ready (~30s)
sleep 30

# Verify
curl -s http://127.0.0.1:8080/realms/master

# Access Admin Console
# URL: http://127.0.0.1:8080/admin
# Username: admin
# Password: admin
```

> **Note:** Use `127.0.0.1` instead of `localhost` due to IPv6 resolution issues in some environments.

### 1.2 Start Keycloak (With PostgreSQL)

> For production, use with external PostgreSQL database.

```bash
# Option 1: Add to compose (requires database setup)
podman compose -f infra/compose/compose.yaml up -d keycloak

# Option 2: Standalone with external DB
podman run -d \
  --name gradeloop-keycloak \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -e KC_DB=postgres \
  -e KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak \
  -e KC_DB_USERNAME=postgres \
  -e KC_DB_PASSWORD=postgres \
  quay.io/keycloak/keycloak:24.0 start
```

### 1.2 Access Endpoints

| Service | URL |
|---------|-----|
| Admin Console | http://127.0.0.1:8080/admin |
| Account Console | http://127.0.0.1:8080/realms/gradeloop-lms/account |
| OpenID Config | http://127.0.0.1:8080/realms/gradeloop-lms/.well-known/openid-configuration |
| JWKS | http://127.0.0.1:8080/realms/gradeloop-lms/protocol/openid-connect/certs |

---

## 2. Realm Configuration

### 2.1 Create Realm

1. Login to Admin Console → http://localhost:8080/admin
2. Click **Create realm** (top-left dropdown)
3. Configure:

| Field | Value |
|-------|-------|
| Name | `gradeloop-lms` |
| Enabled | ✅ ON |
| Display Name | `Gradeloop LMS` |
| HTML Display Name | `<strong>Gradeloop LMS</strong>` |

### 2.2 Realm Settings

Navigate: **Realm settings** → **General**

| Setting | Value |
|--------|-------|
| Enabled | ON |
| Registration Allowed | OFF |
| Login with Email | ON |
| Duplicate Emails | OFF |
| Forgot Password | ON |
| Edit Username | OFF |
| Brute Force Detection | ON |

---

## 3. Token Settings

Navigate: **Realm settings** → **Tokens**

### 3.1 Token Configuration

| Setting | Value |
|--------|-------|
| Access Token Lifespan | **10 Minutes** |
| Access Code Lifespan | **1 Minute** |
| Refresh Token Lifespan | **30 Minutes** |
| ID Token Lifespan | **5 Minutes** |
| cookie SSO Lifetime | **1 Hour** |

### 3.2 Key Configuration (CRITICAL)

| Setting | Value |
|--------|-------|
| JWT Signature Algorithm | **RS256** (NOT HS256!) |
| Client Signature Algorithm | RS256 |

### 3.3 Offline Session Settings

| Setting | Value |
|--------|-------|
| Offline Session Max Enabled | ON |
| Offline Session Max Lifespan | **30 Days** |
| Offline Client Session Max Lifespan | **30 Days** |
| Client Offline Session Idle Timeout | **30 Minutes** |

---

## 4. Client Configuration

Navigate: **Clients** → **Create**

### 4.1 Client: `lms-web` (Public - Frontend)

| Setting | Value |
|---------|-------|
| Client ID | `lms-web` |
| Name | LMS Web |
| Enabled | ON |
| Client Protocol | openid-connect |
| Access Type | **public** |

**Settings Tab:**

| Setting | Value |
|---------|-------|
| Standard Flow Enabled | ON |
| Implicit Flow Enabled | OFF |
| Direct Access Grants | OFF |
| Service Accounts | OFF |

**Login Settings Tab:**

| Setting | Value |
|---------|-------|
| Root URL | `http://localhost:3000` |
| Valid Redirect URIs | `http://localhost:3000/*` |
| Web Origins | `http://localhost:3000` |

**Advanced Settings:**

| Setting | Value |
|---------|-------|
| Proof Key | **ES256** (PKCE) |

**Default Client Scopes:**
- `openid`
- `profile`
- `email`
- `lms-tenant`
- `lms-roles`

---

### 4.2 Client: `lms-api` (Confidential - Backend)

| Setting | Value |
|---------|-------|
| Client ID | `lms-api` |
| Name | LMS API |
| Enabled | ON |
| Client Protocol | openid-connect |
| Access Type | **confidential** |

**Credentials Tab:**

| Setting | Value |
|---------|-------|
| Client Authenticator | **Client secret** |
| Secret | Generate or set: `your-secure-secret-here` |

**Settings Tab:**

| Setting | Value |
|---------|-------|
| Standard Flow Enabled | OFF |
| Direct Access Grants | ON |
| Service Accounts | **ON** |

**Default Client Scopes:**
- `openid`
- `profile`
- `email`
- `lms-tenant`
- `lms-roles`
- `offline_access`

---

### 4.3 Client: `admin-console` (Public - Admin UI)

| Setting | Value |
|---------|-------|
| Client ID | `admin-console` |
| Name | Admin Console |
| Enabled | ON |
| Client Protocol | openid-connect |
| Access Type | **public** |

**Settings Tab:**

| Setting | Value |
|---------|-------|
| Standard Flow Enabled | ON |

**Login Settings:**

| Setting | Value |
|---------|-------|
| Valid Redirect URIs | `http://localhost:3001/*` |
| Web Origins | `http://localhost:3001` |

---

### 4.4 Client: `lti-tool` (Confidential - LTI)

| Setting | Value |
|---------|-------|
| Client ID | `lti-tool` |
| Name | LTI Tool |
| Enabled | ON |
| Client Protocol | openid-connect |
| Access Type | **confidential** |

**Credentials:**

| Setting | Value |
|---------|-------|
| Client Authenticator | **JWT** |
| JWT Artifact | Generate keys |

**Settings:**

| Setting | Value |
|---------|-------|
| Standard Flow Enabled | OFF |
| Direct Access Grants | OFF |
| Service Accounts | OFF |

**Advanced:**

| Setting | Value |
|---------|-------|
| Initiate Login URI | `http://localhost:8081/lti/login` |
| Redirect URIs | `http://localhost:8081/lti/launch` |

---

## 5. Roles & Scopes

### 5.1 Create Realm Roles

Navigate: **Realm roles** → **Create**

| Role Name | Description |
|----------|-------------|
| `student` | LMS Student |
| `instructor` | LMS Instructor |
| `admin` | Tenant Admin |
| `super_admin` | Platform Super Admin |

### 5.2 Create Client Scopes

Navigate: **Client scopes** → **Create**

#### Scope: `lms-tenant`

| Setting | Value |
|---------|-------|
| Name | `lms-tenant` |
| Display Name | LMS Tenant |
| Protocol | openid-connect |

**Mappers:**

| Mapper Type | Name | Claim |
|------------|------|-------|
| Token Claim Name | tenant_id | `tenant_id` |
| Add to ID Token | ON |
| Add to access token | ON |
| Add to userinfo | ON |

#### Scope: `lms-roles`

| Setting | Value |
|---------|-------|
| Name | `lms-roles` |
| Display Name | LMS Roles |
| Protocol | openid-connect |

**Mappers:**

| Mapper Type | Name | Claim |
|------------|------|-------|
| Hardcoded Claim | roles | `{"claim": "roles", "value": ["student"], "jsonType": "array", "addToIdToken": true}` |

**Protocol Mapper Details:**
- Mapper Type: **Hardcoded claim**
- Name: `lms-roles`
- Claim Name: `https://gradeloop.edu/claims/roles`
- Claim Value: JSON array of roles
- Add to: ID token ✅, Access token ✅

---

## 6. Identity Providers

Navigate: **User federation** → **Identity providers**

### 6.1 Google Workspace

| Setting | Value |
|---------|-------|
| Alias | `google-workspace` |
| Display Name | Google Workspace |
| Enabled | ON |

**Config:**

| Setting | Value from Google Cloud Console |
|---------|-------|
| Client ID | Google OAuth2 Client ID |
| Client Secret | Google OAuth2 Client Secret |
| Default Scopes | `openid profile email` |

**Store:**
- Store for token response
- Configure store for user info

### 6.2 Microsoft Entra ID

| Setting | Value |
|---------|-------|
| Alias | `azure-ad` |
| Display Name | Microsoft Entra ID |
| Enabled | ON |

**Config:**

| Setting | Value from Azure Portal |
|---------|-------|
| Client ID | Azure App Registration Client ID |
| Client Secret | Azure Client Secret |
| Tenant ID | `common` (for multi-tenant) |

---

## 7. MFA Setup

Navigate: **Authentication** → **Policies**

### 7.1 Create Authentication Flow

| Setting | Value |
|---------|-------|
| Alias | `lms-mfa-flow` |
| Description | LMS Multi-Factor Authentication Flow |
| Top Level | ON |
| Type | form-flow |

### 7.2 Configure Requirements

Navigate: **Authentication** → **Required actions**

| Action | Default Provider | Required |
|--------|-----------------|----------|
| Configure OTP | OTP | For: `admin`, `super_admin` |
| Update Password | - | OFF |
| Verify Email | - | OFF |

### 7.3 OTP Settings

| Setting | Value |
|---------|-------|
| TOTP Algorithm | SHA1 |
| Digits | 6 |
| Period | 30 seconds |

---

## 8. Go Backend Integration

### 8.1 Environment Variables

Add to `.env.development`:

```bash
# Keycloak
KEYCLOAK_AUTH_URL=http://localhost:8080
KEYCLOAK_REALM=gradeloop-lms
KEYCLOAK_CLIENT_ID_LMS_API=lms-api
KEYCLOAK_CLIENT_SECRET=your-client-secret-here
KEYCLOAK_JWKS_URL=http://localhost:8080/realms/gradeloop-lms/protocol/openid-connect/certs
```

### 8.2 Middleware Usage

```go
import (
    "github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/middleware"
)

// Initialize JWKS key store
jwks := middleware.NewJWKSKeyStore(
    "http://localhost:8080/realms/gradeloop-lms/protocol/openid-connect/certs",
    middleware.WithJWKSKeyTTL(24 * time.Hour),
    // middleware.WithJWKSRedis(redisClient), // Optional Redis caching
)

// Apply middleware
app.Use("/api/", middleware.KeycloakAuthMiddleware(jwks))

// Require specific role
app.Get("/admin/*", middleware.KeycloakAuthMiddleware(jwks), middleware.KeycloakRequireRole("admin", "super_admin"))

// Require tenant
app.Get("/api/*", middleware.KeycloakAuthMiddleware(jwks), middleware.KeycloakRequireTenant("university.edu"))
```

### 8.3 Extract Claims in Handlers

```go
func GetProfile(c fiber.Ctx) error {
    userID, _ := middleware.KeycloakExtractUserID(c)
    tenantID, _ := middleware.KeycloakExtractTenant(c)
    roles := middleware.KeycloakExtractRoles(c)
    perms := middleware.KeycloakExtractPermissions(c)

    return c.JSON(fiber.Map{
        "user_id": userID,
        "tenant_id": tenantID,
        "roles": roles,
        "permissions": perms,
    })
}
```

---

## 9. Testing

### 9.1 Bruno Collection Tests

| Request | Expected |
|---------|----------|
| Login | 200 + access_token |
| Refresh | 200 + new access_token |
| Logout | 204 (no content) |
| Get User Info | 200 + user claims |

### 9.2 Login Request (Bruno)

```bruno
meta {
  name: Login
  type: http
  seq: 1
}

post {
  url: {{KEYCLOAK_AUTH_URL}}/realms/{{KEYCLOAK_REALM}}/protocol/openid-connect/token
  body: json
  auth: inherit
}

body:json {
  {
    "grant_type": "password",
    "client_id": "{{KEYCLOAK_CLIENT_ID_LMS_WEB}}",
    "client_secret": "{{KEYCLOAK_CLIENT_SECRET}}",
    "username": "admin@gradeloop.com",
    "password": "admin"
  }
}
```

### 9.3 Verify Token Claims

A successful login should return:

```json
{
  "access_token": "eyJ...",
  "expires_in": 600,
  "refresh_token": "eyJ...",
  "refresh_expires_in": 1800,
  "token_type": "Bearer",
  "id_token": "eyJ...",
  "session_state": "abc123"
}
```

**Decode `access_token` to verify claims:**

```json
{
  "sub": "user-uuid",
  "iss": "http://localhost:8080/realms/gradeloop-lms",
  "aud": ["lms-api"],
  "tenant_id": "gradeloop.edu",
  "email": "admin@gradeloop.com",
  "https://gradeloop.edu/claims/roles": ["super_admin"],
  "exp": 1700000000,
  "iat": 1699999000
}
```

---

## Quick Reference Checklist

```
☐ Realm created: gradeloop-lms
☐ Token RS256 configured
☐ Client: lms-web (public)
☐ Client: lms-api (confidential)
☐ Client: admin-console (public)
☐ Client: lti-tool (confidential)
☐ Roles: student, instructor, admin, super_admin
☐ Client scope: lms-tenant (tenant_id)
☐ Client scope: lms-roles (role claims)
☐ MFA: TOTP enabled for admins
☐ Brute force protection enabled
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Invalid token | Check JWKS URL matches realm |
| tenant_id missing | Verify client scope mapper |
| 401 Unauthorized | Check JWT signing algorithm (RS256) |
| CORS errors | Add origin to web origins |
| Client secret invalid | Regenerate in Credentials tab |

### Key URLs

| Endpoint | URL |
|----------|-----|
| Realm | `/realms/gradeloop-lms` |
| Token | `/protocol/openid-connect/token` |
| UserInfo | `/protocol/openid-connect/userinfo` |
| JWKS | `/protocol/openid-connect/certs` |
| Logout | `/protocol/openid-connect/logout` |
| Admin | `/admin/realms/gradeloop-lms` |