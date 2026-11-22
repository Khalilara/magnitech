import { getDatabase } from "@/lib/d1";
import { findCurrentUser, isSameOrigin, readSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const db = await getDatabase();
  if (!db) return Response.json({ error: "Account database is unavailable." }, { status: 503 });
  try {
    const { results = [] } = await db.prepare("SELECT email, first_name, last_name, phone FROM users WHERE id = ? LIMIT 1")
      .bind(user.id).all<{ email: string; first_name: string | null; last_name: string | null; phone: string | null }>();
    const row = results[0];
    return Response.json({ profile: row ? { email: row.email, firstName: row.first_name ?? "", lastName: row.last_name ?? "", phone: row.phone ?? "" } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ profile: { email: user.email, firstName: user.firstName ?? "", lastName: user.lastName ?? "", phone: "" }, editable: false }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = input as Record<string, unknown>;
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100 || phone.length > 40) {
    return Response.json({ error: "Enter your first name, last name and a phone number of 40 characters or fewer." }, { status: 400 });
  }
  const db = await getDatabase();
  if (!db) return Response.json({ error: "Account database is unavailable." }, { status: 503 });
  try {
    await db.prepare("UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(firstName, lastName, phone || null, user.id).run();
    return Response.json({ profile: { email: user.email, firstName, lastName, phone } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Profile editing is not supported by the currently connected D1 schema." }, { status: 409 });
  }
}
