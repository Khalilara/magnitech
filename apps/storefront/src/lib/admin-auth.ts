import { getApiOrigin } from "@/lib/d1";

export function fetchAdminSession(cookie: string): Promise<Response> {
  return fetch(`${getApiOrigin()}/v1/admin/session`, {
    headers: { cookie },
    cache: "no-store",
  });
}

export async function requireAdmin(request: Request): Promise<Response | null> {
  const response = await fetchAdminSession(request.headers.get("cookie") ?? "");
  if (response.ok) return null;
  if (response.status === 401 || response.status === 403) {
    return Response.json({ error: response.status === 403 ? "Administrator access required" : "Authentication required" }, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  throw new Error(`Admin session verification failed with status ${response.status}`);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
