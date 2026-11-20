import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchAdminSession } from "@/lib/admin-auth";
import AdminProducts from "./admin-products";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieHeader = (await cookies()).toString();
  const response = await fetchAdminSession(cookieHeader);

  if (response.status === 401) redirect("/login?redirect=%2Fadmin");
  if (response.status === 403) redirect("/");
  if (!response.ok) {
    throw new Error(`Admin session verification failed with status ${response.status}`);
  }

  return <AdminProducts />;
}
