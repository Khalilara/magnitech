"use client";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const providers = [
  ["google", "Continue with Google"],
  ["github", "Continue with GitHub"],
  ["microsoft", "Continue with Microsoft"],
] as const;

export function LoginOptions({ redirectToAdmin }: { redirectToAdmin: boolean }) {
  return <div className="login-providers">
    {providers.map(([provider, label]) => <a key={provider} href={`${api}/v1/auth/${provider}/start${redirectToAdmin ? "?redirect=%2Fadmin" : ""}`}>
      <span aria-hidden="true">{provider === "google" ? "G" : provider === "github" ? "⌘" : "▦"}</span>{label}<b aria-hidden="true">↗</b>
    </a>)}
    <p className="login-admin-note">Administrator access is granted only to the owner account configured on the server.</p>
  </div>;
}
