import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import AdminProducts from "./admin-products";
import SupplierRequests from "./supplier-requests";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  const user = await findCurrentUser(token);
  if (!user) redirect("/login?redirect=%2Fadmin");
  if (user.role !== "admin") redirect("/");

  return <><AdminProducts /><SupplierRequests /></>;
}
