import { isValidAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/d1";

export const dynamic = "force-dynamic";

type TableRow = { name: string; sql: string | null };
type ColumnRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};
type ForeignKeyRow = {
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
};

const descriptions: Record<string, string> = {
  users: "Identifiants des comptes et rôle global : administrateur, client ou grossiste.",
  wholesaler_profiles: "Informations professionnelles et état de validation de chaque grossiste.",
  user_sessions: "Sessions d’authentification : seul le hash du jeton est stocké.",
  products: "Catalogue des produits, prix, stock et état de modération.",
  product_images: "Images d’un produit, ordonnées par position.",
  orders: "Commande complète du client, coordonnées et adresse de livraison figées, montants et statuts.",
  vendor_orders: "Sous-commande utilisée pour séparer la préparation par grossiste.",
  order_items: "Lignes de commande avec copies du nom et du prix au moment de l’achat.",
  d1_migrations: "Historique des migrations appliquées à cette base par Wrangler.",
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  if (!(await isValidAdminSession(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const db = await getDatabase();
    if (!db) {
      return Response.json({ error: "D1 binding MAGHITECH_DB is not configured" }, { status: 503 });
    }

    const { results: tables = [] } = await db.prepare(`
      SELECT name, sql FROM sqlite_master
      WHERE type = 'table'
        AND substr(name, 1, 7) <> 'sqlite_'
        AND substr(name, 1, 4) <> '_cf_'
      ORDER BY name
    `).all<TableRow>();

    const schema = await Promise.all(tables.map(async (table) => {
      const identifier = quoteIdentifier(table.name);
      const [{ results: columns = [] }, { results: foreignKeys = [] }] = await Promise.all([
        db.prepare(`PRAGMA table_info(${identifier})`).all<ColumnRow>(),
        db.prepare(`PRAGMA foreign_key_list(${identifier})`).all<ForeignKeyRow>(),
      ]);

      return {
        name: table.name,
        description: descriptions[table.name] ?? "Table détectée dans D1. Ajoutez sa description au contrat du schéma.",
        columns: columns.map((column) => ({
          name: column.name,
          type: column.type || "—",
          nullable: column.notnull === 0 && column.pk === 0,
          primaryKey: column.pk > 0,
          defaultValue: column.dflt_value,
        })),
        relationships: foreignKeys.map((key) => ({
          column: key.from,
          targetTable: key.table,
          targetColumn: key.to,
          onDelete: key.on_delete,
        })),
      };
    }));

    return Response.json({ tables: schema }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to read D1 schema metadata", error);
    return Response.json({ error: "Could not read D1 schema metadata" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
