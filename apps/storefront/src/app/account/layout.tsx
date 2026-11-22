import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findCurrentUser, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  const user = await findCurrentUser(token);
  if (!user) redirect("/login");
  const name = user.firstName?.trim() || user.email.split("@")[0];
  return <main className="account-page page-wrap"><header className="account-heading"><p className="overline">YOUR MAGNITECH ACCOUNT</p><h1>Welcome, <em>{name}.</em></h1><p>Manage your profile and keep track of the details that matter.</p></header><div className="account-layout"><nav className="account-side-nav" aria-label="Account pages"><Link href="/account/profile">My Profile</Link><Link href="/account/orders">My Orders</Link><Link href="/account/addresses">My Addresses</Link><Link href="/account/wishlist">My Wishlist</Link><Link href="/account/settings">Account Settings</Link></nav><section className="account-content">{children}</section></div></main>;
}
