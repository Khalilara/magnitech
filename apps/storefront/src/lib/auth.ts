import { getDatabase, getRuntimeEnv, type D1Database } from "@/lib/d1";

export const SESSION_COOKIE = "magnitech_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 600_000;

export type AuthUser = {
  id: string;
  email: string;
  role: "customer" | "admin" | "wholesaler";
  status: "active" | "pending" | "suspended" | "disabled";
  wholesalerId?: string | null;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return `${toBase64Url(saltBytes)}.${toBase64Url(new Uint8Array(bits))}`;
}

export async function passwordMatches(password: string, storedHash: string): Promise<boolean> {
  const [salt, expectedHash, extra] = storedHash.split(".");
  if (!salt || !expectedHash || extra) return false;
  try {
    const saltBytes = new Uint8Array(Array.from(fromBase64Url(salt)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: PASSWORD_ITERATIONS },
      key,
      256,
    );
    const actual = new Uint8Array(bits);
    const expected = fromBase64Url(expectedHash);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
    return difference === 0;
  } catch {
    return false;
  }
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function readSessionToken(request: Request): string | null {
  const pair = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = pair?.slice(SESSION_COOKIE.length + 1);
  return token && /^[A-Za-z0-9_-]{40,60}$/.test(token) ? token : null;
}

export async function findCurrentUser(token: string | null, db?: D1Database | null): Promise<AuthUser | null> {
  if (!token) return null;
  const database = db ?? await getDatabase();
  if (!database) return null;
  const tokenHash = await sha256(token);
  const { results = [] } = await database.prepare(`
    SELECT u.id, u.email, u.role, u.status, wp.id AS wholesalerId
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN wholesaler_profiles wp ON wp.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ? AND s.revoked_at IS NULL AND u.status = 'active'
    LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).all<AuthUser>();
  return results[0] ?? null;
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.prepare("INSERT INTO user_sessions (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), tokenHash, userId, expiresAt).run();
  return token;
}

export async function requireAdmin(request: Request): Promise<Response | null> {
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (user.role !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return null;
}

export async function logoutSession(request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  const db = await getDatabase();
  if (db) await db.prepare("UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?")
    .bind(await sha256(token)).run();
}

export async function isCloudflareRateLimited(
  request: Request,
  bindingName: "LOGIN_RATE_LIMITER" | "REGISTER_RATE_LIMITER",
  identifier: string,
): Promise<boolean> {
  const env = await getRuntimeEnv();
  const limiter = env[bindingName] as { limit(input: { key: string }): Promise<{ success: boolean }> } | undefined;
  if (!limiter) return false;
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const key = await sha256(`${bindingName}:${ip}:${identifier}`);
  try {
    const result = await limiter.limit({ key });
    return result.success === false;
  } catch {
    return false;
  }
}
