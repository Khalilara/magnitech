import { getRuntimeEnv, type R2Bucket } from "@/lib/d1";
import { isSameOrigin } from "@/lib/auth";
import { requireApprovedSupplier } from "@/lib/supplier-auth";

export const dynamic = "force-dynamic";
const maxBytes = 5 * 1024 * 1024;

function imageType(bytes: Uint8Array): { type: string; extension: string } | null {
  if (bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff) return {type:"image/jpeg",extension:"jpg"};
  if (bytes.length>=8&&bytes.slice(0,8).every((value,index)=>value===[137,80,78,71,13,10,26,10][index])) return {type:"image/png",extension:"png"};
  if (bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP") return {type:"image/webp",extension:"webp"};
  return null;
}

export async function POST(request: Request) {
  const access=await requireApprovedSupplier(request);
  if ("response" in access) return access.response;
  if (!isSameOrigin(request)) return Response.json({error:"Invalid origin."},{status:403});
  const form=await request.formData();
  const file=form.get("file");
  if (!(file instanceof File)||file.size===0||file.size>maxBytes) return Response.json({error:"Choose an image under 5 MB."},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer()), kind=imageType(bytes);
  if (!kind) return Response.json({error:"Use a valid JPEG, PNG or WebP image."},{status:400});
  const env=await getRuntimeEnv(), bucket=env.MAGNITECH_PRODUCT_IMAGES as R2Bucket|undefined;
  if (!bucket) return Response.json({error:"Product image storage is not configured. Create the Cloudflare R2 bucket and binding first."},{status:503});
  const key=`${access.user.id}/${crypto.randomUUID()}.${kind.extension}`;
  await bucket.put(key,bytes,{httpMetadata:{contentType:kind.type},customMetadata:{supplierId:access.user.id}});
  return Response.json({url:`/api/product-images/${key}`},{status:201,headers:{"Cache-Control":"no-store"}});
}
