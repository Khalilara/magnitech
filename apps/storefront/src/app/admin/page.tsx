import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminProducts from "./admin-products";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieHeader = (await cookies()).toString();
  let status = 0;
  try {
    const response = await fetch(`${process.env.API_URL ?? "http://localhost:8000"}/v1/admin/session`, {
      headers: { cookie: cookieHeader }, cache: "no-store",
    });
    status = response.status;
  } catch {
    redirect("/login?redirect=%2Fadmin");
  }
  if (status === 403) redirect("/");
  if (status !== 200) redirect("/login?redirect=%2Fadmin");
  return <AdminProducts />;
}
