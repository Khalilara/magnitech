import { getDatabase, getRuntimeEnv } from "@/lib/d1";
import { findCurrentUser, isSameOrigin, readSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

type OrderItemInput = { productId: string; quantity: number };
type CheckoutInput = {
  idempotencyKey: string;
  customer: {
    firstName: string; lastName: string; email: string; phone: string;
    country: string; city: string; address: string; postalCode: string; instructions?: string;
    orderConsent: boolean;
  };
  items: OrderItemInput[];
};
type ProductRow = {
  id: string; name: string; slug: string; price_cents: number; in_stock: number;
  wholesaler_id: string | null; business_name: string | null;
};
type OrderLine = ProductRow & { quantity: number; lineTotal: number };

function customerData(value: unknown): CheckoutInput["customer"] | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof input[key] === "string" ? input[key].trim().slice(0, max) : "";
  const firstName = text("firstName", 80), lastName = text("lastName", 80);
  const email = text("email", 254).toLowerCase(), phone = text("phone", 40);
  const country = text("country", 80), city = text("city", 120), address = text("address", 500);
  const postalCode = text("postalCode", 30), instructions = text("instructions", 1000);
  if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !country || !city || !address || !postalCode || input.orderConsent !== true) return null;
  const countryCodes: Record<string, string> = {
    france: "FR", belgium: "BE", belgique: "BE", luxembourg: "LU", switzerland: "CH", suisse: "CH",
    germany: "DE", allemagne: "DE", spain: "ES", espagne: "ES", italy: "IT", italie: "IT",
    netherlands: "NL", "the netherlands": "NL", "pays-bas": "NL", portugal: "PT", unitedkingdom: "GB",
    "united kingdom": "GB", "royaume-uni": "GB", ireland: "IE", "united states": "US", usa: "US", canada: "CA",
  };
  const normalizedCountry = country.toLowerCase().replace(/\s+/g, " ");
  const countryCode = /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : countryCodes[normalizedCountry.replace(/\s/g, "")] ?? countryCodes[normalizedCountry];
  if (!countryCode) return null;
  return { firstName, lastName, email, phone, country: countryCode, city, address, postalCode, instructions, orderConsent: true };
}

