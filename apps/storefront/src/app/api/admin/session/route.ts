import { fetchAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const response = await fetchAdminSession(request.headers.get("cookie") ?? "");
  if (response.status === 401 || response.status === 403) {
    return Response.json({ authenticated: false }, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!response.ok) throw new Error(`Admin session verification failed with status ${response.status}`);
  return Response.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
}
