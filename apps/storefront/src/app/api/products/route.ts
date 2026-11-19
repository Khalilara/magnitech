import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  all<T = unknown>(): Promise<{ results?: T[] }>;
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  supplier_price: number;
  price: number;
  in_stock: number;
  featured: number;
  published: number;
  specs: string;
}

interface ImageRow {
  product_id: string;
  image_url: string;
}

export async function GET() {
  try {
    const { env } = getCloudflareContext();
    const db = (env as Record<string, unknown>).MAGHITECH_DB as D1Database | undefined;

    if (!db) {
      return Response.json(
        { error: "D1 binding MAGHITECH_DB is not configured" },
        { status: 503 },
      );
    }

    const productResult = await db
      .prepare("SELECT * FROM products WHERE published = 1 ORDER BY featured DESC, name ASC")
      .all<ProductRow>();

    const imageResult = await db
      .prepare("SELECT product_id, image_url FROM product_images ORDER BY position ASC")
      .all<ImageRow>();

    const imagesByProduct = new Map<string, string[]>();
    for (const image of imageResult.results ?? []) {
      const images = imagesByProduct.get(image.product_id) ?? [];
      images.push(image.image_url);
      imagesByProduct.set(image.product_id, images);
    }

    const products = (productResult.results ?? []).map((product) => {
      let specs: Record<string, string> = {};
      try {
        specs = JSON.parse(product.specs);
      } catch {
        specs = {};
      }

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        category: product.category,
        supplierPrice: product.supplier_price,
        price: product.price,
        inStock: Boolean(product.in_stock),
        featured: Boolean(product.featured),
        published: Boolean(product.published),
        specs,
        images: imagesByProduct.get(product.id) ?? [],
      };
    });

    return Response.json(products, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load products" },
      { status: 500 },
    );
  }
}
