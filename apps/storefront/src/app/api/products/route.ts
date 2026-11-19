import { getDatabase } from "@/lib/d1";
import { normalizeProduct, type DbProductRow } from "@/lib/product-records";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDatabase();
    if (!db) return Response.json({ error: "D1 binding MAGHITECH_DB is not configured" }, { status: 503 });
    const { results = [] } = await db.prepare(`SELECT p.*, i.image_url
      FROM products p LEFT JOIN product_images i ON i.product_id = p.id
      WHERE p.published = 1 ORDER BY p.featured DESC, p.name ASC, i.position ASC`)
      .all<DbProductRow & { image_url: string | null }>();
    const grouped = new Map<string, ReturnType<typeof normalizeProduct>>();
    for (const row of results) {
      let product = grouped.get(row.id);
      if (!product) {
        product = normalizeProduct(row);
        grouped.set(row.id, product);
      } else if (row.image_url) product.images.push(row.image_url);
    }
    return Response.json([...grouped.values()], {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30" },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load products" }, { status: 500 });
  }
}
