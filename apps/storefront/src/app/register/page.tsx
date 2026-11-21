import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <main className="login-page"><div className="login-card">
    <Link className="wordmark login-brand" href="/">MAGNI<span>TECH</span><i>®</i></Link>
    <p className="overline">YOUR MAGNITECH ACCOUNT</p>
    <h1>Create<br/><em>account.</em></h1>
    <p className="login-copy">Create an account to keep your details together and make future orders easier.</p>
    <RegisterForm />
    <p className="auth-switch">Already registered? <Link href="/login">Sign in</Link></p>
    <Link className="login-return" href="/shop">Continue browsing the shop <span>↗</span></Link>
  </div><aside className="login-aside"><span>MAGNITECH / MEMBER ACCESS</span><p>Thoughtful technology.<br/><em>Thoughtfully yours.</em></p></aside></main>;
}
