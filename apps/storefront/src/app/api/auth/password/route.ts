import { getDatabase } from "@/lib/d1";
import { findCurrentUser, hashPasswordParts, isSameOrigin, passwordMatches, readSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = input as Record<string, unknown>;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword || !newPassword || newPassword.length > 128) return Response.json({ error: "Enter your current password and a new password (128 characters maximum)." }, { status: 400 });
  const db = await getDatabase();
  if (!db) return Response.json({ error: "Account database is unavailable." }, { status: 503 });
  let hash: string | null = null, salt: string | null = null;
  try {
    const { results = [] } = await db.prepare("SELECT password_hash, password_salt FROM users WHERE id = ? LIMIT 1")
      .bind(user.id).all<{ password_hash: string | null; password_salt: string | null }>();
    hash = results[0]?.password_hash ?? null;
    salt = results[0]?.password_salt ?? null;
  } catch {
    try {
      const { results = [] } = await db.prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1")
        .bind(user.id).all<{ password_hash: string | null }>();
      hash = results[0]?.password_hash ?? null;
    } catch { return Response.json({ error: "Password settings are unavailable in the connected D1 schema." }, { status: 409 }); }
  }
  if (!hash || !(await passwordMatches(currentPassword, hash, salt))) return Response.json({ error: "Your current password is incorrect." }, { status: 400 });
  const next = await hashPasswordParts(newPassword);
  try {
    if (salt !== null) {
      await db.prepare("UPDATE users SET password_salt = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(next.salt, next.hash, user.id).run();
    } else {
      await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(`${next.salt}.${next.hash}`, user.id).run();
    }
    return Response.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not update the password in the connected D1 schema." }, { status: 409 });
  }
}
