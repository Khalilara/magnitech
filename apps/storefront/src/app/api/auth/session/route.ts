import { findCurrentUser, readSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) return Response.json({ user: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
