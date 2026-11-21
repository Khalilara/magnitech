import { getDatabase } from "@/lib/d1";
import { isSameOrigin } from "@/lib/auth";
import { normalizeProduct, productFromBody, type DbProductRow } from "@/lib/product-records";
import { requireApprovedSupplier } from "@/lib/supplier-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireApprovedSupplier(request);
  if ("response" in access) return access.response;
  const db = await getDatabase();
  if (!db) return Response.json({ error: "Supplier database is unavailable." }, { status: 503 });
  const { results = [] } = await db.prepare(`SELECT p.*,i.image_url FROM products p LEFT JOIN product_images i ON i.product_id=p.id
    WHERE p.supplier_id=? ORDER BY p.submitted_at DESC,i.position ASC`).bind(access.user.id).all<DbProductRow & { image_url: string | null }>();
  const grouped = new Map<string, ReturnType<typeof normalizeProduct>>();
  for (const row of results) {
    let product = grouped.get(row.id);
    if (!product) { product = normalizeProduct(row); grouped.set(row.id, product); }
    else if (row.image_url) product.images.push(row.image_url);
  }
  return Response.json([...grouped.values()], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await requireApprovedSupplier(request);
  if ("response" in access) return access.response;
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const db = await getDatabase();
  if (!db) return Response.json({ error: "Supplier database is unavailable." }, { status: 503 });
  try {
    const product = productFromBody(await request.json());
    product.id = crypto.randomUUID(); product.published = false; product.featured = false; product.approvalStatus = "pending"; product.supplierId = access.user.id;
    const statements = [db.prepare(`INSERT INTO products (id,name,slug,description,category,supplier_price,price,in_stock,featured,published,specs,supplier_id,approval_status,submitted_at)
      VALUES (?,?,?,?,?,?,?,?,0,0,?,?, 'pending',CURRENT_TIMESTAMP)`).bind(product.id,product.name,product.slug,product.description,product.category,product.supplierPrice,product.price,Number(product.inStock),JSON.stringify(product.specs),access.user.id)];
    product.images.forEach((image,position)=>statements.push(db.prepare("INSERT INTO product_images (id,product_id,image_url,position) VALUES (?,?,?,?)").bind(crypto.randomUUID(),product.id,image,position)));
    await db.batch(statements);
    return Response.json(product,{status:201,headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    const message=error instanceof Error?error.message:"Could not submit product.";
    return Response.json({error:message},{status:/Invalid product/.test(message)?400:409});
  }
}
