import { hashPassword, isSameOrigin } from "@/lib/auth";
import { isValidAdminSession } from "@/lib/admin-session";
import { getAdminD1Table, quoteD1Identifier } from "@/lib/admin-d1";
import { getDatabase, type D1Database } from "@/lib/d1";

export const dynamic = "force-dynamic";
const PROTECTED_COLUMNS = new Set(["password_hash", "token_hash"]);
const MAX_PAGE_SIZE = 100;

type Values = Record<string, unknown>;

async function authorize(request: Request): Promise<{ db: D1Database } | { response: Response }> {
  if (!(await isValidAdminSession(request))) {
    return { response: Response.json({ error: "Admin authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } }) };
  }
  const db = await getDatabase();
  if (!db) return { response: Response.json({ error: "D1 binding MAGHITECH_DB is not configured." }, { status: 503 }) };
  return { db };
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function normalizeValues(input: unknown, columns: NonNullable<Awaited<ReturnType<typeof getAdminD1Table>>>["columns"], allowPrimaryKey: boolean): Values | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const inputValues = input as Record<string, unknown>;
  const normalized: Values = {};
  const allowedColumns = new Map(columns.filter((column) => (allowPrimaryKey || !column.primaryKey) && !PROTECTED_COLUMNS.has(column.name)).map((column) => [column.name, column]));

  for (const [name, value] of Object.entries(inputValues)) {
    const column = allowedColumns.get(name);
    if (!column || value === undefined || (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")) return null;
    if (value === "" && column.defaultValue !== null && allowPrimaryKey) continue;
    if ((value === "" || value === null) && column.nullable) {
      normalized[name] = null;
      continue;
    }
    if (value === "" && !column.nullable) return null;
    if (/^(INTEGER|REAL|NUMERIC|BOOLEAN)/i.test(column.type) && typeof value === "string") {
      const number = Number(value);
      if (!Number.isFinite(number)) return null;
      normalized[name] = number;
    } else {
      normalized[name] = value;
    }
  }
  return normalized;
}

function primaryKeyColumn(table: NonNullable<Awaited<ReturnType<typeof getAdminD1Table>>>) {
  const keys = table.columns.filter((column) => column.primaryKey);
  return keys.length === 1 ? keys[0] : null;
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const { db } = auth;
  const url = new URL(request.url);
  const tableName = url.searchParams.get("table") ?? "";
  try {
    const table = await getAdminD1Table(db, tableName);
    if (!table) return Response.json({ error: "Unknown or unavailable D1 table." }, { status: 404 });
    const key = primaryKeyColumn(table);
    if (!key) return Response.json({ error: "This table has no supported single-column primary key." }, { status: 400 });
    const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
    const requestedOffset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, requestedLimit)) : 50;
    const offset = Number.isInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0;
    const identifier = quoteD1Identifier(table.name);
    const keyIdentifier = quoteD1Identifier(key.name);
    const [{ results: rows = [] }, { results: counts = [] }] = await Promise.all([
      db.prepare(`SELECT * FROM ${identifier} ORDER BY ${keyIdentifier} LIMIT ? OFFSET ?`).bind(limit, offset).all<Record<string, unknown>>(),
      db.prepare(`SELECT COUNT(*) AS total FROM ${identifier}`).all<{ total: number }>(),
    ]);
    const safeRows = rows.map((row) => Object.fromEntries(Object.entries(row).map(([name, value]) => [name, PROTECTED_COLUMNS.has(name) ? null : value])));
    return Response.json({ table, rows: safeRows, total: counts[0]?.total ?? 0, limit, offset }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to read D1 table rows", error);
    return Response.json({ error: "Could not read rows from D1." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const body = await parseBody(request);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const { db } = auth;
  const tableName = typeof body.table === "string" ? body.table : "";
  try {
    const table = await getAdminD1Table(db, tableName);
    if (!table) return Response.json({ error: "Unknown or unavailable D1 table." }, { status: 404 });
    if (table.name === "user_sessions") return Response.json({ error: "Sessions are created by sign-in. Delete a row to revoke a session." }, { status: 405 });
    const values = normalizeValues(body.values, table.columns, true);
    if (!values) return Response.json({ error: "One or more fields contain invalid values." }, { status: 400 });
    if (table.name === "users") {
      delete values.created_at;
      delete values.updated_at;
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 12 || password.length > 128) return Response.json({ error: "Set a password between 12 and 128 characters." }, { status: 400 });
      values.password_hash = await hashPassword(password);
    }
    const names = Object.keys(values);
    const sql = names.length
      ? `INSERT INTO ${quoteD1Identifier(table.name)} (${names.map(quoteD1Identifier).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`
      : `INSERT INTO ${quoteD1Identifier(table.name)} DEFAULT VALUES`;
    await db.prepare(sql).bind(...names.map((name) => values[name])).run();
    return Response.json({ success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to create D1 row", { tableName, error });
    return Response.json({ error: error instanceof Error ? error.message : "Could not create the row." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const body = await parseBody(request);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const { db } = auth;
  const tableName = typeof body.table === "string" ? body.table : "";
  try {
    const table = await getAdminD1Table(db, tableName);
    if (!table) return Response.json({ error: "Unknown or unavailable D1 table." }, { status: 404 });
    if (table.name === "user_sessions") return Response.json({ error: "Session fields cannot be edited. Delete a row to revoke a session." }, { status: 405 });
    const key = primaryKeyColumn(table);
    if (!key || body.primaryKeyValue === null || body.primaryKeyValue === undefined) return Response.json({ error: "A primary key is required." }, { status: 400 });
    const values = normalizeValues(body.values, table.columns, false);
    if (!values) return Response.json({ error: "One or more fields contain invalid values." }, { status: 400 });
    if (table.name === "users") {
      delete values.created_at;
      delete values.updated_at;
    }
    if (table.name === "users" && typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 12 || body.password.length > 128) return Response.json({ error: "Set a password between 12 and 128 characters." }, { status: 400 });
      values.password_hash = await hashPassword(body.password);
    }
    const names = Object.keys(values);
    if (!names.length && table.name !== "users") return Response.json({ error: "There are no changes to save." }, { status: 400 });
    const assignments = names.map((name) => `${quoteD1Identifier(name)} = ?`);
    if (table.name === "users") assignments.push(`${quoteD1Identifier("updated_at")} = CURRENT_TIMESTAMP`);
    await db.prepare(`UPDATE ${quoteD1Identifier(table.name)} SET ${assignments.join(", ")} WHERE ${quoteD1Identifier(key.name)} = ?`)
      .bind(...names.map((name) => values[name]), body.primaryKeyValue).run();
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to update D1 row", { tableName, error });
    return Response.json({ error: error instanceof Error ? error.message : "Could not update the row." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const body = await parseBody(request);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const { db } = auth;
  const tableName = typeof body.table === "string" ? body.table : "";
  try {
    const table = await getAdminD1Table(db, tableName);
    if (!table) return Response.json({ error: "Unknown or unavailable D1 table." }, { status: 404 });
    const key = primaryKeyColumn(table);
    if (!key || body.primaryKeyValue === null || body.primaryKeyValue === undefined) return Response.json({ error: "A primary key is required." }, { status: 400 });
    await db.prepare(`DELETE FROM ${quoteD1Identifier(table.name)} WHERE ${quoteD1Identifier(key.name)} = ?`)
      .bind(body.primaryKeyValue).run();
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to delete D1 row", { tableName, error });
    return Response.json({ error: error instanceof Error ? error.message : "Could not delete the row." }, { status: 400 });
  }
}