async function notifyStore(endpoint: string | undefined, details: CheckoutInput["customer"], reference: string, lines: OrderLine[], totalCents: number) {
  if (!endpoint || !/^https:\/\/formsubmit\.co\/ajax\//i.test(endpoint)) return false;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        _subject: `MAGNITECH order request ${reference}`,
        _template: "table",
        _replyto: details.email,
        orderReference: reference,
        orderStatus: "Order request received — awaiting manual confirmation. No payment taken.",
        name: `${details.firstName} ${details.lastName}`,
        email: details.email,
        phone: details.phone,
        deliveryCountry: details.country,
        deliveryCity: details.city,
        deliveryAddress: details.address,
        deliveryPostalCode: details.postalCode,
        deliveryInstructions: details.instructions || "None",
        products: lines.map((line) => `${line.name} × ${line.quantity} — ${(line.lineTotal / 100).toFixed(2)} EUR`).join("\n"),
        orderTotal: `${(totalCents / 100).toFixed(2)} EUR`,
        paymentStatus: "NOT PAID — contact the customer to confirm payment separately",
      }),
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json().catch(() => null) as { success?: unknown } | null;
    return response.ok && (result?.success === true || result?.success === "true");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = input as Record<string, unknown>;
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  const customer = customerData(body.customer);
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey) || !customer || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return Response.json({ error: "Check the delivery details and cart contents, then try again." }, { status: 400 });
  }
  const quantities = new Map<string, number>();
  for (const rawItem of body.items) {
    if (!rawItem || typeof rawItem !== "object") return Response.json({ error: "Invalid cart item." }, { status: 400 });
    const item = rawItem as Record<string, unknown>;
    const id = typeof item.productId === "string" ? item.productId : "";
    const quantity = item.quantity;
    if (!id || id.length > 180 || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return Response.json({ error: "Invalid cart item." }, { status: 400 });
    }
    quantities.set(id, (quantities.get(id) ?? 0) + quantity);
  }
  if ([...quantities.values()].some((quantity) => quantity > 99)) return Response.json({ error: "A product quantity cannot exceed 99." }, { status: 400 });

  const db = await getDatabase();
  if (!db) return Response.json({ error: "Order database is unavailable." }, { status: 503 });
  try {
    const previous = await db.prepare("SELECT id,reference FROM orders WHERE idempotency_key=? LIMIT 1")
      .bind(idempotencyKey).all<{ id: string; reference: string }>();
    if (previous.results?.[0]) return Response.json({ id: previous.results[0].id, reference: previous.results[0].reference, notificationSent: null }, { headers: { "Cache-Control": "no-store" } });

    const productIds = [...quantities.keys()];
    const placeholders = productIds.map(() => "?").join(",");
    const { results: products = [] } = await db.prepare(`SELECT p.id,p.name,p.slug,p.price_cents,p.in_stock,p.wholesaler_id,w.business_name
      FROM products p LEFT JOIN wholesaler_profiles w ON w.id=p.wholesaler_id
      WHERE p.id IN (${placeholders}) AND p.published=1 AND p.status='approved'`).bind(...productIds).all<ProductRow>();
    if (products.length !== productIds.length) return Response.json({ error: "One or more products are no longer available. Refresh your cart and try again." }, { status: 409 });
    if (products.some((product) => !product.in_stock)) return Response.json({ error: "One or more products are out of stock. Refresh your cart and try again." }, { status: 409 });

    const lines: OrderLine[] = products.map((product) => {
      const quantity = quantities.get(product.id) ?? 0;
      return { ...product, quantity, lineTotal: product.price_cents * quantity };
    });
    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) return Response.json({ error: "Order total is invalid." }, { status: 400 });
    const grouped = new Map<string, OrderLine[]>();
    for (const line of lines) {
      const key = line.wholesaler_id ?? "magnitech";
      grouped.set(key, [...(grouped.get(key) ?? []), line]);
    }
    const id = crypto.randomUUID();
    const reference = `MN-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const user = await findCurrentUser(readSessionToken(request));
    const statements = [db.prepare(`INSERT INTO orders
      (id,reference,user_id,customer_email,customer_first_name,customer_last_name,customer_phone,status,payment_status,currency,subtotal_cents,shipping_cents,discount_cents,total_cents,shipping_full_name,shipping_address_line1,shipping_postal_code,shipping_city,shipping_country_code,delivery_instructions,idempotency_key)
      VALUES (?,?,?,?,?,?,?,'request_received','unpaid','EUR',?,0,0,?,?,?,?,?,?,?,?)`)
      .bind(id,reference,user?.id ?? null,customer.email,customer.firstName,customer.lastName,customer.phone,subtotalCents,subtotalCents,`${customer.firstName} ${customer.lastName}`,customer.address,customer.postalCode,customer.city,customer.country,customer.instructions || null,idempotencyKey)];
    for (const vendorLines of grouped.values()) {
      const vendorOrderId = crypto.randomUUID();
      const vendorSubtotal = vendorLines.reduce((sum, line) => sum + line.lineTotal, 0);
      statements.push(db.prepare(`INSERT INTO vendor_orders (id,order_id,wholesaler_profile_id,seller_name_snapshot,status,subtotal_cents,shipping_cents)
        VALUES (?,?,?,?,'pending',?,0)`).bind(vendorOrderId,id,vendorLines[0].wholesaler_id,vendorLines[0].business_name || "MAGNITECH",vendorSubtotal));
      for (const line of vendorLines) statements.push(db.prepare(`INSERT INTO order_items
        (id,vendor_order_id,product_id,product_name_snapshot,product_slug_snapshot,unit_price_cents,quantity,line_total_cents)
        VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),vendorOrderId,line.id,line.name,line.slug,line.price_cents,line.quantity,line.lineTotal));
    }
    await db.batch(statements);

    const runtimeEnv = await getRuntimeEnv();
    const endpoint = [runtimeEnv.NEXT_PUBLIC_ORDER_FORM_ENDPOINT, process.env.NEXT_PUBLIC_ORDER_FORM_ENDPOINT]
      .find((value): value is string => typeof value === "string" && /^https:\/\/formsubmit\.co\/ajax\//i.test(value));
    const notificationSent = await notifyStore(endpoint,customer,reference,lines,subtotalCents);
    return Response.json({ id, reference, notificationSent }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Order creation failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/no such table: (orders|vendor_orders|order_items)/i.test(message)) {
      return Response.json({ error: "Order tables are not installed in D1 yet. Apply the existing 0003_orders.sql migration." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Could not save your order request. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
