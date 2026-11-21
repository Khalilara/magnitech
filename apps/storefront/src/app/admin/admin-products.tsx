"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice, type Product } from "@/lib/products";
import { useStore } from "@/components/store-provider";
import Link from "next/link";

const blankProduct = (): Product => ({
  id: "",
  name: "",
  slug: "",
  description: "",
  category: "Computing",
  images: [],
  supplierPrice: 0,
  price: 0,
  inStock: true,
  featured: false,
  published: false,
  specs: {},
});

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function responseError(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

export default function AdminProducts() {
  const router = useRouter();
  const { setProducts: setStoreProducts } = useStore();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [specsText, setSpecsText] = useState("{}");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadProducts = useCallback(async () => {
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      router.replace("/login?redirect=%2Fadmin");
      return;
    }
    if (response.status === 403) {
      setAuthenticated(false);
      router.replace("/");
      return;
    }

    const body: unknown = await response.json();
    if (!response.ok) throw new Error(responseError(body, "Could not load products"));
    if (!Array.isArray(body)) throw new Error("The product service returned an invalid response");

    const loadedProducts = body as Product[];
    setProducts(loadedProducts);
    setStoreProducts(loadedProducts.filter((product) => product.published && product.approvalStatus === "approved"));
    setAuthenticated(true);
  }, [router, setStoreProducts]);

  useEffect(() => {
    void loadProducts().catch((error: unknown) => {
      setAuthenticated(false);
      setNotice(error instanceof Error ? error.message : "Could not load products");
    });
  }, [loadProducts]);

  function openEditor(product: Product) {
    setEditing({ ...product, images: [...product.images], specs: { ...product.specs } });
    setSpecsText(JSON.stringify(product.specs, null, 2));
    setNotice("");
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    let specs: Record<string, string>;
    try {
      const parsed: unknown = JSON.parse(specsText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
        || Object.values(parsed).some((value) => typeof value !== "string")) {
        throw new Error();
      }
      specs = parsed as Record<string, string>;
    } catch {
      setNotice("Specifications must be a JSON object with text values.");
      setBusy(false);
      return;
    }

    const product: Product = {
      ...editing,
      name,
      slug: String(form.get("slug")).trim() || slugify(name),
      description: String(form.get("description")),
      category: String(form.get("category")),
      supplierPrice: Number(form.get("supplierPrice")),
      price: Number(form.get("price")),
      images: String(form.get("images")).split(/\n|,/).map((item) => item.trim()).filter(Boolean),
      inStock: form.get("inStock") === "on",
      featured: form.get("featured") === "on",
      published: form.get("published") === "on",
      specs,
    };

    try {
      const response = await fetch(product.id
        ? `/api/admin/products/${encodeURIComponent(product.id)}`
        : "/api/admin/products", {
        method: product.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(body, "Could not save product"));
      await loadProducts();
      setEditing(null);
      setNotice("Product saved to D1.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save product");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(product: Product) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, published: !product.published }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(body, "Could not update publication"));
      await loadProducts();
      setNotice(product.published ? "Product unpublished." : "Product published.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update publication");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete "${product.name}" permanently?`)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(body, "Could not delete product"));
      await loadProducts();
      setNotice("Product deleted from D1.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete product");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out request was rejected");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sign out failed");
    } finally {
      setBusy(false);
    }
  }

  if (authenticated !== true) {
    return <main className="page-wrap admin-page">
      <p className="overline">D1 PRODUCT CATALOG</p>
      <h1>Product<br /><em>management.</em></h1>
      {notice
        ? <p className="notice error" role="alert">{notice}</p>
        : <p role="status">Verifying administrator access…</p>}
      {notice && <button className="button dark-button" onClick={() => {
        setNotice("");
        void loadProducts().catch((error: unknown) => {
          setNotice(error instanceof Error ? error.message : "Could not load products");
        });
      }}>Retry</button>}
    </main>;
  }

  return <main className="page-wrap admin-page">
    <div className="shop-top">
      <div><p className="overline">D1 PRODUCT CATALOG</p><h1>Product<br /><em>management.</em></h1></div>
      <div className="admin-actions">
        <Link className="button light-button" href="/admin/products">Review submissions <span>↗</span></Link>
        <button className="button dark-button" disabled={busy} onClick={() => openEditor(blankProduct())}>+ Add product</button>
        <button className="text-button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
    <div className="local-banner">Changes are saved directly to the Cloudflare D1 catalog.</div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {products.length === 0
      ? <p className="notice">No products in D1 yet. Add your first product.</p>
      : <div className="admin-table">
        <div className="admin-row admin-head">
          <span>PRODUCT</span><span>CATEGORY</span><span>SUPPLIER</span><span>SELLING</span><span>MARGIN</span><span>STATUS</span><span>ACTIONS</span>
        </div>
        {products.map((product) => <div className="admin-row" key={product.id}>
          <div className="admin-product"><span><b>{product.name}</b><small>/{product.slug}</small></span></div>
          <span>{product.category}</span>
          <span>{formatPrice(product.supplierPrice)}</span>
          <span>{formatPrice(product.price)}</span>
          <span>{formatPrice(product.price - product.supplierPrice)} <small>({product.price ? Math.round((product.price - product.supplierPrice) / product.price * 100) : 0}%)</small></span>
          <span className={product.published ? "status-live" : "status-draft"}>{product.published ? "Published" : "Draft"}</span>
          <div className="row-actions">
            <button disabled={busy} onClick={() => openEditor(product)}>Edit</button>
            <button disabled={busy} onClick={() => void togglePublished(product)}>{product.published ? "Unpublish" : "Publish"}</button>
            <button disabled={busy} className="delete-action" onClick={() => void deleteProduct(product)}>Delete</button>
          </div>
        </div>)}
      </div>}
    {editing && <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setEditing(null);
    }}>
      <section className="edit-modal">
        <div className="modal-title">
          <div><p className="overline">PRODUCT DETAILS</p><h2>{editing.id ? "Edit product" : "New product"}</h2></div>
          <button onClick={() => setEditing(null)} aria-label="Close">×</button>
        </div>
        <form className="form-grid" onSubmit={saveProduct}>
          <label>Product name<input name="name" defaultValue={editing.name} required maxLength={160} /></label>
          <label>Slug<input name="slug" defaultValue={editing.slug} maxLength={180} /></label>
          <label>Category<input name="category" defaultValue={editing.category} required maxLength={80} /></label>
          <label>Supplier price (€)<input name="supplierPrice" type="number" min="0" step="0.01" defaultValue={editing.supplierPrice} required /></label>
          <label>Selling price (€)<input name="price" type="number" min="0" step="0.01" defaultValue={editing.price} required /></label>
          <div className="margin-box">Expected margin <b>{formatPrice(editing.price - editing.supplierPrice)}</b></div>
          <label className="wide">Description<textarea name="description" rows={3} defaultValue={editing.description} maxLength={5000} /></label>
          <label className="wide">Image URLs <span>(one HTTP(S) URL per line)</span><textarea name="images" rows={3} defaultValue={editing.images.join("\n")} /></label>
          <label className="wide">Specifications <span>(JSON object with text values)</span>
            <textarea rows={4} value={specsText} onChange={(event) => setSpecsText(event.target.value)} />
          </label>
          <label className="check"><input name="inStock" type="checkbox" defaultChecked={editing.inStock} /> In stock</label>
          <label className="check"><input name="featured" type="checkbox" defaultChecked={editing.featured} /> Featured</label>
          <label className="check"><input name="published" type="checkbox" defaultChecked={editing.published} /> Published</label>
          <div className="wide modal-buttons">
            <button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="button dark-button" disabled={busy}>{busy ? "Saving…" : "Save to D1"}</button>
          </div>
        </form>
      </section>
    </div>}
  </main>;
}
