import { getDatabase, getRuntimeEnv } from "@/lib/d1";
import { createSession, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type Provider = "google" | "github" | "microsoft";
const providers: Provider[] = ["google", "github", "microsoft"];
const stateCookie = "magnitech_oauth_state";

function redirect(url: string, cookies: string[] = []) {
  const headers = new Headers({ Location: url, "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function cookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  if (!providers.includes(rawProvider as Provider)) return Response.json({ error: "Unknown sign-in provider." }, { status: 404 });
  const provider = rawProvider as Provider;
  const env = await getRuntimeEnv();
  const prefix = `OAUTH_${provider.toUpperCase()}`;
  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  if (typeof clientId !== "string" || typeof clientSecret !== "string" || !clientId || !clientSecret) {
    return redirect(new URL(`/login?oauth_error=${encodeURIComponent(`${provider} is not configured yet`)}`, request.url).toString());
  }

  const url = new URL(request.url);
  const callback = new URL(url.pathname, url.origin).toString();
  const state = crypto.randomUUID() + crypto.randomUUID();
  const secure = url.protocol === "https:" ? "; Secure" : "";

  if (!url.searchParams.has("code")) {
    const authorization = provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : provider === "github"
        ? new URL("https://github.com/login/oauth/authorize")
        : new URL(`https://login.microsoftonline.com/${encodeURIComponent(String(env.OAUTH_MICROSOFT_TENANT ?? "common"))}/oauth2/v2.0/authorize`);
    authorization.searchParams.set("client_id", clientId);
    authorization.searchParams.set("redirect_uri", callback);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("scope", provider === "google" ? "openid email profile" : provider === "github" ? "read:user user:email" : "openid email profile User.Read");
    return redirect(authorization.toString(), [`${stateCookie}=${state}; HttpOnly; Path=/api/auth/oauth; SameSite=Lax; Max-Age=600${secure}`]);
  }

  const returnedState = url.searchParams.get("state") ?? "";
  const savedState = cookieValue(request, stateCookie);
  const clearStateCookie = `${stateCookie}=; HttpOnly; Path=/api/auth/oauth; SameSite=Lax; Max-Age=0${secure}`;
  if (!savedState || savedState !== returnedState) return redirect(new URL("/login?oauth_error=invalid+state", url.origin).toString(), [clearStateCookie]);

  const db = await getDatabase();
  if (!db) return redirect(new URL("/login?oauth_error=database+unavailable", url.origin).toString(), [clearStateCookie]);
  try {
    const tokenResponse = await fetch(provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : provider === "github"
        ? "https://github.com/login/oauth/access_token"
        : `https://login.microsoftonline.com/${encodeURIComponent(String(env.OAUTH_MICROSOFT_TENANT ?? "common"))}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: url.searchParams.get("code") ?? "", redirect_uri: callback, grant_type: "authorization_code" }),
    });
    if (!tokenResponse.ok) throw new Error("OAuth token exchange failed");
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("OAuth provider did not return an access token");

    let subject = "", email = "", firstName = "", lastName = "", verified = false;
    if (provider === "google") {
      const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
      const profile = await response.json() as { sub?: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string };
      subject = profile.sub ?? ""; email = profile.email?.trim().toLowerCase() ?? ""; verified = profile.email_verified === true; firstName = profile.given_name ?? ""; lastName = profile.family_name ?? "";
    } else if (provider === "github") {
      const [profileResponse, emailResponse] = await Promise.all([
        fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }),
        fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }),
      ]);
      const profile = await profileResponse.json() as { id?: number; name?: string; login?: string };
      const emails = await emailResponse.json() as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
      const primary = emails.find((item) => item.primary && item.verified);
      subject = profile.id ? String(profile.id) : ""; email = primary?.email?.trim().toLowerCase() ?? ""; verified = Boolean(primary);
      const names = (profile.name ?? profile.login ?? "").split(/\s+/); firstName = names.shift() ?? ""; lastName = names.join(" ");
    } else {
      const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", { headers: { Authorization: `Bearer ${token.access_token}` } });
      const profile = await response.json() as { id?: string; displayName?: string; mail?: string | null; userPrincipalName?: string };
      const names = (profile.displayName ?? "").split(/\s+/); firstName = names.shift() ?? ""; lastName = names.join(" ");
      subject = profile.id ?? ""; email = (profile.mail ?? profile.userPrincipalName ?? "").trim().toLowerCase(); verified = Boolean(email);
    }
    if (!subject || !verified || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A verified email address is required from the identity provider");

    const identity = await db.prepare("SELECT user_id FROM auth_identities WHERE provider = ? AND provider_user_id = ? LIMIT 1").bind(provider, subject).all<{ user_id: string }>();
    let userId = identity.results?.[0]?.user_id;
    if (!userId) {
      const existing = await db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).all<{ id: string }>();
      userId = existing.results?.[0]?.id;
      if (!userId) {
        userId = crypto.randomUUID();
        await db.prepare("INSERT INTO users (id, email, first_name, last_name, role, is_active, email_verified_at) VALUES (?, ?, ?, ?, 'customer', 1, CURRENT_TIMESTAMP)")
          .bind(userId, email, firstName.slice(0, 100), lastName.slice(0, 100)).run();
      }
      await db.prepare("INSERT INTO auth_identities (id, user_id, provider, provider_user_id) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), userId, provider, subject).run();
    }
    await db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(userId).run();
    const session = await createSession(db, userId);
    return redirect(new URL("/shop", url.origin).toString(), [clearStateCookie, sessionCookie(session, url.protocol === "https:")]);
  } catch {
    return redirect(new URL("/login?oauth_error=sign-in+failed", url.origin).toString(), [clearStateCookie]);
  }
}
