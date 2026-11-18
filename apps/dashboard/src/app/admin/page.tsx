import { DashboardShell } from "../../components/dashboard-shell";

const recentSellers = [
  { initials: "ND", name: "Nora Design", type: "Maison & déco", date: "Aujourd’hui", tone: "peach", status: "À vérifier", statusTone: "warning" },
  { initials: "TP", name: "Tech&Play", type: "High-tech", date: "Hier", tone: "lilac", status: "Actif", statusTone: "success" },
  { initials: "LF", name: "La Fabrique", type: "Photo & image", date: "14 nov. 2026", tone: "green", status: "Actif", statusTone: "success" },
  { initials: "OB", name: "Objet Brut", type: "Maison & déco", date: "13 nov. 2026", tone: "yellow", status: "À vérifier", statusTone: "warning" },
];

const recentOrders = [
  { id: "#MG-2841", seller: "Atelier Sonore", customer: "Léa Bernard", amount: "129,90 €", status: "En préparation", tone: "warning" },
  { id: "#MG-2840", seller: "Maison Pixel", customer: "Hugo Petit", amount: "89,90 €", status: "Expédiée", tone: "success" },
  { id: "#MG-2839", seller: "Nora Design", customer: "Inès Robert", amount: "68,00 €", status: "En attente", tone: "neutral" },
  { id: "#MG-2838", seller: "Atelier Sonore", customer: "Thomas Petit", amount: "59,90 €", status: "En préparation", tone: "warning" },
];

