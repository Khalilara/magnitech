import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { getDatabase } from "@/lib/d1";
import SupplierDashboard from "./supplier-dashboard";

export const dynamic="force-dynamic";

export default async function SupplierDashboardPage(){const token=(await cookies()).get(SESSION_COOKIE)?.value??null;const user=await findCurrentUser(token);if(!user)redirect("/supplier/login");if(user.role!=="wholesaler")redirect("/");const db=await getDatabase();const profiles=db?await db.prepare("SELECT id,business_name,status FROM wholesaler_profiles WHERE user_id=? LIMIT 1").bind(user.id).all<{id:string;business_name:string;status:string}>():{results:[]};const profile=profiles.results?.[0];if(profile?.status!=="active")redirect(`/supplier/login?status=${profile?.status==="rejected"?"rejected":"pending"}`);return <SupplierDashboard supplierName={profile?.business_name||user.email}/>}
