import { DashboardShell } from "../../components/dashboard-shell";

const orders = [
  { id: "#MG-2841", customer: "Léa Bernard", date: "Aujourd’hui, 10:42", item: "Casque Studio Pro", amount: "129,90 €", status: "À expédier", tone: "warning" },
  { id: "#MG-2838", customer: "Thomas Petit", date: "Aujourd’hui, 09:16", item: "Enceinte nomade", amount: "59,90 €", status: "À expédier", tone: "warning" },
  { id: "#MG-2829", customer: "Sarah Laurent", date: "Hier, 16:08", item: "Casque Studio Pro", amount: "129,90 €", status: "Expédiée", tone: "success" },
  { id: "#MG-2817", customer: "Mehdi Robert", date: "Hier, 11:35", item: "Enceinte nomade", amount: "59,90 €", status: "Livrée", tone: "neutral" },
];

const bestSellers = [
  { initials: "CS", name: "Casque sans fil Studio Pro", sold: "38 ventes", amount: "4 941 €", color: "lilac" },
  { initials: "EN", name: "Enceinte nomade en lin", sold: "26 ventes", amount: "1 557 €", color: "peach" },
  { initials: "CC", name: "Câble tressé USB-C", sold: "19 ventes", amount: "475 €", color: "green" },
];

