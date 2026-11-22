import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Supplier portal", robots: { index: false, follow: false } };

export default function SupplierPortalPage() {
  return <main className="login-page supplier-portal-page">
    <section className="login-card supplier-portal-card">
      <Link className="wordmark login-brand" href="/" aria-label="MAGNITECH home">MAGNI<span>TECH</span><i>®</i></Link>
      <p className="overline">MAGNITECH PARTNERS</p>
      <h1>Supplier<br/><em>portal.</em></h1>
      <p className="login-copy">A dedicated space for supplier applications and account access. New applications are reviewed by the MAGNITECH team before access is granted.</p>
      <div className="supplier-portal-actions">
        <Link className="button dark-button" href="/supplier/login">Supplier Sign In <span>↗</span></Link>
        <Link className="button light-button" href="/supplier/register">Become a Supplier / Register <span>↗</span></Link>
      </div>
      <p className="login-admin-note">Already submitted an application? Sign in to check access after approval.</p>
      <Link className="login-return" href="/">Continue browsing the shop <span>↗</span></Link>
    </section>
    <aside className="login-aside supplier-portal-aside"><span>MAGNITECH / SUPPLIER ACCESS</span><p>Thoughtful partners.<br/><em>Better things.</em></p></aside>
  </main>;
}
