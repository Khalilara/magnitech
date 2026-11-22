import { findCurrentUser, isSameOrigin, readSessionToken, requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/d1";

export const dynamic="force-dynamic";

export async function GET(request:Request) {
  const denied=await requireAdmin(request);if(denied)return denied;
  const db=await getDatabase();if(!db)return Response.json({error:"D1 is unavailable."},{status:503});
  const {results=[]}=await db.prepare(`SELECT p.*,u.email,u.created_at AS account_created_at
    FROM wholesaler_profiles p JOIN users u ON u.id=p.user_id ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,p.created_at DESC`).all<Record<string,unknown>>();
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
  const requestRow=await db.prepare(`SELECT p.user_id,p.status,p.business_name,u.email
    FROM wholesaler_profiles p JOIN users u ON u.id=p.user_id WHERE p.id=? LIMIT 1`)
    .bind(id).all<{user_id:string;status:string;business_name:string;email:string}>();
  const row=requestRow.results?.[0];if(!row)return Response.json({error:"Supplier application not found."},{status:404});
  if(row.status!=="pending")return Response.json({error:"This wholesaler application has already been reviewed."},{status:409});
  const status=action==="approve"?"active":"rejected";
  await db.batch([
    db.prepare("UPDATE wholesaler_profiles SET status=?,rejection_reason=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(status,action==="reject"?(note||null):null,admin.id,id),
  ]);
  let notificationSent=false;
  if(action==="approve") {
    try {
      const response=await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(row.email)}`,{
        method:"POST",
        headers:{Accept:"application/json","Content-Type":"application/json"},
        body:JSON.stringify({
          _subject:"Your MAGNITECH wholesaler account is approved",
          _template:"table",
          message:`Your wholesaler account for ${row.business_name} has been approved. You can now sign in to your supplier space and submit product proposals for review.`,
          loginUrl:`${new URL(request.url).origin}/supplier/login`,
        }),
        signal:AbortSignal.timeout(5000),
      });
      const receipt=await response.json().catch(()=>null) as {success?:unknown}|null;
      notificationSent=response.ok&&(receipt?.success===true||receipt?.success==="true");
    } catch {
      // Approval is persisted; the admin UI reports if the email provider was unavailable.
    }
  }
  return Response.json({id,status,notificationSent},{headers:{"Cache-Control":"no-store"}});
}
