import { isValidAdminSession, sameOrigin } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/d1";
import { productFromBody } from "@/lib/product-records";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (!(await isValidAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    if (!db) return Response.json({ error: "D1 binding MAGHITECH_DB is not configured" }, { status: 503 });
    const product = productFromBody(await request.json());
    const statements = [db.prepare(`UPDATE products SET name=?,slug=?,description=?,category=?,supplier_price_cents=?,price_cents=?,in_stock=?,featured=?,published=?,specs=?,status=? WHERE id=?`)
      .bind(product.name, product.slug, product.description, product.category, Math.round(product.supplierPrice * 100), Math.round(product.price * 100), Number(product.inStock), Number(product.featured), Number(product.published), JSON.stringify(product.specs), product.published ? "approved" : "draft", id),
      db.prepare("DELETE FROM product_images WHERE product_id=?").bind(id)];
    product.images.forEach((url, position) => statements.push(db.prepare("INSERT INTO product_images (id,product_id,image_url,position) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, url, position)));
    await db.batch(statements);
    const { results } = await db.prepare("SELECT id FROM products WHERE id=?").bind(id).all<{ id: string }>();
    if (!results?.length) return Response.json({ error: "Product not found" }, { status: 404 });
    return Response.json({ ...product, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof Error && error.message.startsWith("Invalid product") ? 400 : 409;
    return Response.json({ error: error instanceof Error ? error.message : "Could not update product" }, { status });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (!(await isValidAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    if (!db) return Response.json({ error: "D1 binding MAGHITECH_DB is not configured" }, { status: 503 });
    await db.prepare("DELETE FROM products WHERE id=?").bind(id).run();
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not delete product" }, { status: 500 });
  }
}
