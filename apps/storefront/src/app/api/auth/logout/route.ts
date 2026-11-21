import { clearSessionCookie, isSameOrigin, logoutSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  await logoutSession(request);
  return Response.json({ authenticated: false }, {
    headers: { "Set-Cookie": clearSessionCookie(new URL(request.url).protocol === "https:"), "Cache-Control": "no-store" },
  });
}
