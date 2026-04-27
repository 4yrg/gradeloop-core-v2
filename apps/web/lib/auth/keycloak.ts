const keycloakBaseURL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8080/auth/realms/gradeloop-lms";
const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "lms-web";
const redirectUri = process.env.NEXT_PUBLIC_KEYCLOAK_REDIRECT_URI || "http://localhost:3000/api/auth/callback";

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
  redirectUri: string;
}

export interface KeycloakTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  id_token?: string;
  scope: string;
}

export interface KeycloakUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  [key: string]: unknown;
}

export function getKeycloakConfig(): KeycloakConfig {
  const realm = keycloakBaseURL.split("/realms/")[1] || "gradeloop-lms";
  
  return {
    url: keycloakBaseURL.replace(`/realms/${realm}`, ""),
    realm,
    clientId,
    redirectUri,
  };
}

export function getLoginURL(): string {
  const config = getKeycloakConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid profile email",
    state: generateState(),
  });
  
  return `${config.url}/auth/realms/${config.realm}/protocol/openid-connect/auth?${params}`;
}

export function getLogoutURL(idTokenHint?: string): string {
  const config = getKeycloakConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    post_logout_redirect_uri: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  });
  
  if (idTokenHint) {
    params.append("id_token_hint", idTokenHint);
  }
  
  return `${config.url}/auth/realms/${config.realm}/protocol/openid-connect/logout?${params}`;
}

export async function exchangeCode(code: string): Promise<KeycloakTokens> {
  const config = getKeycloakConfig();
  
  const response = await fetch(`${config.url}/auth/realms/${config.realm}/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Keycloak token exchange failed: ${error}`);
  }
  
  return response.json();
}

export async function refreshTokens(refreshToken: string): Promise<KeycloakTokens> {
  const config = getKeycloakConfig();
  
  const response = await fetch(`${config.url}/auth/realms/${config.realm}/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Keycloak token refresh failed: ${error}`);
  }
  
  return response.json();
}

export async function getUserInfo(accessToken: string): Promise<KeycloakUserInfo> {
  const config = getKeycloakConfig();
  
  const response = await fetch(`${config.url}/auth/realms/${config.realm}/protocol/openid-connect/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Keycloak userinfo failed: ${error}`);
  }
  
  return response.json();
}

export async function validateToken(token: string): Promise<boolean> {
  const config = getKeycloakConfig();
  
  try {
    const response = await fetch(`${config.url}/auth/realms/${config.realm}/protocol/openid-connect/token/introspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        token,
      }),
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.active === true;
  } catch {
    return false;
  }
}

export function logoutKeycloak(idTokenHint?: string): void {
  const logoutUrl = getLogoutURL(idTokenHint);
  window.location.href = logoutUrl;
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isKeycloakEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_KEYCLOAK_URL;
}