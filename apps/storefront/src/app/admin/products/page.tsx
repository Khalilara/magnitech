import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import ProductApprovals from "./product-approvals";

export const dynamic="force-dynamic";

export default async function AdminProductApprovalsPage(){const token=(await cookies()).get(SESSION_COOKIE)?.value??null;const user=await findCurrentUser(token);if(!user)redirect("/login?redirect=%2Fadmin%2Fproducts");if(user.role!=="admin")redirect("/");return <ProductApprovals/>}
