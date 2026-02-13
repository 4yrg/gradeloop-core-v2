import { NextResponse } from "next/server";

// Use server-side IAM_SERVICE_URL for Docker internal network communication
// Falls back to NEXT_PUBLIC_IAM_SERVICE_URL for local dev, then localhost
const IAM_SERVICE_URL =
  process.env.IAM_SERVICE_URL || 
  process.env.NEXT_PUBLIC_IAM_SERVICE_URL || 
  "http://localhost:8080";
// Don't append /v1 here - it's part of the incoming path
const API_BASE = IAM_SERVICE_URL;

async function proxy(req: Request, path: string) {
  // Remove the "v1/" prefix from the path since API_BASE already includes /v1
  const cleanPath = path.startsWith("v1/") ? path.slice(3) : path;
  const url = `${API_BASE}/${cleanPath}`.replace(/([^:]:)\/\//g, "$1/");
  
  console.log("[PROXY] Incoming path:", path);
  console.log("[PROXY] Clean path:", cleanPath);
  console.log("[PROXY] API_BASE:", API_BASE);
  console.log("[PROXY] Final URL:", url);

  // Build headers for outgoing request
  const outHeaders: Record<string, string> = {};
  for (const [k, v] of req.headers) {
    // Do not forward host header
    if (k.toLowerCase() === "host") continue;
    outHeaders[k] = v;
  }

  // Forward cookies from incoming request (important for HTTPOnly auth cookies)
  const cookie = req.headers.get("cookie");
  if (cookie) outHeaders["cookie"] = cookie;

  const init: RequestInit = {
    method: req.method,
    headers: outHeaders,
    // Forward body if present
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    redirect: "manual",
  };

  console.log("[PROXY] Making request to:", url);
  console.log("[PROXY] Request method:", req.method);
  console.log("[PROXY] Request headers:", Object.keys(outHeaders));
  
  const res = await fetch(url, init);
  
  console.log("[PROXY] Response status:", res.status);
  console.log("[PROXY] Response headers:", [...res.headers.entries()]);

  // Clone response headers but remove hop-by-hop headers
  const headers = new Headers(res.headers);
  headers.delete("transfer-encoding");

  // Return proxied response with same status and body
  const body = await res.arrayBuffer();
  return new NextResponse(Buffer.from(body), {
    status: res.status,
    headers,
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = (resolvedParams.path || []).join("/") || "";
  return proxy(request, path);
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = (resolvedParams.path || []).join("/") || "";
  return proxy(request, path);
}

export async function PUT(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = (resolvedParams.path || []).join("/") || "";
  return proxy(request, path);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = (resolvedParams.path || []).join("/") || "";
  return proxy(request, path);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = (resolvedParams.path || []).join("/") || "";
  return proxy(request, path);
}

export async function OPTIONS() {
  // Let browser know this endpoint supports CORS preflight when proxied
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
