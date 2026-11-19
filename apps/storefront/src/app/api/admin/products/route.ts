import { isValidAdminSession, sameOrigin } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/d1";
import { normalizeProduct, productFromBody, type DbProductRow } from "@/lib/product-records";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isValidAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDatabase();
    if (!db) return Response.json({ error: "D1 binding MAGHITECH_DB is not configured" }, { status: 503 });
    const { results = [] } = await db.prepare(`SELECT p.*, i.image_url, i.position
      FROM products p LEFT JOIN product_images i ON i.product_id = p.id
      ORDER BY p.featured DESC, p.name ASC, i.position ASC`).all<DbProductRow & { image_url: string | null; position: number | null }>();
    const grouped = new Map<string, ReturnType<typeof normalizeProduct>>();
    for (const row of results) {
      let product = grouped.get(row.id);
      if (!product) {
        product = normalizeProduct(row);
        grouped.set(row.id, product);
      }
      if (row.image_url) product.images.push(row.image_url);
    }
    return Response.json([...grouped.values()], { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (!(await isValidAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDatabase();
    if (!db) return Response.json({ error: "D1 binding MAGHITECH_DB is not configured" }, { status: 503 });
    const product = productFromBody(await request.json());
    product.id = crypto.randomUUID();
    const statements = [db.prepare(`INSERT INTO products (id,name,slug,description,category,supplier_price,price,in_stock,featured,published,specs)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(product.id, product.name, product.slug, product.description, product.category, product.supplierPrice, product.price, Number(product.inStock), Number(product.featured), Number(product.published), JSON.stringify(product.specs))];
    product.images.forEach((url, position) => statements.push(db.prepare("INSERT INTO product_images (id,product_id,image_url,position) VALUES (?,?,?,?)").bind(crypto.randomUUID(), product.id, url, position)));
    await db.batch(statements);
    return Response.json(product, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof Error && error.message.startsWith("Invalid product") ? 400 : 409;
    return Response.json({ error: error instanceof Error ? error.message : "Could not create product" }, { status });
  }
}
