import { hashPassword, isCloudflareRateLimited, isSameOrigin } from "@/lib/auth";
import { getDatabase, getRuntimeEnv } from "@/lib/d1";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = input as Record<string, unknown>;
  const text = (key: string) => typeof body[key] === "string" ? body[key].trim() : "";
  const email = text("email").toLowerCase(), password = typeof body.password === "string" ? body.password : "";
  const companyName = text("companyName"), phone = text("phone");
  const businessAddress = text("businessAddress");
  const businessRegistration = text("businessRegistration");
  if ([companyName, phone, businessAddress].some((value) => !value)) return Response.json({ error: "Complete all required business details." }, { status: 400 });
  if (companyName.length > 160 || phone.length > 40 || businessAddress.length > 500 || businessRegistration.length > 120) return Response.json({ error: "One or more fields are too long." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length === 0 || password.length > 128) return Response.json({ error: "Enter a valid email and a password of 128 characters or fewer." }, { status: 400 });
  if (await isCloudflareRateLimited(request, "REGISTER_RATE_LIMITER", email)) return Response.json({ error: "Too many registration attempts. Please try again later." }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  const db = await getDatabase();
  if (!db) return Response.json({ error: "Supplier database is unavailable." }, { status: 503 });
  const id = crypto.randomUUID(), requestId = crypto.randomUUID();
  try {
    const passwordHash = await hashPassword(password);
    await db.batch([
      db.prepare("INSERT INTO users (id,email,password_hash,role,status) VALUES (?,?,?,'wholesaler','active')")
        .bind(id,email,passwordHash),
      db.prepare(`INSERT INTO wholesaler_profiles (id,user_id,business_name,legal_name,phone,address,status)
        VALUES (?,?,?,?,?,?,'pending')`).bind(requestId,id,companyName,businessRegistration || null,phone,businessAddress),
    ]);
    let notificationSent = false;
    try {
      const env = await getRuntimeEnv();
      const endpoint = [env.NEXT_PUBLIC_SUPPLIER_FORM_ENDPOINT, env.NEXT_PUBLIC_ORDER_FORM_ENDPOINT,
        process.env.NEXT_PUBLIC_SUPPLIER_FORM_ENDPOINT, process.env.NEXT_PUBLIC_ORDER_FORM_ENDPOINT]
        .find((value): value is string => typeof value === "string" && /^https:\/\/formsubmit\.co\/ajax\//i.test(value));
      if (endpoint) {
        const notification = await fetch(endpoint, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            _subject: `MAGNITECH supplier application pending — ${companyName}`,
            _template: "table",
            type: "New supplier registration",
            email,
            companyName,
            phone,
            businessAddress,
            businessRegistration: businessRegistration || "Not provided",
            status: "Pending admin approval",
          }),
          signal: AbortSignal.timeout(5000),
        });
        const receipt = await notification.json().catch(() => null) as { success?: unknown } | null;
        notificationSent = notification.ok && (receipt?.success === true || receipt?.success === "true");
      }
    } catch {
      // The application is already safely stored; the admin list remains the source of truth.
    }
    return Response.json({ status: "pending", notificationSent, message: notificationSent
      ? "Your supplier application was received and is pending admin approval. The store has been notified."
      : "Your supplier application was saved and is pending admin approval. The store notification could not be sent; an administrator can still review it in the dashboard." }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit application.";
    console.error("Supplier registration failed", error);
    if (/unique|constraint/i.test(message)) return Response.json({ error: "An account or supplier application already exists for this email." }, { status: 409 });
    return Response.json({ error: "Could not submit application. Please try again." }, { status: 500 });
  }
}
