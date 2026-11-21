"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginOptions({ redirectToAdmin }: { redirectToAdmin: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const body = await response.json() as { error?: string; user?: { role?: string } };
      if (!response.ok) throw new Error(body.error ?? "Could not sign in.");
      router.replace(redirectToAdmin && body.user?.role === "admin" ? "/admin" : body.user?.role === "wholesaler" ? "/supplier/dashboard" : "/shop");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return <>
  <form className="auth-form" onSubmit={submit}>
    <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>
    <div className="auth-login-extras"><span>Sessions stay active for 7 days.</span><a href="mailto:abarkaneanass.engineer@gmail.com?subject=MAGNITECH%20account%20access">Forgot password?</a></div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button dark-button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign In"}<span>↗</span></button>
    <p className="login-admin-note">Admin access is granted separately by the store owner.</p>
  </form>
  </>;
}
