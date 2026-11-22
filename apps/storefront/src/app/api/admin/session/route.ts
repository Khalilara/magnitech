import { clearSessionCookie, findCurrentUser, isCloudflareRateLimited, logoutSession, readSessionToken } from "@/lib/auth";
import { getAdminSettings } from "@/lib/d1";
import { adminPasswordMatches, adminSessionCookie, clearedAdminSessionCookie, createAdminSession, isValidAdminSession, sameOrigin } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (await isValidAdminSession(request)) return Response.json({ authenticated: true, superAdmin: true }, { headers: { "Cache-Control": "no-store" } });
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) return Response.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (user.role !== "admin") return Response.json({ authenticated: false }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return Response.json({ authenticated: true, superAdmin: false, user }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const password = body && typeof body === "object" && "password" in body && typeof body.password === "string" ? body.password : "";
  if (await isCloudflareRateLimited(request, "LOGIN_RATE_LIMITER", "admin")) {
    return Response.json({ error: "Too many sign-in attempts. Please wait and try again." }, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
  const { password: expectedPassword, sessionSecret } = await getAdminSettings();
  if (!expectedPassword || !sessionSecret) return Response.json({ error: "Admin authentication is not configured on this Worker." }, { status: 503 });
  if (!(await adminPasswordMatches(password, expectedPassword))) return Response.json({ error: "Admin password is incorrect." }, { status: 401 });
  const token = await createAdminSession();
  if (!token) return Response.json({ error: "Admin session is not configured on this Worker." }, { status: 503 });
  return Response.json({ authenticated: true }, {
    headers: { "Set-Cookie": adminSessionCookie(token, new URL(request.url).protocol === "https:"), "Cache-Control": "no-store" },
  });
}

export async function DELETE(request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  const userToken = readSessionToken(request);
  if (userToken) await logoutSession(request);
  const headers = new Headers({ "Set-Cookie": clearedAdminSessionCookie(secure), "Cache-Control": "no-store" });
  if (userToken) headers.append("Set-Cookie", clearSessionCookie(secure));
  return new Response(null, { status: 204, headers });
}
