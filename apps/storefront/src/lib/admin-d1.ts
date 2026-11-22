import type { D1Database } from "@/lib/d1";

export const ADMIN_D1_TABLES = [
  "products",
  "product_images",
  "users",
  "wholesaler_profiles",
  "user_sessions",
  "orders",
  "vendor_orders",
  "order_items",
] as const;

export type AdminD1TableName = (typeof ADMIN_D1_TABLES)[number];

export type AdminD1Column = {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
};

export type AdminD1Relationship = {
  column: string;
  targetTable: string;
  targetColumn: string;
  onDelete: string;
};

export type AdminD1Table = {
  name: AdminD1TableName;
  description: string;
  columns: AdminD1Column[];
  relationships: AdminD1Relationship[];
};

const descriptions: Record<AdminD1TableName, string> = {
  products: "Catalogue des produits, prix, stock et état de modération.",
  product_images: "Images publiques des produits, ordonnées par position.",
  users: "Comptes client, grossiste et administrateur. Le mot de passe est géré séparément.",
  wholesaler_profiles: "Informations professionnelles et validation des grossistes.",
  user_sessions: "Sessions d’authentification. Les jetons sont masqués et ne peuvent pas être modifiés ici.",
  orders: "Commandes client, coordonnées de livraison et montants figés.",
  vendor_orders: "Sous-commandes réparties par grossiste.",
  order_items: "Lignes de commande et copies des prix au moment de l’achat.",
};

type ColumnRow = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };
type ForeignKeyRow = { table: string; from: string; to: string; on_delete: string };
type TableRow = { name: string };

export function isAdminD1Table(value: string): value is AdminD1TableName {
  return (ADMIN_D1_TABLES as readonly string[]).includes(value);
}

export function quoteD1Identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function getAdminD1Table(db: D1Database, name: string): Promise<AdminD1Table | null> {
  if (!isAdminD1Table(name)) return null;
  const exists = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1")
    .bind(name).all<TableRow>();
  if (!exists.results?.length) return null;

  const identifier = quoteD1Identifier(name);
  const [{ results: columnRows = [] }, { results: foreignKeys = [] }] = await Promise.all([
    db.prepare(`PRAGMA table_info(${identifier})`).all<ColumnRow>(),
    db.prepare(`PRAGMA foreign_key_list(${identifier})`).all<ForeignKeyRow>(),
  ]);

  return {
    name,
    description: descriptions[name],
    columns: columnRows.map((column) => ({
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
}

export async function listAdminD1Tables(db: D1Database): Promise<AdminD1Table[]> {
  const tables = await Promise.all(ADMIN_D1_TABLES.map((name) => getAdminD1Table(db, name)));
  return tables.filter((table): table is AdminD1Table => table !== null);
}
