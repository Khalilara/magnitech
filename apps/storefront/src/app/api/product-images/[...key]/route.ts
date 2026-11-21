import { getRuntimeEnv, type R2Bucket } from "@/lib/d1";

export const dynamic = "force-dynamic";
type Context={params:Promise<{key:string[]}>};

export async function GET(_request:Request,context:Context) {
  const {key:parts}=await context.params;
  if(parts.length!==2||! /^[a-f\d-]{36}$/i.test(parts[0])||! /^[a-f\d-]{36}\.(?:jpg|png|webp)$/i.test(parts[1])) return new Response("Not found",{status:404});
  const env=await getRuntimeEnv(),bucket=env.MAGNITECH_PRODUCT_IMAGES as R2Bucket|undefined;
  if(!bucket)return new Response("Image storage unavailable",{status:503});
  const object=await bucket.get(parts.join("/"));
  if(!object)return new Response("Not found",{status:404});
  return new Response(object.body,{headers:{"Content-Type":object.httpMetadata?.contentType??"application/octet-stream","Cache-Control":"public, max-age=31536000, immutable",...(object.httpEtag?{"ETag":object.httpEtag}:{})}});
}
