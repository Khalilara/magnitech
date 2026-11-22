import { isValidAdminSession } from "@/lib/admin-auth";
import { listAdminD1Tables } from "@/lib/admin-d1";
import { getDatabase } from "@/lib/d1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isValidAdminSession(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const db = await getDatabase();
    if (!db) return Response.json({ error: "D1 binding MAGHITECH_DB is not configured" }, { status: 503 });
    const tables = await listAdminD1Tables(db);
    return Response.json({ tables }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to read D1 schema metadata", error);
    return Response.json({ error: "Could not read D1 schema metadata" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
