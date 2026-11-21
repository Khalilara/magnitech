"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmPassword"))) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"), lastName: form.get("lastName"),
          email: form.get("email"), password,
          acceptedTerms: form.get("acceptedTerms") === "on",
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not create your account.");
      router.replace("/shop");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    <div className="auth-form-row">
      <label>First name<input name="firstName" autoComplete="given-name" maxLength={100} required /></label>
      <label>Last name<input name="lastName" autoComplete="family-name" maxLength={100} required /></label>
    </div>
    <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><small>At least 12 characters.</small></label>
    <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    <label className="auth-consent"><input name="acceptedTerms" type="checkbox" required /> I agree to the <a href="/legal">Terms and Conditions</a>.</label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button dark-button" type="submit" disabled={busy}>{busy ? "Creating account…" : "Sign Up"}<span>↗</span></button>
    <div className="oauth-options"><span>OR CONTINUE WITH</span><div>{["Google","GitHub","Microsoft"].map(provider=><a key={provider} href={`/api/auth/oauth/${provider.toLowerCase()}`}>Continue with {provider}</a>)}</div></div>
    <p className="login-admin-note">New accounts start with the customer role. Admin access is assigned separately.</p>
  </form>;
}
