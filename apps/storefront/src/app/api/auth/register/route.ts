import { getDatabase } from "@/lib/d1";
import { createSession, hashPasswordParts, isCloudflareRateLimited, sessionCookie } from "@/lib/auth";
import { isSameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });

  const body = input as Record<string, unknown>;
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const acceptedTerms = body.acceptedTerms === true;
  if (!acceptedTerms) return Response.json({ error: "Please accept the terms and conditions to create an account." }, { status: 400 });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
    return Response.json({ error: "Enter your first and last name (100 characters maximum)." }, { status: 400 });
  }
  if (password.length === 0 || password.length > 128) {
    return Response.json({ error: "Enter a password of 128 characters or fewer." }, { status: 400 });
  }
  if (await isCloudflareRateLimited(request, "REGISTER_RATE_LIMITER", email)) {
    return Response.json({ error: "Too many registration attempts. Please wait and try again." }, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }

  const db = await getDatabase();
  if (!db) return Response.json({ error: "User database is unavailable." }, { status: 503 });
  const id = crypto.randomUUID();
  try {
    const passwordParts = await hashPasswordParts(password);
    try {
      await db.prepare(`INSERT INTO users (id, email, first_name, last_name, password_salt, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 'customer', 1)`).bind(id, email, firstName, lastName, passwordParts.salt, passwordParts.hash).run();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/no column named|has no column named/i.test(message)) throw error;
      await db.prepare(`INSERT INTO users (id, email, password_hash, role, status)
        VALUES (?, ?, ?, 'customer', 'active')`).bind(id, email, `${passwordParts.salt}.${passwordParts.hash}`).run();
    }
    const token = await createSession(db, id);
    return Response.json({ user: { id, email, role: "customer", firstName, lastName } }, {
      status: 201,
      headers: { "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:"), "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create account";
    console.error("Customer registration failed", error);
    if (/unique|constraint/i.test(message)) {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return Response.json({ error: "Could not create account. Please try again." }, { status: 500 });
  }
}
