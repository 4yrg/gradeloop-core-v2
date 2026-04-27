import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getUserInfo, KeycloakTokens } from "@/lib/auth/keycloak";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    console.error("Keycloak auth error:", error, errorDescription);
    return NextResponse.redirect(new URL("/login?error=keycloak_auth_failed", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  try {
    const tokens: KeycloakTokens = await exchangeCode(code);
    const userInfo = await getUserInfo(tokens.access_token);

    const cookieStore = await cookies();

    cookieStore.set("kc_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    });

    cookieStore.set("kc_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.refresh_expires_in,
      path: "/",
    });

    cookieStore.set("kc_id_token", tokens.id_token || "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.refresh_expires_in,
      path: "/",
    });

    cookieStore.set("kc_user_sub", userInfo.sub, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.refresh_expires_in,
      path: "/",
    });

    const redirectUrl = new URL("/admin/dashboard");
    redirectUrl.searchParams.set(" logged_in", "true");
    
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("Keycloak token exchange error:", err);
    return NextResponse.redirect(new URL("/login?error=token_exchange_failed", request.url));
  }
}