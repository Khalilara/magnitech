import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { getDatabase } from "@/lib/d1";
import SupplierDashboard from "./supplier-dashboard";

export const dynamic="force-dynamic";

export default async function SupplierDashboardPage(){const token=(await cookies()).get(SESSION_COOKIE)?.value??null;const user=await findCurrentUser(token);if(!user)redirect("/supplier/login");if(user.role!=="supplier")redirect("/");const db=await getDatabase();const requests=db?await db.prepare("SELECT status FROM supplier_requests WHERE user_id=? LIMIT 1").bind(user.id).all<{status:string}>():{results:[]};const status=requests.results?.[0]?.status;if(status!=="approved")redirect(`/supplier/login?status=${status==="rejected"?"rejected":"pending"}`);return <SupplierDashboard supplierName={[user.first_name,user.last_name].filter(Boolean).join(" ")||user.email}/>}
