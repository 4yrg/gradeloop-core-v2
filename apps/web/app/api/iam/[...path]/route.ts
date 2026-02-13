import { NextResponse } from "next/server";

const IAM_SERVICE_URL =
  process.env.NEXT_PUBLIC_IAM_SERVICE_URL || "http://localhost:3000";
const API_BASE = `${IAM_SERVICE_URL}/api/v1`;

async function proxy(req: Request, path: string) {
  const url = `${API_BASE}/${path}`.replace(/([^:]:)\/\//g, "$1/");

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

  const res = await fetch(url, init);

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

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  const path = (params.path || []).join("/") || "";
  return proxy(request, path);
}

export async function POST(request: Request, { params }: { params: { path: string[] } }) {
  const path = (params.path || []).join("/") || "";
  return proxy(request, path);
}

export async function PUT(request: Request, { params }: { params: { path: string[] } }) {
  const path = (params.path || []).join("/") || "";
  return proxy(request, path);
}

export async function PATCH(request: Request, { params }: { params: { path: string[] } }) {
  const path = (params.path || []).join("/") || "";
  return proxy(request, path);
}

export async function DELETE(request: Request, { params }: { params: { path: string[] } }) {
  const path = (params.path || []).join("/") || "";
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
