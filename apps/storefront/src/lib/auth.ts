import { getDatabase, type D1Database } from "@/lib/d1";

export const SESSION_COOKIE = "magnitech_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 600_000;

export type AuthUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "customer" | "admin" | "supplier";
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

export async function hashPassword(password: string, salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))) {
  const saltBytes = new Uint8Array(salt);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: PASSWORD_ITERATIONS }, key, 256,
  );
  return { salt: toBase64Url(saltBytes), hash: toBase64Url(new Uint8Array(bits)) };
}

export async function passwordMatches(password: string, salt: string, expectedHash: string): Promise<boolean> {
  try {
    const derived = await hashPassword(password, fromBase64Url(salt));
    const actual = fromBase64Url(derived.hash);
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
    SELECT u.id, u.email, u.first_name, u.last_name, u.role
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash, Math.floor(Date.now() / 1000)).all<AuthUser>();
  return results[0] ?? null;
}

export async function createSession(db: D1Database, userId: string) {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await db.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, userId, expiresAt).run();
  return token;
}

export async function consumeAuthRateLimit(
  db: D1Database, request: Request, action: string, identity: string, limit: number, windowSeconds: number,
): Promise<boolean> {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const rateKey = await sha256(`${action}:${ip}:${identity}`);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  await db.prepare(`INSERT INTO auth_rate_limits (rate_key, window_started_at, attempts)
    VALUES (?, ?, 1)
    ON CONFLICT(rate_key) DO UPDATE SET
      attempts = CASE WHEN auth_rate_limits.window_started_at <= ? THEN 1 ELSE auth_rate_limits.attempts + 1 END,
      window_started_at = CASE WHEN auth_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE auth_rate_limits.window_started_at END`)
    .bind(rateKey, now, windowStart, windowStart).run();
  const { results = [] } = await db.prepare("SELECT attempts FROM auth_rate_limits WHERE rate_key = ?")
    .bind(rateKey).all<{ attempts: number }>();
  if (Math.random() < 0.01) {
    await db.prepare("DELETE FROM auth_rate_limits WHERE window_started_at < ?").bind(now - 86_400).run();
  }
  return (results[0]?.attempts ?? limit + 1) <= limit;
}

export async function requireAdmin(request: Request): Promise<Response | null> {
  const user = await findCurrentUser(readSessionToken(request));
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (user.role !== "admin") {
    return Response.json({ error: "Administrator access required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}

export async function logoutSession(request: Request) {
  const token = readSessionToken(request);
  if (!token) return;
  const db = await getDatabase();
  if (db) await db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}
