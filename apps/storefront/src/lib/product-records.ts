export type DbProductRow = {
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
  approval_status?: "pending" | "approved" | "archived";
  supplier_id?: string | null;
  rejection_reason?: string | null;
};

export type StoreProduct = {
  id: string; name: string; slug: string; description: string; category: string;
  supplierPrice: number; price: number; inStock: boolean; featured: boolean;
  published: boolean; specs: Record<string, string>; images: string[];
};

export function normalizeProduct(row: DbProductRow & { image_url?: string | null }): StoreProduct {
  let specs: Record<string, string> = {};
  try {
    const value = typeof row.specs === "string" ? JSON.parse(row.specs) : row.specs;
    if (value && typeof value === "object" && !Array.isArray(value)) specs = Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch { /* Use an empty specification list for malformed legacy data. */ }
  return {
    id: row.id, name: row.name, slug: row.slug, description: row.description, category: row.category,
    supplierPrice: Number(row.supplier_price), price: Number(row.price), inStock: Boolean(row.in_stock),
    featured: Boolean(row.featured), published: Boolean(row.published), specs,
    approvalStatus: row.approval_status ?? (row.published ? "approved" : "pending"), supplierId: row.supplier_id ?? null,
    images: row.image_url ? [row.image_url] : [],
  };
}

export function productFromBody(value: unknown): StoreProduct {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid product: expected an object");
  const item = value as Record<string, unknown>;
  const text = (key: string, max: number, required = true) => {
    const entry = item[key];
    if (typeof entry !== "string" || entry.length > max || (required && !entry.trim())) throw new Error(`Invalid product: ${key} is required and must be under ${max} characters`);
    return entry.trim();
  };
  const money = (key: string) => {
    const entry = item[key];
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0 || entry > 1_000_000) throw new Error(`Invalid product: ${key} must be a positive price`);
    return Math.round(entry * 100) / 100;
  };
  if (typeof item.inStock !== "boolean" || typeof item.featured !== "boolean" || typeof item.published !== "boolean") throw new Error("Invalid product: stock and publication flags are required");
  const images = item.images;
  if (!Array.isArray(images) || images.length > 12 || images.some((image) => typeof image !== "string" || image.length > 2048 || (!/^https?:\/\//i.test(image) && !/^\/api\/product-images\/[a-z\d-]+\/[a-f\d-]+\.(?:jpg|png|webp)$/i.test(image)))) throw new Error("Invalid product: images must be up to 12 HTTP(S) URLs or uploaded product images");
  const rawSpecs = item.specs;
  if (!rawSpecs || typeof rawSpecs !== "object" || Array.isArray(rawSpecs) || Object.keys(rawSpecs).length > 30 || Object.values(rawSpecs).some((v) => typeof v !== "string")) throw new Error("Invalid product: specs must be a string map");
  return {
    id: typeof item.id === "string" ? item.id : "", name: text("name", 160), slug: text("slug", 180),
    description: text("description", 5000, false), category: text("category", 80), supplierPrice: money("supplierPrice"),
    price: money("price"), inStock: item.inStock, featured: item.featured, published: item.published,
    specs: rawSpecs as Record<string, string>, images: images as string[],
  };
}
