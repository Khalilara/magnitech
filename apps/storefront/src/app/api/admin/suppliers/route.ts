import { findCurrentUser, isSameOrigin, readSessionToken, requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/d1";

export const dynamic="force-dynamic";

export async function GET(request:Request) {
  const denied=await requireAdmin(request);if(denied)return denied;
  const db=await getDatabase();if(!db)return Response.json({error:"D1 is unavailable."},{status:503});
  const {results=[]}=await db.prepare(`SELECT s.*,u.email,u.first_name,u.last_name,u.created_at AS account_created_at
    FROM supplier_requests s JOIN users u ON u.id=s.user_id ORDER BY CASE s.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,s.created_at DESC`).all<Record<string,unknown>>();
  return Response.json(results,{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request) {
  const denied=await requireAdmin(request);if(denied)return denied;
  if(!isSameOrigin(request))return Response.json({error:"Invalid origin."},{status:403});
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>}catch{return Response.json({error:"Invalid request."},{status:400})}
  const id=typeof body.id==="string"?body.id:"",action=body.action,note=typeof body.note==="string"?body.note.trim().slice(0,1000):"";
  if(!id||!(action==="approve"||action==="reject"))return Response.json({error:"Choose approve or reject."},{status:400});
  const db=await getDatabase();if(!db)return Response.json({error:"D1 is unavailable."},{status:503});
  const admin=await findCurrentUser(readSessionToken(request));if(!admin)return Response.json({error:"Authentication required."},{status:401});
  const requestRow=await db.prepare("SELECT user_id,status FROM supplier_requests WHERE id=? LIMIT 1").bind(id).all<{user_id:string;status:string}>();
  const row=requestRow.results?.[0];if(!row)return Response.json({error:"Supplier application not found."},{status:404});
  if(row.status!=="pending")return Response.json({error:"This supplier application has already been reviewed."},{status:409});
  const status=action==="approve"?"approved":"rejected";
  await db.batch([
    db.prepare("UPDATE supplier_requests SET status=?,decision_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(status,note||null,admin.id,id),
    db.prepare("INSERT INTO admin_actions (id,admin_id,target_type,target_id,action,note) VALUES (?,?,'supplier',?,?,?)").bind(crypto.randomUUID(),admin.id,id,action,note||null),
  ]);
  return Response.json({id,status},{headers:{"Cache-Control":"no-store"}});
}
