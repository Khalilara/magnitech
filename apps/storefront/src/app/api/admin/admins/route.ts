import { hashPassword, isSameOrigin } from "@/lib/auth";
import { getDatabase } from "@/lib/d1";
import { isValidAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

async function authorizeSuperAdmin(request: Request): Promise<Response | null> {
  if (await isValidAdminSession(request)) return null;
  return Response.json({ error: "Super administrator access required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const denied = await authorizeSuperAdmin(request);
  if (denied) return denied;
  const db = await getDatabase();
  if (!db) return Response.json({ error: "D1 is unavailable." }, { status: 503 });
  const { results = [] } = await db.prepare(`SELECT id,email,status,created_at,updated_at
    FROM users WHERE role='admin' ORDER BY created_at DESC`).all();
  return Response.json(results, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await authorizeSuperAdmin(request);
  if (denied) return denied;
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const values = body as Record<string, unknown>;
  const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
  const password = typeof values.password === "string" ? values.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 12 || password.length > 128) {
    return Response.json({ error: "The password must contain between 12 and 128 characters." }, { status: 400 });
  }
  const db = await getDatabase();
  if (!db) return Response.json({ error: "D1 is unavailable." }, { status: 503 });
  try {
    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();
    await db.prepare(`INSERT INTO users (id,email,password_hash,role,status)
      VALUES (?,?,?,'admin','active')`).bind(id, email, passwordHash).run();
    return Response.json({ id, email, status: "active" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create admin account.";
    if (/unique|constraint/i.test(message)) return Response.json({ error: "An account already exists for this email." }, { status: 409 });
    console.error("Admin account creation failed", error);
    return Response.json({ error: "Could not create admin account." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await authorizeSuperAdmin(request);
  if (denied) return denied;
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const values = body as Record<string, unknown>;
  const id = typeof values.id === "string" ? values.id : "";
  const status = values.status;
  if (!id || (status !== "active" && status !== "disabled")) {
    return Response.json({ error: "Choose an admin account and a valid status." }, { status: 400 });
  }
  const db = await getDatabase();
  if (!db) return Response.json({ error: "D1 is unavailable." }, { status: 503 });
  const result = await db.prepare("UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='admin'")
    .bind(status, id).run() as { meta?: { changes?: number } };
  if (!result.meta?.changes) return Response.json({ error: "Admin account not found." }, { status: 404 });
  return Response.json({ id, status }, { headers: { "Cache-Control": "no-store" } });
}
