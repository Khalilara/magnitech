import type { Metadata } from "next";
import Link from "next/link";
import { LoginOptions } from "./login-options";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect } = await searchParams;
  return <main className="login-page"><div className="login-card">
    <Link className="wordmark login-brand" href="/">MAGNI<span>TECH</span><i>®</i></Link>
    <p className="overline">YOUR MAGNITECH ACCOUNT</p>
    <h1>Welcome<br/><em>back.</em></h1>
    <p className="login-copy">Sign in securely to continue. Your account role is managed by MAGNITECH.</p>
    <LoginOptions redirectToAdmin={redirect === "/admin"} />
    <Link className="login-return" href="/shop">Continue browsing the shop <span>↗</span></Link>
  </div><aside className="login-aside"><span>MAGNITECH / MEMBER ACCESS</span><p>Thoughtful technology.<br/><em>Thoughtfully yours.</em></p></aside></main>;
}
