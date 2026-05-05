import { NextRequest, NextResponse } from "next/server";
import { JAVA_DEMO_SEED_STUDENTS } from "@/lib/demo/java-clone-seeds";

const JAVA_LANGUAGE_ID = 62;

function apiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  return u.replace(/\/$/, "");
}

function extractResetToken(link: string): string | null {
  try {
    const url = new URL(link, "http://local.invalid");
    const t = url.searchParams.get("token");
    if (t) return t;
  } catch {
    /* fall through */
  }
  const m = link.match(/[?&]token=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function decodeJwtUserId(accessToken: string): string | null {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    const id = json.user_id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

type SeedResult = { email: string; status: "ok" | "error"; detail?: string };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await ctx.params;
  const instructorAuth = req.headers.get("authorization");
  if (!instructorAuth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Authorization bearer token" }, { status: 401 });
  }

  const base = apiBase();
  const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL;
  const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD;
  const studentPassword = process.env.DEMO_SEED_STUDENT_PASSWORD;

  if (!demoAdminEmail || !demoAdminPassword) {
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: set DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD in apps/web/.env.local",
      },
      { status: 500 },
    );
  }
  if (!studentPassword || studentPassword.length < 8) {
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: set DEMO_SEED_STUDENT_PASSWORD (8+ chars, upper, lower, digit, symbol) in apps/web/.env.local",
      },
      { status: 500 },
    );
  }

  const meRes = await fetch(`${base}/instructor-assignments/me`, {
    headers: { Authorization: instructorAuth },
  });
  if (!meRes.ok) {
    return NextResponse.json(
      { error: "Could not verify instructor session for this assignment" },
      { status: meRes.status === 401 ? 401 : 403 },
    );
  }
  const mePayload = (await readJson(meRes)) as {
    assignments?: Array<{ id: string; course_instance_id: string; language_id: number }>;
  };
  const assignments = mePayload.assignments ?? [];
  const assignment = assignments.find((a) => a.id === assignmentId);
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found for this instructor" }, { status: 403 });
  }

  if (assignment.language_id !== JAVA_LANGUAGE_ID) {
    return NextResponse.json(
      {
        error: `Seeding supports Java assignments only (language_id ${JAVA_LANGUAGE_ID}). This assignment uses language_id ${assignment.language_id}.`,
      },
      { status: 400 },
    );
  }

  const adminLoginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: demoAdminEmail, password: demoAdminPassword }),
  });
  const adminLoginPayload = (await readJson(adminLoginRes)) as { access_token?: string; message?: string };
  if (!adminLoginRes.ok || !adminLoginPayload.access_token) {
    return NextResponse.json(
      { error: adminLoginPayload.message ?? "Admin login failed (check DEMO_ADMIN_*) " },
      { status: 502 },
    );
  }
  const adminToken = adminLoginPayload.access_token;

  const results: SeedResult[] = [];
  let created = 0;
  let skipped = 0;

  for (const row of JAVA_DEMO_SEED_STUDENTS) {
    try {
      const createRes = await fetch(`${base}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          full_name: row.full_name,
          email: row.email,
          user_type: "student",
          student_id: row.student_id,
        }),
      });
      const createPayload = (await readJson(createRes)) as {
        id?: string;
        reset_link?: string;
        activation_link?: string;
        message?: string;
      };

      let userId: string | null = null;
      let existing = false;

      if (createRes.status === 409) {
        existing = true;
        skipped++;
      } else if (createRes.ok && createPayload.id) {
        userId = createPayload.id;
        created++;
        const link = createPayload.reset_link ?? createPayload.activation_link ?? "";
        const token = extractResetToken(link);
        if (!token) {
          results.push({
            email: row.email,
            status: "error",
            detail: "User created but reset_link missing — cannot set password",
          });
          continue;
        }
        const resetRes = await fetch(`${base}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, new_password: studentPassword }),
        });
        if (!resetRes.ok) {
          const errBody = (await readJson(resetRes)) as { message?: string };
          results.push({
            email: row.email,
            status: "error",
            detail: errBody.message ?? "reset-password failed",
          });
          continue;
        }
      } else {
        results.push({
          email: row.email,
          status: "error",
          detail: createPayload.message ?? `create user failed (${createRes.status})`,
        });
        continue;
      }

      const studentLoginRes = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email, password: studentPassword }),
      });
      const studentLoginPayload = (await readJson(studentLoginRes)) as { access_token?: string };
      if (!studentLoginRes.ok || !studentLoginPayload.access_token) {
        results.push({
          email: row.email,
          status: "error",
          detail: existing
            ? "Login failed — user may exist with a different password than DEMO_SEED_STUDENT_PASSWORD"
            : "Login failed after password reset",
        });
        continue;
      }
      const studentToken = studentLoginPayload.access_token;
      if (!userId) {
        userId = decodeJwtUserId(studentToken);
      }
      if (!userId) {
        results.push({ email: row.email, status: "error", detail: "Could not resolve user id" });
        continue;
      }

      const enrollRes = await fetch(`${base}/instructor-courses/${assignment.course_instance_id}/enrollments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: instructorAuth,
        },
        body: JSON.stringify({ user_id: userId, status: "Enrolled" }),
      });
      if (!enrollRes.ok && enrollRes.status !== 409) {
        const errBody = (await readJson(enrollRes)) as { message?: string };
        results.push({
          email: row.email,
          status: "error",
          detail: errBody.message ?? `enroll failed (${enrollRes.status})`,
        });
        continue;
      }

      const subRes = await fetch(`${base}/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          assignment_id: assignmentId,
          language: "java",
          language_id: JAVA_LANGUAGE_ID,
          code: row.source,
        }),
      });
      if (!subRes.ok) {
        const errBody = (await readJson(subRes)) as { message?: string };
        results.push({
          email: row.email,
          status: "error",
          detail: errBody.message ?? `submit failed (${subRes.status})`,
        });
        continue;
      }

      results.push({ email: row.email, status: "ok" });
    } catch (e) {
      results.push({
        email: row.email,
        status: "error",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const errors = results.filter((r) => r.status === "error");
  return NextResponse.json({
    ok: errors.length === 0,
    created,
    skipped,
    results,
    count: JAVA_DEMO_SEED_STUDENTS.length,
  });
}
