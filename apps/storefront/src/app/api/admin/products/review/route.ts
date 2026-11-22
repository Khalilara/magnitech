import { findCurrentUser, isSameOrigin, readSessionToken, requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/d1";
import { normalizeProduct, type DbProductRow } from "@/lib/product-records";

export const dynamic="force-dynamic";

export async function GET(request:Request) {
  const denied=await requireAdmin(request);if(denied)return denied;
  const status=new URL(request.url).searchParams.get("status")??"pending";
  const statusMap:Record<string,string>={pending:"pending_review",rejected:"rejected",approved:"approved",archived:"archived"};
  const dbStatus=statusMap[status];
  if(!dbStatus)return Response.json({error:"Invalid product status."},{status:400});
  const db=await getDatabase();if(!db)return Response.json({error:"D1 is unavailable."},{status:503});
  const {results=[]}=await db.prepare(`SELECT p.*,i.image_url,u.email AS supplier_email,w.business_name AS supplier_company
    FROM products p LEFT JOIN product_images i ON i.product_id=p.id LEFT JOIN wholesaler_profiles w ON w.id=p.wholesaler_id
    LEFT JOIN users u ON u.id=w.user_id WHERE p.status=? ORDER BY i.position ASC`)
    .bind(dbStatus).all<DbProductRow & {image_url:string|null;supplier_email:string|null;supplier_company:string|null;reviewed_at:string|null;rejection_reason:string|null}>();
  const grouped=new Map<string,ReturnType<typeof normalizeProduct>&{supplierEmail:string|null;supplierCompany:string|null;rejectionReason:string|null;reviewedAt:string|null}>();
  for(const row of results){let item=grouped.get(row.id);if(!item){item={...normalizeProduct(row),supplierEmail:row.supplier_email,supplierCompany:row.supplier_company,rejectionReason:row.rejection_reason??null,reviewedAt:row.reviewed_at??null};grouped.set(row.id,item)}else if(row.image_url)item.images.push(row.image_url)}
  return Response.json([...grouped.values()],{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request) {
  const denied=await requireAdmin(request);if(denied)return denied;
  if(!isSameOrigin(request))return Response.json({error:"Invalid origin."},{status:403});
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>}catch{return Response.json({error:"Invalid request."},{status:400})}
  const id=typeof body.id==="string"?body.id:"",action=body.action,note=typeof body.note==="string"?body.note.trim().slice(0,1000):"";
  if(!id||!(action==="approve"||action==="reject"||action==="archive"))return Response.json({error:"Choose approve, reject, or archive."},{status:400});
  const db=await getDatabase();if(!db)return Response.json({error:"D1 is unavailable."},{status:503});
  // A Cloudflare-secret super-admin session has no D1 user id; reviewed_by is nullable.
  const admin=await findCurrentUser(readSessionToken(request));
  const current=await db.prepare("SELECT status FROM products WHERE id=? LIMIT 1").bind(id).all<{status:string}>();
  if(!current.results?.length)return Response.json({error:"Product not found."},{status:404});
  const status=action==="approve"?"approved":action==="reject"?"rejected":"archived",published=action==="approve"?1:0;
  await db.prepare("UPDATE products SET status=?,published=?,rejection_reason=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(status,published,action==="approve"?null:(note||null),admin?.id??null,id).run();
  return Response.json({id,status},{headers:{"Cache-Control":"no-store"}});
}
