import { getDatabase } from "@/lib/d1";
import { isSameOrigin } from "@/lib/auth";
import { productFromBody } from "@/lib/product-records";
import { requireApprovedSupplier } from "@/lib/supplier-auth";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const access = await requireApprovedSupplier(request);
  if ("response" in access) return access.response;
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const { id } = await context.params;
  const db = await getDatabase();
  if (!db) return Response.json({ error: "Supplier database is unavailable." }, { status: 503 });
  const owned = await db.prepare("SELECT id FROM products WHERE id=? AND supplier_id=? AND approval_status IN ('pending','archived') LIMIT 1").bind(id,access.user.id).all<{id:string}>();
  if (!owned.results?.length) return Response.json({error:"This product cannot be edited."},{status:404});
  try {
    const product=productFromBody(await request.json());
    const statements=[db.prepare(`UPDATE products SET name=?,slug=?,description=?,category=?,supplier_price=?,price=?,in_stock=?,featured=0,published=0,specs=?,approval_status='pending',rejection_reason=NULL,submitted_at=CURRENT_TIMESTAMP,reviewed_at=NULL WHERE id=? AND supplier_id=?`)
      .bind(product.name,product.slug,product.description,product.category,product.supplierPrice,product.price,Number(product.inStock),JSON.stringify(product.specs),id,access.user.id),
      db.prepare("DELETE FROM product_images WHERE product_id=? AND EXISTS (SELECT 1 FROM products WHERE id=? AND supplier_id=?)").bind(id,id,access.user.id)];
    product.images.forEach((image,position)=>statements.push(db.prepare("INSERT INTO product_images (id,product_id,image_url,position) VALUES (?,?,?,?)").bind(crypto.randomUUID(),id,image,position)));
    await db.batch(statements);
    return Response.json({id,status:"pending"},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { const message=error instanceof Error?error.message:"Could not update product.";return Response.json({error:message},{status:/Invalid product/.test(message)?400:409}); }
}
