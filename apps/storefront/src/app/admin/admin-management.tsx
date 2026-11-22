"use client";

import { useCallback, useEffect, useState } from "react";

type AdminAccount = { id: string; email: string; status: "active" | "disabled"; created_at: string; updated_at: string };

export default function AdminManagement() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAdmins = useCallback(async () => {
    const response = await fetch("/api/admin/admins", { cache: "no-store" });
    const body = await response.json() as AdminAccount[] | { error?: string };
    if (!response.ok || !Array.isArray(body)) throw new Error(!Array.isArray(body) ? body.error ?? "Could not load admin accounts." : "Could not load admin accounts.");
    setAdmins(body);
  }, []);

  useEffect(() => {
    void loadAdmins().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load admin accounts."))
      .finally(() => setLoading(false));
  }, [loadAdmins]);

  async function createAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("create"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not create admin account.");
      setEmail(""); setPassword(""); await loadAdmins(); setNotice("Admin account created and activated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create admin account."); }
    finally { setBusy(""); }
  }

  async function setStatus(admin: AdminAccount) {
    const status = admin.status === "active" ? "disabled" : "active";
    if (!window.confirm(`${status === "disabled" ? "Disable" : "Activate"} admin access for ${admin.email}?`)) return;
    setBusy(admin.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/admins", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: admin.id, status }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not update admin account.");
      await loadAdmins(); setNotice(`${admin.email} is now ${status}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update admin account."); }
    finally { setBusy(""); }
  }

  return <main className="page-wrap admin-page">
    <div className="shop-top"><div><p className="overline">SUPER ADMIN · ACCESS CONTROL</p><h1>Admin<br/><em>accounts.</em></h1></div><a className="text-button" href="/admin">← Back to admin</a></div>
    <div className="local-banner">Admin accounts use D1 credentials and can access the admin dashboard. Only the Cloudflare super admin can manage these accounts.</div>
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="notice error" role="alert">{error}</p>}
    <section className="supplier-admin-section">
      <h2>Create an admin</h2>
      <form className="form-grid" onSubmit={createAdmin}>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" required /></label>
        <label>Password <small>(12 to 128 characters)</small><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label>
        <button className="button dark-button wide" disabled={busy !== ""}>{busy === "create" ? "Creating…" : "Create admin account"}</button>
      </form>
    </section>
    <section className="supplier-admin-section">
      <h2>Admin accounts</h2>
      {loading ? <p role="status">Loading admin accounts…</p> : admins.length === 0 ? <p>No admin accounts in D1 yet.</p> : <div className="supplier-review-list">{admins.map((admin) => <article className="supplier-review-card" key={admin.id}>
        <div className="supplier-review-head"><div><h3>{admin.email}</h3><p className="overline">Created {new Date(admin.created_at).toLocaleDateString("en-GB")}</p></div><span className={`supplier-status ${admin.status}`}>{admin.status}</span></div>
        <button className={admin.status === "active" ? "text-button" : "button dark-button"} disabled={Boolean(busy)} onClick={() => void setStatus(admin)}>{busy === admin.id ? "Updating…" : admin.status === "active" ? "Disable account" : "Activate account"}</button>
      </article>)}</div>}
    </section>
  </main>;
}
