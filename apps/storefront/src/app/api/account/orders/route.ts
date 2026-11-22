import { getDatabase } from "@/lib/d1";
import { findCurrentUser, readSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const db = await getDatabase();
  if (!db) return Response.json({ error: "Order database is unavailable." }, { status: 503 });
  try {
    const { results = [] } = await db.prepare(`SELECT id, reference, status, payment_status, currency, total_cents, created_at
      FROM orders WHERE user_id = ? OR customer_email = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 100`).bind(user.id, user.email).all<{
        id: string; reference: string; status: string; payment_status: string; currency: string; total_cents: number; created_at: string;
      }>();
    return Response.json({ orders: results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Older installations may not yet have the optional order-history table.
    return Response.json({ orders: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
