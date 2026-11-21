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

export interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; httpEtag?: string } | null>;
}

export async function getDatabase(): Promise<D1Database | null> {
  const { env } = getCloudflareContext();
  return ((env as Record<string, unknown>).MAGHITECH_DB as D1Database | undefined) ?? null;
}

export async function getRuntimeEnv(): Promise<Record<string, unknown>> {
  const { env } = getCloudflareContext();
  return env as Record<string, unknown>;
}

export async function getAdminSettings() {
  const values = await getRuntimeEnv();
  return {
    password: typeof values.ADMIN_PASSWORD === "string" ? values.ADMIN_PASSWORD : "",
    sessionSecret: typeof values.ADMIN_SESSION_SECRET === "string" ? values.ADMIN_SESSION_SECRET : "",
  };
}
