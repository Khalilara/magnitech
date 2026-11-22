import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin-session";
import ProductApprovals from "./product-approvals";

export const dynamic="force-dynamic";

export default async function AdminProductApprovalsPage(){const cookieStore=await cookies();const adminToken=cookieStore.get(ADMIN_COOKIE)?.value??"";const superAdmin=await isValidAdminSession(new Request("https://internal.invalid",{headers:{cookie:`${ADMIN_COOKIE}=${adminToken}`}}));const user=superAdmin?null:await findCurrentUser(cookieStore.get(SESSION_COOKIE)?.value??null);if(!superAdmin&&!user)redirect("/login?redirect=%2Fadmin%2Fproducts");if(!superAdmin&&user?.role!=="admin")redirect("/");return <ProductApprovals/>}
