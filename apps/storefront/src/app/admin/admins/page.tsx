import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin-session";
import AdminManagement from "../admin-management";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  const isSuperAdmin = await isValidAdminSession(new Request("https://internal.invalid", {
    headers: { cookie: `${ADMIN_COOKIE}=${token}` },
  }));
  if (!isSuperAdmin) redirect("/admin");
  return <AdminManagement />;
}
