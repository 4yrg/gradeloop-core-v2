import { NextRequest, NextResponse } from "next/server";
import { getLogoutURL } from "@/lib/auth/keycloak";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  return handleLogout(request);
}

export async function GET(request: NextRequest) {
  return handleLogout(request);
}

async function handleLogout(request: NextRequest) {
  const cookieStore = await cookies();
  
  const idTokenHint = cookieStore.get("kc_id_token")?.value;
  const accessToken = cookieStore.get("kc_access_token")?.value;

  cookieStore.delete("kc_access_token");
  cookieStore.delete("kc_refresh_token");
  cookieStore.delete("kc_id_token");
  cookieStore.delete("kc_user_sub");

  const returnUrl = request.nextUrl.searchParams.get("return_url") || "/login";
  
  if (accessToken) {
    try {
      const logoutUrl = getLogoutURL(idTokenHint);
      return NextResponse.redirect(logoutUrl);
    } catch {
      return NextResponse.redirect(new URL(returnUrl, request.url));
    }
  }
  
  return NextResponse.redirect(new URL(returnUrl, request.url));
}