export default function VendorHome() {
  return (
    <DashboardShell role="vendor">
      <section className="dashboard-page-heading" id="overview">
        <div>
          <p className="dashboard-eyebrow">LUNDI 16 NOVEMBRE 2026</p>
          <h1>Bonjour Anass <span aria-hidden="true">✦</span></h1>
          <p className="dashboard-subtitle">Voici ce qui se passe dans votre boutique aujourd’hui.</p>
        </div>
        <a className="dashboard-primary-button" href="#products">Gérer mes produits <span aria-hidden="true">→</span></a>
      </section>

      <div className="demo-notice">
        <span aria-hidden="true">i</span>
        <p><strong>Aperçu de votre espace</strong> — Les chiffres et commandes affichés sont des exemples, en attendant la connexion aux données de votre boutique.</p>
      </div>

      <section className="metric-grid" aria-label="Indicateurs de la boutique">
        <article className="metric-card">
          <div className="metric-topline"><span>Chiffre d’affaires</span><span className="metric-icon green-icon">€</span></div>
          <strong className="metric-value">8 240,50 €</strong>
          <div className="metric-foot"><span className="metric-change">↗ 12,8 %</span><span>vs. mois dernier</span></div>
          <div className="metric-sparkline green-line" aria-hidden="true"><i /></div>
        </article>
        <article className="metric-card">
          <div className="metric-topline"><span>Commandes reçues</span><span className="metric-icon blue-icon">▤</span></div>
          <strong className="metric-value">142</strong>
          <div className="metric-foot"><span className="metric-change">↗ 8,2 %</span><span>vs. mois dernier</span></div>
          <div className="metric-sparkline blue-line" aria-hidden="true"><i /></div>
        </article>
        <article className="metric-card">
          <div className="metric-topline"><span>Panier moyen</span><span className="metric-icon orange-icon">↗</span></div>
          <strong className="metric-value">58,03 €</strong>
          <div className="metric-foot"><span className="metric-change">↗ 3,1 %</span><span>vs. mois dernier</span></div>
          <div className="metric-sparkline orange-line" aria-hidden="true"><i /></div>
        </article>
        <article className="metric-card">
          <div className="metric-topline"><span>À expédier</span><span className="metric-icon yellow-icon">◷</span></div>
          <strong className="metric-value">6</strong>
          <div className="metric-foot"><a className="metric-action" href="#orders">Voir les commandes <span aria-hidden="true">→</span></a></div>
          <div className="metric-sparkline yellow-line" aria-hidden="true"><i /></div>
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="panel sales-panel">
          <div className="panel-heading">
            <div><h2>Ventes</h2><p>Suivez les performances de votre boutique</p></div>
            <span className="period-label">30 derniers jours</span>
          </div>
          <div className="chart-summary"><strong>8 240,50 €</strong><span>↗ 12,8 %</span></div>
          <div className="sales-chart">
            <div className="chart-y-labels"><span>3 000 €</span><span>2 000 €</span><span>1 000 €</span><span>0 €</span></div>
            <svg viewBox="0 0 640 180" role="img" aria-label="Courbe des ventes sur les 30 derniers jours">
              <defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5d9b7c" stopOpacity=".22" /><stop offset="100%" stopColor="#5d9b7c" stopOpacity="0" /></linearGradient></defs>
              <path className="chart-grid-line" d="M0 16H640M0 65H640M0 114H640M0 163H640" />
              <path d="M0 143C25 134 34 146 55 130S89 128 108 116 142 122 163 103 196 117 217 93 251 102 271 80 307 91 325 73 359 80 379 61 410 77 434 48 463 65 487 42 521 56 542 31 576 46 593 24 623 36 640 15V175H0Z" fill="url(#salesFill)" />
              <path className="chart-sales-line" d="M0 143C25 134 34 146 55 130S89 128 108 116 142 122 163 103 196 117 217 93 251 102 271 80 307 91 325 73 359 80 379 61 410 77 434 48 463 65 487 42 521 56 542 31 576 46 593 24 623 36 640 15" />
              <circle cx="640" cy="15" r="4" className="chart-last-point" />
            </svg>
          </div>
          <div className="chart-x-labels"><span>18 oct.</span><span>25 oct.</span><span>1 nov.</span><span>8 nov.</span><span>15 nov.</span></div>
        </article>

        <article className="panel payout-panel" id="payouts">
          <div className="panel-heading"><div><h2>Prochain versement</h2><p>Votre solde vendeur</p></div><span className="payout-status">En cours</span></div>
          <div className="payout-total">2 486,20 €</div>
          <p className="payout-caption">Estimation du prochain virement</p>
          <div className="payout-progress"><span /></div>
          <div className="payout-dates"><span>En cours de validation</span><strong>Prévu le 23 nov.</strong></div>
          <div className="payout-divider" />
          <a className="panel-link" href="#orders">Voir l’historique des paiements <span aria-hidden="true">→</span></a>
        </article>
      </section>

      <section className="dashboard-main-grid lower-grid">
        <article className="panel orders-panel" id="orders">
          <div className="panel-heading">
            <div><h2>Commandes récentes</h2><p>Les dernières commandes de votre boutique</p></div>
            <a className="panel-link" href="#orders">Tout voir <span aria-hidden="true">→</span></a>
          </div>
          <div className="table-scroll">
            <table className="dashboard-table">
              <thead><tr><th>Commande</th><th>Client</th><th>Article</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="order-id">{order.id}<small>{order.date}</small></td>
                    <td>{order.customer}</td>
                    <td>{order.item}</td>
                    <td className="table-amount">{order.amount}</td>
                    <td><span className={`status-pill ${order.tone}`}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel best-sellers-panel" id="products">
          <div className="panel-heading"><div><h2>Vos meilleures ventes</h2><p>Ce mois-ci</p></div><a className="panel-link" href="#products">Détails <span aria-hidden="true">→</span></a></div>
          <div className="best-seller-list">
            {bestSellers.map((product, index) => (
              <div className="best-seller-row" key={product.name}>
                <span className="seller-rank">0{index + 1}</span>
                <span className={`product-initials ${product.color}`}>{product.initials}</span>
                <span className="best-seller-info"><strong>{product.name}</strong><small>{product.sold}</small></span>
                <strong className="best-seller-amount">{product.amount}</strong>
              </div>
            ))}
          </div>
          <a className="store-health" id="store" href="#products">
            <span className="health-icon">✦</span>
            <span><strong>Votre boutique est en forme</strong><small>Complétez votre profil pour gagner en visibilité.</small></span>
            <span aria-hidden="true">→</span>
          </a>
        </article>
      </section>
    </DashboardShell>
  );
}
