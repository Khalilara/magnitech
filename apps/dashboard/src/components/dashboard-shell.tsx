import type { ReactNode } from "react";
import { SignOutButton } from "./sign-out";

type DashboardRole = "vendor" | "admin";

type DashboardShellProps = {
  role: DashboardRole;
  children: ReactNode;
};

const navigation = {
  vendor: [
    { label: "Vue d’ensemble", href: "#overview", icon: "⌂" },
    { label: "Produits", href: "#products", icon: "▦" },
    { label: "Commandes", href: "#orders", icon: "▤" },
    { label: "Paiements", href: "#payouts", icon: "↗" },
    { label: "Ma boutique", href: "#store", icon: "◇" },
  ],
  admin: [
    { label: "Vue d’ensemble", href: "#overview", icon: "⌂" },
    { label: "Catalogue", href: "#catalog", icon: "▦" },
    { label: "Vendeurs", href: "#sellers", icon: "♧" },
    { label: "Commandes", href: "#orders", icon: "▤" },
    { label: "Réglages", href: "#settings", icon: "⚙" },
  ],
};

export function DashboardShell({ role, children }: DashboardShellProps) {
  const isAdmin = role === "admin";
  const links = navigation[role];

  return (
    <div className={`dashboard-app ${role}-dashboard`}>
      <aside className="dashboard-sidebar">
        <a className="dashboard-brand" href="/">
          magnitech<span>.</span>
          <small>{isAdmin ? "ADMIN" : "PRO"}</small>
        </a>
        <div className="workspace-label">ESPACE {isAdmin ? "ADMINISTRATEUR" : "VENDEUR"}</div>
        <nav className="dashboard-navigation" aria-label="Navigation du tableau de bord">
          {links.map((item, index) => (
            <a
              className={`dashboard-nav-link ${index === 0 ? "active" : ""}`}
              href={item.href}
              key={item.label}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a className="help-link" href="mailto:bonjour@maghitech.fr">
            <span aria-hidden="true">?</span>
            <span><strong>Besoin d’aide ?</strong><small>Notre équipe vous répond</small></span>
          </a>
          <div className="sidebar-user">
            <div className="user-avatar">{isAdmin ? "AM" : "CM"}</div>
            <span><strong>{isAdmin ? "Alex Martin" : "Camille Moreau"}</strong><small>{isAdmin ? "Administrateur" : "Atelier Sonore"}</small></span>
            <span className="user-menu" aria-hidden="true">···</span>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-context">
            <span>Magnitech</span><b>/</b><strong>{isAdmin ? "Administration" : "Mon espace vendeur"}</strong>
          </div>
          <div className="topbar-actions">
            {!isAdmin && <a className="view-store-link" href={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}>Voir ma boutique <span aria-hidden="true">↗</span></a>}
            <span className="topbar-date">Lundi 16 novembre 2026</span>
            {isAdmin && <SignOutButton />}
            <div className="topbar-avatar" aria-label={isAdmin ? "Alex Martin" : "Camille Moreau"}>{isAdmin ? "AM" : "CM"}</div>
          </div>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
