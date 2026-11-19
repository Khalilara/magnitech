"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/v1/auth/logout`, {
        method: "POST", credentials: "include",
      });
      if (!response.ok) throw new Error("Logout request was rejected");
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Sign out failed. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="sign-out-wrap"><button className="sign-out-button" disabled={busy} onClick={signOut}>{busy ? "Signing out…" : "Sign out"}</button>{error&&<span role="alert">{error}</span>}</div>;
}