export default function AdminHome() {
  return (
    <DashboardShell role="admin">
      <section className="dashboard-page-heading" id="overview">
        <div>
          <p className="dashboard-eyebrow">VUE D’ENSEMBLE · 16 NOVEMBRE 2026</p>
          <h1>Bonjour Anass <span aria-hidden="true">✦</span></h1>
          <p className="dashboard-subtitle">Voici les dernières nouvelles de votre marketplace.</p>
        </div>
        <a className="dashboard-primary-button" href="#sellers">Voir les vendeurs <span aria-hidden="true">→</span></a>
      </section>

      <div className="demo-notice">
        <span aria-hidden="true">i</span>
        <p><strong>Mode aperçu</strong> — Les chiffres, vendeurs et commandes sont des exemples et ne proviennent pas encore de la base de données.</p>
      </div>

      <section className="metric-grid admin-metrics" aria-label="Indicateurs de la marketplace">
        <article className="metric-card">
          <div className="metric-topline"><span>Volume de ventes</span><span className="metric-icon green-icon">€</span></div>
          <strong className="metric-value">48 290 €</strong>
          <div className="metric-foot"><span className="metric-change">↗ 18,4 %</span><span>ce mois-ci</span></div>
          <div className="metric-sparkline green-line"><i /></div>
        </article>
        <article className="metric-card">
          <div className="metric-topline"><span>Commandes</span><span className="metric-icon blue-icon">▤</span></div>
          <strong className="metric-value">836</strong>
          <div className="metric-foot"><span className="metric-change">↗ 11,2 %</span><span>ce mois-ci</span></div>
          <div className="metric-sparkline blue-line"><i /></div>
        </article>
        <article className="metric-card">
          <div className="metric-topline"><span>Vendeurs actifs</span><span className="metric-icon orange-icon">♧</span></div>
          <strong className="metric-value">124</strong>
          <div className="metric-foot"><span className="metric-change">＋ 8</span><span>ce mois-ci</span></div>
          <div className="metric-sparkline orange-line"><i /></div>
        </article>
        <article className="metric-card">
          <div className="metric-topline"><span>À valider</span><span className="metric-icon yellow-icon">◷</span></div>
          <strong className="metric-value">7</strong>
          <div className="metric-foot"><a className="metric-action" href="#sellers">Voir les demandes <span aria-hidden="true">→</span></a></div>
          <div className="metric-sparkline yellow-line"><i /></div>
        </article>
      </section>

      <section className="dashboard-main-grid admin-main-grid">
        <article className="panel sales-panel" id="activity">
          <div className="panel-heading">
            <div><h2>Activité de la marketplace</h2><p>Volume de ventes sur les 30 derniers jours</p></div>
            <span className="period-label">30 derniers jours</span>
          </div>
          <div className="chart-summary"><strong>48 290 €</strong><span>↗ 18,4 %</span></div>
          <div className="sales-chart">
            <div className="chart-y-labels"><span>15 000 €</span><span>10 000 €</span><span>5 000 €</span><span>0 €</span></div>
            <svg viewBox="0 0 640 180" role="img" aria-label="Courbe du volume de ventes sur les 30 derniers jours">
              <defs><linearGradient id="adminFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8295c2" stopOpacity=".22" /><stop offset="100%" stopColor="#8295c2" stopOpacity="0" /></linearGradient></defs>
              <path className="chart-grid-line" d="M0 16H640M0 65H640M0 114H640M0 163H640" />
              <path d="M0 148C29 133 36 142 58 124S91 132 111 108 146 119 165 101 196 111 217 85 250 98 271 76 302 90 325 68 358 83 379 55 411 70 434 48 465 62 489 37 518 53 542 28 574 43 596 22 623 34 640 11V175H0Z" fill="url(#adminFill)" />
              <path className="admin-chart-line" d="M0 148C29 133 36 142 58 124S91 132 111 108 146 119 165 101 196 111 217 85 250 98 271 76 302 90 325 68 358 83 379 55 411 70 434 48 465 62 489 37 518 53 542 28 574 43 596 22 623 34 640 11" />
              <circle cx="640" cy="11" r="4" className="admin-chart-point" />
            </svg>
          </div>
          <div className="chart-x-labels"><span>18 oct.</span><span>25 oct.</span><span>1 nov.</span><span>8 nov.</span><span>15 nov.</span></div>
        </article>

        <article className="panel attention-panel">
          <div className="panel-heading"><div><h2>À traiter</h2><p>Les actions qui vous attendent</p></div></div>
          <a className="attention-item" href="#sellers">
            <span className="attention-icon orange-icon">♧</span>
            <span><strong>Demandes vendeurs</strong><small>7 boutiques attendent une validation</small></span>
            <b>7</b>
          </a>
          <a className="attention-item" href="#orders">
            <span className="attention-icon blue-icon">↩</span>
            <span><strong>Demandes de retour</strong><small>3 retours à examiner</small></span>
            <b>3</b>
          </a>
          <a className="attention-item" href="#catalog">
            <span className="attention-icon yellow-icon">▦</span>
            <span><strong>Produits à modérer</strong><small>12 nouvelles fiches produits</small></span>
            <b>12</b>
          </a>
          <div className="attention-footer"><span className="online-dot" /> Tout le reste est à jour</div>
        </article>
      </section>

      <section className="dashboard-main-grid lower-grid admin-lower-grid">
        <article className="panel orders-panel" id="orders">
          <div className="panel-heading"><div><h2>Dernières commandes</h2><p>Suivi des commandes de la marketplace</p></div><a className="panel-link" href="#orders">Tout voir <span aria-hidden="true">→</span></a></div>
          <div className="table-scroll">
            <table className="dashboard-table">
              <thead><tr><th>Commande</th><th>Boutique</th><th>Client</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="order-id">{order.id}<small>16 nov. 2026</small></td>
                    <td>{order.seller}</td>
                    <td>{order.customer}</td>
                    <td className="table-amount">{order.amount}</td>
                    <td><span className={`status-pill ${order.tone}`}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel sellers-panel" id="sellers">
          <div className="panel-heading"><div><h2>Vendeurs récents</h2><p>Les dernières boutiques inscrites</p></div><a className="panel-link" href="#sellers">Tout voir <span aria-hidden="true">→</span></a></div>
          <div className="recent-seller-list">
            {recentSellers.map((seller) => (
              <div className="recent-seller-row" key={seller.name}>
                <span className={`seller-initials ${seller.tone}`}>{seller.initials}</span>
                <span className="recent-seller-info"><strong>{seller.name}</strong><small>{seller.type} · {seller.date}</small></span>
                <span className={`status-pill ${seller.statusTone}`}>{seller.status}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="dashboard-main-grid lower-grid admin-lower-grid">
        <article className="panel orders-panel catalog-panel" id="catalog">
          <div className="panel-heading"><div><h2>Catalogue à modérer</h2><p>Produits récemment soumis par les vendeurs</p></div><span className="period-label">3 exemples</span></div>
          <div className="table-scroll">
            <table className="dashboard-table">
              <thead><tr><th>Produit</th><th>Boutique</th><th>Catégorie</th><th>Statut</th></tr></thead>
              <tbody>
                <tr><td className="order-id">Lampe Halo<small>Soumis le 16 nov. 2026</small></td><td>Nora Design</td><td>Maison & déco</td><td><span className="status-pill warning">À modérer</span></td></tr>
                <tr><td className="order-id">Mini projecteur nomade<small>Soumis le 15 nov. 2026</small></td><td>Tech&Play</td><td>High-tech</td><td><span className="status-pill warning">À modérer</span></td></tr>
                <tr><td className="order-id">Étui appareil photo<small>Soumis le 14 nov. 2026</small></td><td>La Fabrique</td><td>Photo & image</td><td><span className="status-pill neutral">En vérification</span></td></tr>
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel settings-panel" id="settings">
          <div className="panel-heading"><div><h2>Réglages marketplace</h2><p>Paramètres généraux actuellement définis</p></div></div>
          <div className="setting-row"><span>Commission par défaut</span><strong>12 %</strong></div>
          <div className="setting-row"><span>Délai de rétractation</span><strong>14 jours</strong></div>
          <div className="setting-row"><span>Devise</span><strong>EUR · €</strong></div>
          <p className="settings-note">Les réglages détaillés seront accessibles lorsque l’espace sera relié à l’API.</p>
        </article>
      </section>
    </DashboardShell>
  );
}
