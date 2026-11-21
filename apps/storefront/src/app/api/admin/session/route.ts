import { findCurrentUser, readSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) return Response.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (user.role !== "admin") return Response.json({ authenticated: false }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return Response.json({ authenticated: true, user }, { headers: { "Cache-Control": "no-store" } });
}
