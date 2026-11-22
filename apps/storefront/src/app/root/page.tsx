"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { readJsonResponse } from "@/lib/api-response";
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

type Row = Record<string, unknown>;
const PAGE_SIZE = 50;
const SECRET_COLUMNS = new Set(["password_hash", "token_hash"]);
const USER_TIMESTAMP_COLUMNS = new Set(["created_at", "updated_at"]);
const USER_STATUS_OPTIONS = new Set(["active", "disabled"]);
const BOOLEAN_COLUMNS = new Set(["in_stock", "featured", "published"]);

function displayValue(name: string, value: unknown) {
  if (SECRET_COLUMNS.has(name)) return "Protégé";
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isBooleanColumn(column: SchemaColumn) {
  return BOOLEAN_COLUMNS.has(column.name) && /INT|BOOL/i.test(column.type);
}

function formatColumnLabel(column: SchemaColumn) {
  return `${column.name}${column.primaryKey ? " · clé primaire" : ""}${column.nullable ? " · facultatif" : " · requis"}`;
}

export default function SchemaExplorerPage() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [activeTableName, setActiveTableName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [editingKey, setEditingKey] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const activeTable = useMemo(() => tables.find((table) => table.name === activeTableName) ?? null, [tables, activeTableName]);
  const primaryKey = activeTable?.columns.find((column) => column.primaryKey) ?? null;

  useEffect(() => {
    fetch("/api/admin/schema", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return;
        const body = await readJsonResponse<{ tables?: SchemaTable[]; error?: string }>(response);
        if (!response.ok) throw new Error(body.error || "Could not read the D1 schema.");
        const availableTables = body.tables ?? [];
        setTables(availableTables);
        setActiveTableName(availableTables[0]?.name ?? "");
        setAuthenticated(true);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not connect to D1."))
      .finally(() => setLoading(false));
  }, []);

  const loadRows = useCallback(async (tableName: string, nextOffset: number) => {
    if (!tableName) return;
    setRowsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ table: tableName, limit: String(PAGE_SIZE), offset: String(nextOffset) });
      const response = await fetch(`/api/admin/data?${params}`, { cache: "no-store" });
      const body = await readJsonResponse<{ rows?: Row[]; total?: number; error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? "Could not load table rows.");
      setRows(body.rows ?? []);
      setTotal(body.total ?? 0);
      setOffset(nextOffset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load table rows.");
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated && activeTableName) void loadRows(activeTableName, offset);
  }, [authenticated, activeTableName, loadRows, offset]);

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.assign("/admin");
  }

  function switchTable(tableName: string) {
    setActiveTableName(tableName);
    setOffset(0);
    setRows([]);
    setFormMode(null);
    setNotice("");
    setError("");
  }

  function createRow() {
    if (!activeTable) return;
    const values: Record<string, string> = {};
    for (const column of activeTable.columns) values[column.name] = "";
    if (activeTable.name === "users") {
      values.role = "customer";
      values.status = "active";
    }
    setFormValues(values);
    setPassword("");
    setEditingKey(null);
    setFormMode("create");
    setNotice("");
    setError("");
  }

  function editRow(row: Row) {
    if (!activeTable || !primaryKey) return;
    const values: Record<string, string> = {};
    for (const column of activeTable.columns) {
      const value = row[column.name];
      values[column.name] = value === null || value === undefined ? "" : String(value);
    }
    setFormValues(values);
    setPassword("");
    setEditingKey(row[primaryKey.name]);
    setFormMode("edit");
    setNotice("");
    setError("");
  }

  async function saveRow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTable || !formMode) return;
    setSaving(true);
    setError("");
    setNotice("");
    const values: Record<string, unknown> = {};
    for (const column of activeTable.columns) {
      if (SECRET_COLUMNS.has(column.name) || (formMode === "edit" && column.primaryKey) || (activeTable.name === "users" && USER_TIMESTAMP_COLUMNS.has(column.name))) continue;
      const value = formValues[column.name] ?? "";
      if (formMode === "create" && value === "" && column.defaultValue !== null) continue;
      if (value === "" && column.nullable) {
        values[column.name] = null;
      } else if (/^(INTEGER|REAL|NUMERIC|BOOLEAN)/i.test(column.type) && value !== "") {
        values[column.name] = Number(value);
      } else {
        values[column.name] = value;
      }
    }
    const payload = {
      table: activeTable.name,
      values,
      ...(activeTable.name === "users" ? { password } : {}),
      ...(formMode === "edit" ? { primaryKeyValue: editingKey } : {}),
    };
    try {
      const response = await fetch("/api/admin/data", {
        method: formMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? "Could not save this row.");
      setFormMode(null);
      setNotice(formMode === "create" ? "Ligne créée dans D1." : "Ligne mise à jour dans D1.");
      await loadRows(activeTable.name, offset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this row.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: Row) {
    if (!activeTable || !primaryKey) return;
    const key = row[primaryKey.name];
    if (!window.confirm(`Supprimer définitivement cette ligne de ${activeTable.name} (${primaryKey.name}: ${String(key)}) ? Des lignes liées peuvent aussi être supprimées selon leurs relations.`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: activeTable.name, primaryKeyValue: key }),
      });
      const body = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? "Could not delete this row.");
      setNotice("Ligne supprimée de D1.");
      await loadRows(activeTable.name, offset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this row.");
    }
  }

  if (loading) return <main className={`page-wrap ${styles.page}`}><p role="status">Lecture du schéma D1…</p></main>;

  if (!authenticated) {
    return <main className={`page-wrap ${styles.page}`}>
      <p className="overline">ESPACE ADMINISTRATEUR</p>
      <h1>Gestion de la base<span className="title-period">.</span></h1>
      <p className={styles.intro}>Connecte-toi avec la session administrateur pour gérer les tables métier de D1.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      <Link href="/admin" className="button dark-button">Ouvrir la connexion admin <span>↗</span></Link>
    </main>;
  }

  return <main className={`page-wrap ${styles.page}`}>
    <div className={styles.heading}>
      <div><p className="overline">MAGNITECH · D1</p><h1>Gestion de la base<span className="title-period">.</span></h1></div>
      <div className={styles.actions}><span>{tables.length} tables métier</span><button className="text-button" onClick={() => void signOut()}>Déconnexion</button></div>
    </div>

    <p className={styles.intro}>Gère les lignes de chaque table métier. La structure D1 et l’historique des migrations restent protégés. Les valeurs de mots de passe et de jetons de session sont masquées.</p>

    <nav className={styles.tabs} aria-label="Tables D1">
      {tables.map((table) => <button key={table.name} className={activeTableName === table.name ? styles.activeTab : ""} onClick={() => switchTable(table.name)}>{table.name}</button>)}
    </nav>

    {activeTable && <>
      <section className={styles.tableInfo}>
        <div><h2>{activeTable.name}</h2><p>{activeTable.description}</p></div>
        <div className={styles.tableActions}>
          <span>{total} lignes</span>
          <button className="text-button" disabled={rowsLoading} onClick={() => void loadRows(activeTable.name, offset)}>Actualiser</button>
          {activeTable.name !== "user_sessions" && <button className="button dark-button" onClick={createRow}>+ Ajouter une ligne</button>}
        </div>
        {activeTable.relationships.length > 0 && <ul className={styles.relations}>
          {activeTable.relationships.map((relation) => <li key={`${relation.column}-${relation.targetTable}`}><code>{activeTable.name}.{relation.column}</code> → <code>{relation.targetTable}.{relation.targetColumn}</code> <small>(ON DELETE {relation.onDelete})</small></li>)}
        </ul>}
      </section>

      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}

      {formMode && <section className={styles.editor}>
        <div className={styles.editorHeading}><div><p className="overline">{formMode === "create" ? "NOUVELLE LIGNE" : "MODIFIER LA LIGNE"}</p><h2>{activeTable.name}</h2></div><button className="text-button" type="button" onClick={() => setFormMode(null)}>Annuler</button></div>
        <form className={styles.form} onSubmit={saveRow}>
          {activeTable.columns.filter((column) => !SECRET_COLUMNS.has(column.name) && !(activeTable.name === "users" && USER_TIMESTAMP_COLUMNS.has(column.name))).map((column) => {
            const value = formValues[column.name] ?? "";
            const readOnly = formMode === "edit" && column.primaryKey;
            if (activeTable.name === "users" && column.name === "role") return <label className={styles.field} key={column.name}>
              <span>{formatColumnLabel(column)}</span>
              <select value={value} required onChange={(event) => setFormValues((current) => ({ ...current, [column.name]: event.target.value }))}>
                <option value="customer">Client particulier</option>
                <option value="wholesaler">Revendeur</option>
                <option value="admin">Admin</option>
              </select>
            </label>;
            if (activeTable.name === "users" && column.name === "status") return <label className={styles.field} key={column.name}>
              <span>{formatColumnLabel(column)}</span>
              <select value={value} required onChange={(event) => setFormValues((current) => ({ ...current, [column.name]: event.target.value }))}>
                {!USER_STATUS_OPTIONS.has(value) && <option value={value}>{value}</option>}
                <option value="active">Actif</option>
                <option value="disabled">Désactivé</option>
              </select>
            </label>;
            if (isBooleanColumn(column)) return <label className={styles.checkboxField} key={column.name}>
              <input type="checkbox" checked={value === "1" || value === "true"} disabled={readOnly} onChange={(event) => setFormValues((current) => ({ ...current, [column.name]: event.target.checked ? "1" : "0" }))}/>
              <span>{formatColumnLabel(column)}</span>
            </label>;
            const longText = /TEXT|JSON/i.test(column.type) && ["description", "specs", "address", "delivery_instructions", "rejection_reason"].includes(column.name);
            const common = {
              value,
              readOnly,
              required: !column.nullable && column.defaultValue === null,
              onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormValues((current) => ({ ...current, [column.name]: event.target.value })),
            };
            return <label className={longText ? `${styles.field} ${styles.wideField}` : styles.field} key={column.name}>
              <span>{formatColumnLabel(column)} <small>{column.type}{column.defaultValue !== null ? ` · défaut ${column.defaultValue}` : ""}</small></span>
              {longText ? <textarea {...common} rows={column.name === "description" ? 4 : 3}/> : <input {...common} type={/^(INTEGER|REAL|NUMERIC)/i.test(column.type) ? "number" : "text"} step={/REAL|NUMERIC/i.test(column.type) ? "any" : undefined}/>}
            </label>;
          })}
          {activeTable.name === "users" && <label className={styles.field}>
            <span>Mot de passe <small>12 à 128 caractères{formMode === "edit" ? " · laisse vide pour le conserver" : " · obligatoire"}</small></span>
            <input type="password" value={password} minLength={formMode === "create" ? 12 : undefined} maxLength={128} required={formMode === "create"} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)}/>
          </label>}
          {activeTable.name === "users" && <p className={styles.protectedNote}>Les dates de création et de modification sont gérées automatiquement par D1.</p>}
          {activeTable.columns.some((column) => SECRET_COLUMNS.has(column.name)) && <p className={styles.protectedNote}>Les colonnes de hash d’authentification ne sont pas exposées. Pour les comptes, définis le mot de passe avec le champ dédié.</p>}
          <div className={styles.formButtons}><button className="text-button" type="button" onClick={() => setFormMode(null)}>Annuler</button><button className="button dark-button" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button></div>
        </form>
      </section>}

      <div className={styles.rowTableWrap}>
        {rowsLoading ? <p role="status">Chargement des lignes…</p> : rows.length === 0 ? <p className={styles.empty}>Aucune ligne dans cette table.</p> : <table className={styles.rowTable}>
          <thead><tr>{activeTable.columns.map((column) => <th key={column.name}>{column.name}</th>)}<th>Actions</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${String(row[primaryKey?.name ?? "id"])}-${index}`}>
            {activeTable.columns.map((column) => <td key={column.name} title={displayValue(column.name, row[column.name])}><span>{displayValue(column.name, row[column.name])}</span></td>)}
            <td className={styles.rowActions}>{activeTable.name !== "user_sessions" && <button onClick={() => editRow(row)}>Modifier</button>}<button className={styles.deleteButton} onClick={() => void deleteRow(row)}>{activeTable.name === "user_sessions" ? "Révoquer" : "Supprimer"}</button></td>
          </tr>)}</tbody>
        </table>}
      </div>
      <div className={styles.pagination}>
        <button className="text-button" disabled={offset === 0 || rowsLoading} onClick={() => void loadRows(activeTable.name, Math.max(0, offset - PAGE_SIZE))}>← Précédent</button>
        <span>{total === 0 ? "0" : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}`} sur {total}</span>
        <button className="text-button" disabled={offset + PAGE_SIZE >= total || rowsLoading} onClick={() => void loadRows(activeTable.name, offset + PAGE_SIZE)}>Suivant →</button>
      </div>
    </>}
  </main>;
}
