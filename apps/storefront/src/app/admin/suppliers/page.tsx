import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin-session";
import SupplierRequests from "../supplier-requests";

export const dynamic = "force-dynamic";

export default async function AdminSupplierApplicationsPage() {
  const requestCookies = await cookies();
  const hasAdminPasswordSession = await isValidAdminSession(new Request("https://internal.invalid", {
    headers: { cookie: `${ADMIN_COOKIE}=${requestCookies.get(ADMIN_COOKIE)?.value ?? ""}` },
  }));
  const user = hasAdminPasswordSession
    ? null
    : await findCurrentUser(requestCookies.get(SESSION_COOKIE)?.value ?? null);

  if (!hasAdminPasswordSession && user?.role !== "admin") redirect("/admin");
  return <SupplierRequests />;
}
