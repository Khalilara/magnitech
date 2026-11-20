import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<T[]>;
}

export async function getDatabase(): Promise<D1Database | null> {
  const { env } = getCloudflareContext();
  return ((env as Record<string, unknown>).MAGHITECH_DB as D1Database | undefined) ?? null;
}

export function getApiOrigin(): string {
  const configured = process.env.API_INTERNAL_URL ?? process.env.API_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const { env } = getCloudflareContext();
  const values = env as Record<string, unknown>;
  const runtimeValue = values.API_INTERNAL_URL ?? values.API_URL;
  if (typeof runtimeValue !== "string" || !runtimeValue.trim()) {
    throw new Error("API_INTERNAL_URL or API_URL must be configured for admin session verification");
  }
  return runtimeValue.replace(/\/+$/, "");
}
