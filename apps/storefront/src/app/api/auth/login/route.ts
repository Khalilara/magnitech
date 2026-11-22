import { getDatabase } from "@/lib/d1";
import { createSession, isCloudflareRateLimited, passwordMatches, sessionCookie } from "@/lib/auth";
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
  if (await isCloudflareRateLimited(request, "LOGIN_RATE_LIMITER", email)) {
    return Response.json({ error: "Too many sign-in attempts. Please wait and try again." }, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }

  const db = await getDatabase();
  if (!db) return Response.json({ error: "User database is unavailable." }, { status: 503 });
  type LoginUser = {
    id: string; email: string; role: "customer" | "admin" | "wholesaler";
    status?: string; is_active?: number; password_hash: string | null; password_salt?: string | null;
    first_name?: string | null; last_name?: string | null;
  };
  let user: LoginUser | undefined;
  try {
    const { results = [] } = await db.prepare(`SELECT id, email, role, status, password_hash, first_name, last_name
      FROM users WHERE email = ? LIMIT 1`).bind(email).all<LoginUser>();
    user = results[0];
  } catch {
    try {
      const { results = [] } = await db.prepare(`SELECT id, email, role, status, password_hash
        FROM users WHERE email = ? LIMIT 1`).bind(email).all<LoginUser>();
      user = results[0];
    } catch {
      // Existing D1 auth schema stores the salt separately and uses is_active.
      const { results = [] } = await db.prepare(`SELECT id, email, role, is_active, password_salt, password_hash, first_name, last_name
      FROM users WHERE email = ? LIMIT 1`).bind(email).all<LoginUser>();
      user = results[0];
    }
  }
  const valid = await passwordMatches(password, user?.password_hash ?? "", user?.password_salt);
  if (!user || !valid || (user.status ? user.status !== "active" : user.is_active !== 1)) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (user.role === "wholesaler") {
    const { results: applications = [] } = await db.prepare("SELECT status FROM wholesaler_profiles WHERE user_id = ? LIMIT 1")
      .bind(user.id).all<{ status: "pending" | "active" | "rejected" | "suspended" }>();
    const status = applications[0]?.status;
    if (status === "pending") return Response.json({ error: "Your wholesaler application is awaiting admin approval." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    if (status !== "active") return Response.json({ error: "Your wholesaler application was not approved. Contact the store for assistance." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const token = await createSession(db, user.id);
  return Response.json({ user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name ?? null, lastName: user.last_name ?? null } }, {
    headers: { "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:"), "Cache-Control": "no-store" },
  });
}
