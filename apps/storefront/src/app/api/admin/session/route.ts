import { clearedSessionCookie, createAdminSession, isValidAdminSession, passwordMatches, sameOrigin, sessionCookie } from "@/lib/admin-auth";
import { getAdminSettings } from "@/lib/d1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json({ authenticated: await isValidAdminSession(request) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const settings = await getAdminSettings();
  if (!settings.password || !settings.sessionSecret) {
    return Response.json({ error: "Admin secrets are not configured on the Worker" }, { status: 503 });
  }
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const password = typeof input === "object" && input !== null && "password" in input ? (input as { password?: unknown }).password : null;
  if (typeof password !== "string" || !(await passwordMatches(password, settings.password))) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }
  const token = await createAdminSession();
  if (!token) return Response.json({ error: "Admin session secret is not configured" }, { status: 503 });
  return Response.json({ authenticated: true }, { headers: { "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:"), "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  return Response.json({ authenticated: false }, { headers: { "Set-Cookie": clearedSessionCookie(new URL(request.url).protocol === "https:"), "Cache-Control": "no-store" } });
}
