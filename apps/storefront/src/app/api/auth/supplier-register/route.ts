import { hashPassword, isSameOrigin } from "@/lib/auth";
import { getDatabase } from "@/lib/d1";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = input as Record<string, unknown>;
  const text = (key: string, max: number) => typeof body[key] === "string" ? body[key].trim() : "";
  const email = text("email", 254).toLowerCase(), password = typeof body.password === "string" ? body.password : "";
  const companyName = text("companyName", 160), phone = text("phone", 40);
  const businessAddress = text("businessAddress", 500), businessDescription = text("businessDescription", 3000);
  const website = text("website", 300), businessRegistration = text("businessRegistration", 120);
  if ([companyName,phone,businessAddress,businessDescription].some((value) => !value)) return Response.json({ error: "Complete all required business details." }, { status: 400 });
  if (companyName.length > 160 || phone.length > 40 || businessAddress.length > 500 || businessDescription.length > 3000 || website.length > 300 || businessRegistration.length > 120) return Response.json({ error: "One or more fields are too long." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) return Response.json({ error: "Enter a valid email and a password of at least 12 characters." }, { status: 400 });
  if (website && !/^https:\/\//i.test(website)) return Response.json({ error: "The business website must start with https://." }, { status: 400 });
  const db = await getDatabase();
  if (!db) return Response.json({ error: "Supplier database is unavailable." }, { status: 503 });
  const id = crypto.randomUUID(), requestId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    await db.batch([
      db.prepare("INSERT INTO users (id,email,password_hash,role,status) VALUES (?,?,?,'wholesaler','active')")
        .bind(id,email,passwordHash),
      db.prepare(`INSERT INTO wholesaler_profiles (id,user_id,business_name,legal_name,phone,address,status,rejection_reason)
        VALUES (?,?,?,?,?,?,'pending',?)`).bind(requestId,id,companyName,businessRegistration || null,phone,businessAddress,businessDescription),
    ]);
    return Response.json({ status: "pending", message: "Your supplier application was received. You can sign in after an administrator approves it." }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit application.";
    if (/unique|constraint/i.test(message)) return Response.json({ error: "An account or supplier application already exists for this email." }, { status: 409 });
    return Response.json({ error: "Could not submit application. Please try again." }, { status: 500 });
  }
}
