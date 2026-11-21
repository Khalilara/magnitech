import { getDatabase } from "@/lib/d1";
import { consumeAuthRateLimit, createSession, passwordMatches, sessionCookie } from "@/lib/auth";
import { isSameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  const body = input as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (email.length > 254 || password.length > 128) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const db = await getDatabase();
  if (!db) return Response.json({ error: "User database is unavailable." }, { status: 503 });
  if (!(await consumeAuthRateLimit(db, request, "login", email, 10, 900))) {
    return Response.json({ error: "Too many attempts. Please wait and try again later." }, { status: 429 });
  }
  const { results = [] } = await db.prepare(`SELECT id, email, first_name, last_name, role, is_active, password_salt, password_hash
    FROM users WHERE email = ? LIMIT 1`).bind(email).all<{
      id: string; email: string; first_name: string | null; last_name: string | null;
      role: "customer" | "admin" | "supplier"; is_active: number; password_salt: string | null; password_hash: string | null;
    }>();
  const user = results[0];
  const valid = await passwordMatches(
    password,
    user?.password_salt ?? "AAAAAAAAAAAAAAAAAAAAAA",
    user?.password_hash ?? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  );
  if (!user || !valid || user.is_active !== 1) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (user.role === "supplier") {
    const { results: applications = [] } = await db.prepare("SELECT status FROM supplier_requests WHERE user_id = ? LIMIT 1")
      .bind(user.id).all<{ status: "pending" | "approved" | "rejected" }>();
    const status = applications[0]?.status;
    if (status === "pending") return Response.json({ error: "Your supplier application is awaiting admin approval." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    if (status !== "approved") return Response.json({ error: "Your supplier application was not approved. Contact the store for assistance." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  await db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();
  const token = await createSession(db, user.id);
  return Response.json({ user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role } }, {
    headers: { "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:"), "Cache-Control": "no-store" },
  });
}
