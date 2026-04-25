# Keycloak SSO Federation Guide

## Overview

This guide explains how to configure enterprise SSO federation in Gradeloop LMS using Keycloak as the broker.

## Supported Identity Providers

| Provider | Protocol | Setup Complexity | Common Use Case |
|----------|----------|------------------|-----------------|
| Google Workspace | OIDC | Low | Consumer apps |
| Microsoft Entra ID | OIDC | Medium | Enterprise/Azure |
| SAML 2.0 | SAML | High | University IdPs |
| OpenID Connect | OIDC | Medium | General IdPs |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Gradeloop  │────▶│  Keycloak  │
│   (LMS)     │     │     IAM    │     │   (IdP)    │
└─────────────┘     └─────────────┘     └─────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │  Enterprise IdP  │
                                         │ (Google/MS/SAML) │
                                         └─────────────────┘
```

## Step 1: Configure Keycloak

### 1.1 Access Keycloak Admin Console

```bash
# Local development
http://127.0.0.1:8080/admin

# Production
https://auth.gradeloop.space/admin
```

### 1.2 Select Realm

Select `gradeloop-lms` realm.

### 1.3 Add Identity Provider

Navigate to **Identity Providers** → **Add provider** → Select provider type.

## Step 2: Google Workspace Setup

### 2.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Create **OAuth 2.0 Client ID**
5. Configure authorized redirect URIs:

```
https://auth.gradeloop.space/realms/gradeloop-lms/broker/google/endpoint
```

### 2.2 Keycloak Configuration

1. In Keycloak Admin Console:
   - **Identity Providers** → **Add provider** → **Google**
2. Configure:
   - **Client ID**: Google OAuth2 Client ID
   - **Client Secret**: Google OAuth2 Client Secret
3. Save

### 2.3 Add Mappers

Create **Mapper** for tenant resolution:

1. **Claim**: `hd` (hosted domain)
2. **Token Claim Name**: `tenant_id`
3. **Sync Mode**: `import`

## Step 3: Microsoft Entra ID Setup

### 3.1 Create Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Microsoft Entra ID** → **App registrations**
3. Create new registration
4. Configure redirect URIs:

```
https://auth.gradeloop.space/realms/gradeloop-lms/broker/microsoft/endpoint
```

5. Generate client secret

### 3.2 Keycloak Configuration

1. In Keycloak Admin Console:
   - **Identity Providers** → **Add provider** → **Microsoft**
2. Configure:
   - **Client ID**: Azure App ID
   - **Client Secret**: Azure Client Secret
3. Save

### 3.3 Add API Permissions

In Azure Portal, add `User.Read` permission.

## Step 4: SAML 2.0 Setup

### 4.1 Obtain IdP Metadata

Obtain SAML metadata XML from university IdP:

- **Metadata URL**: `https://idp.university.edu/metadata`
- **Entity ID**: `https://idp.university.edu`
- **SSO URL**: `https://idp.university.edu/login`

### 4.2 Keycloak Configuration

1. In Keycloak Admin Console:
   - **Identity Providers** → **Add provider** → **SAML**
2. Configure:
   - **Single Sign-On Service URL**: From IdP
   - **NameID Policy Format**: `urn:oasis:names:tc:SAML:1.1:nameid-format:email`
   - **Want AuthnRequests Signed**: Enable
   - **Sign Documents**: Enable

### 4.3 Import IdP Metadata

Use **Import** button to load metadata from URL or file.

## Step 5: User Attribute Mappings

### 5.1 Common Mappings

| Keycloak Attribute | SAML/OIDC Claim | LMS Field |
|--------------------|-----------------|-----------|
| email | email, mail | email |
| firstName | given_name, firstName | firstName |
| lastName | family_name, lastName | lastName |
| tenant_id | tenant_id, organization | tenantID |

### 5.2 Create Custom Mapper

1. Select Identity Provider → **Mappers** → **Create**
2. Configure:
   - **Name**: Tenant Mapper
   - **Mapper Type**: Attribute Importer
   - **Claim**: `tenant_id`
   - **User Attribute**: `tenantId`

## Step 6: JIT Provisioning Configuration

### 6.1 Enable JIT

In Keycloak identity provider settings:

1. **First Login Flow**: Select `first broker login` flow
2. **Post Login Flow**: Select JIT provisioning flow
3. Enable **Sync Mode**: `import`

### 6.2 Default Roles

Configure default roles for new SSO users:

1. Go to **Roles** → **Default Roles**
2. Add default role (e.g., `student`)

## Step 7: Test SSO Flow

### 7.1 Local Testing

```bash
# List available providers
curl http://localhost:8080/api/v1/auth/sso/

# Mock SSO login (local only)
curl "http://localhost:8080/api/v1/auth/sso/mock/callback?email=student@dev.local"
```

### 7.2 Real SSO Testing

1. Access: `http://localhost:8080/api/v1/auth/sso/google`
2. Should redirect to Google login
3. After login, redirected to callback
4. User provisioned via JIT

## Step 8: Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| 400 Bad Request | Check redirect URI match |
| 401 Unauthorized | Verify client secret |
| User not created | Enable JIT in identity provider |
| Wrong tenant | Check tenant mapper configuration |
| Role not assigned | Configure default role in Keycloak |

### Enable Debug Logging

In Keycloak, enable **Debug** in identity provider settings.

## Environment Variables

### Local Development

```bash
# SSO Configuration
SSO_MODE=disabled  # or "mock" or "real"
SSO_ALLOW_LOCAL=true
SSO_DEFAULT_ROLE=student
SSO_JIT_ENABLED=true
```

### Production

```bash
# SSO Configuration
SSO_MODE=real
SSO_ALLOW_LOCAL=false
SSO_DEFAULT_ROLE=student
SSO_JIT_ENABLED=true

# Google Workspace
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Microsoft Entra ID
MICROSOFT_CLIENT_ID=your-azure-client-id
MICROSOFT_CLIENT_SECRET=your-azure-client-secret
```

## Security Considerations

1. **Always validate redirect URIs**
2. **Use secure state parameter** (CSRF protection)
3. **Enable signature validation** for SAML
4. **Restrict allowed domains** for email
5. **Configure session max lifetime**

## Related Documentation

- [Keycloak Configuration](./KEYCLOAK_CONFIG.md)
- [Multi-tenancy Guide](./MULTITENANCY.md)
- [RBAC Configuration](./RBAC.md)