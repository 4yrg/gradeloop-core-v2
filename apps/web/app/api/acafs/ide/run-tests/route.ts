import { NextRequest, NextResponse } from "next/server";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

async function parseUpstream(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

/** POST /api/acafs/ide/run-tests
 * Server-side proxy → ACAFS POST /api/v1/acafs/ide/run-tests
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const upstream = await fetch(`${API_BASE}/acafs/ide/run-tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseUpstream(upstream);
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Proxy error" },
      { status: 502 }
    );
  }
}
