import { getAdminSettings } from "@/lib/d1";

export const ADMIN_COOKIE = "magnitech_admin";
const SESSION_SECONDS = 60 * 60 * 12;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function createAdminSession(): Promise<string | null> {
  const { sessionSecret } = await getAdminSettings();
  if (!sessionSecret) return null;
  const payload = toBase64Url(new TextEncoder().encode(String(Date.now() + SESSION_SECONDS * 1000)));
  return `${payload}.${toBase64Url(await hmac(sessionSecret, payload))}`;
}

export async function isValidAdminSession(request: Request): Promise<boolean> {
  const { sessionSecret } = await getAdminSettings();
  if (!sessionSecret) return false;
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  const token = cookie?.slice(ADMIN_COOKIE.length + 1);
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  try {
    const actual = fromBase64Url(signature);
    if (!crypto.subtle.verify) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(sessionSecret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, actual, new TextEncoder().encode(payload));
    return valid && Number(new TextDecoder().decode(fromBase64Url(payload))) > Date.now();
  } catch {
    return false;
  }
}

export function sessionCookie(value: string, secure: boolean): string {
  return `${ADMIN_COOKIE}=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearedSessionCookie(secure: boolean): string {
  return `${ADMIN_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(input)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  return a.reduce((diff, byte, index) => diff | (byte ^ b[index]), 0) === 0;
}
