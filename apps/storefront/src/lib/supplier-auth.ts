import { getDatabase } from "@/lib/d1";
import { findCurrentUser, readSessionToken, type AuthUser } from "@/lib/auth";

export async function requireApprovedSupplier(request: Request): Promise<{ user: AuthUser } | { response: Response }> {
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) return { response: Response.json({ error: "Sign in to your approved supplier account." }, { status: 401, headers: { "Cache-Control": "no-store" } }) };
  if (user.role !== "supplier") return { response: Response.json({ error: "Supplier access is required." }, { status: 403, headers: { "Cache-Control": "no-store" } }) };
  const db = await getDatabase();
  if (!db) return { response: Response.json({ error: "Supplier database is unavailable." }, { status: 503 }) };
  const { results = [] } = await db.prepare("SELECT status FROM supplier_requests WHERE user_id = ? LIMIT 1")
    .bind(user.id).all<{ status: string }>();
  if (results[0]?.status !== "approved") return { response: Response.json({ error: results[0]?.status === "rejected" ? "Your supplier application was rejected. Contact the store for assistance." : "Your supplier application is awaiting admin approval." }, { status: 403, headers: { "Cache-Control": "no-store" } }) };
  return { user };
}
