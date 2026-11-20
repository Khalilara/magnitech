"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./root.module.css";

type SchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
};

type SchemaRelationship = {
  column: string;
  targetTable: string;
  targetColumn: string;
  onDelete: string;
};

type SchemaTable = {
  name: string;
  description: string;
  columns: SchemaColumn[];
  relationships: SchemaRelationship[];
};

export default function SchemaExplorerPage() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/schema", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return;
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Impossible de lire le schéma D1.");
        setTables(body.tables);
        setAuthenticated(true);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Erreur de connexion à D1."))
      .finally(() => setLoading(false));
  }, []);

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.assign("/admin");
  }

  if (loading) {
    return <main className={`page-wrap ${styles.page}`}><p role="status">Lecture du schéma D1…</p></main>;
  }

  if (!authenticated) {
    return <main className={`page-wrap ${styles.page}`}>
      <p className="overline">ESPACE ADMINISTRATEUR</p>
      <h1>Schéma de la base<span className="title-period">.</span></h1>
      <p className={styles.intro}>Cette page présente uniquement les tables et leurs colonnes. Connecte-toi avec la session administrateur pour y accéder.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      <Link href="/admin" className="button dark-button">Ouvrir la connexion admin <span>↗</span></Link>
    </main>;
  }

  return <main className={`page-wrap ${styles.page}`}>
    <div className={styles.heading}>
      <div>
        <p className="overline">MAGNITECH · D1</p>
        <h1>Schéma de la base<span className="title-period">.</span></h1>
      </div>
      <div className={styles.actions}>
        <span>{tables.length} tables</span>
        <button className="text-button" onClick={() => void signOut()}>Déconnexion</button>
      </div>
    </div>

    <p className={styles.intro}>Référence de lecture pour l’équipe : cette page affiche la structure réelle de D1, les relations entre tables et leur rôle. Elle ne montre aucune donnée métier et ne permet aucune modification.</p>

    <div className={styles.tableList}>
      {tables.map((table) => (
        <details className={styles.tableCard} key={table.name}>
          <summary className={styles.summary}>
            <span><strong>{table.name}</strong><small>{table.columns.length} colonnes</small></span>
            <span className={styles.chevron} aria-hidden="true">＋</span>
          </summary>
          <div className={styles.details}>
            <p>{table.description}</p>
            {table.relationships.length > 0 && <section className={styles.relationships}>
              <h2>Relations</h2>
              <ul>{table.relationships.map((relation) => (
                <li key={`${relation.column}-${relation.targetTable}-${relation.targetColumn}`}>
                  <code>{table.name}.{relation.column}</code> → <code>{relation.targetTable}.{relation.targetColumn}</code>
                  <small>Suppression liée : {relation.onDelete}</small>
                </li>
              ))}</ul>
            </section>}
            <div className={styles.columnTableWrap}>
              <table className={styles.columnTable}>
                <thead><tr><th>Colonne</th><th>Type</th><th>Contraintes</th><th>Valeur par défaut</th></tr></thead>
                <tbody>{table.columns.map((column) => (
                  <tr key={column.name}>
                    <td><code>{column.name}</code></td>
                    <td>{column.type}</td>
                    <td>{[column.primaryKey ? "clé primaire" : "", column.nullable ? "nullable" : "requis"].filter(Boolean).join(" · ")}</td>
                    <td>{column.defaultValue ?? "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </details>
      ))}
    </div>
  </main>;
}
