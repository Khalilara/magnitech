import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import AdminProducts from "./admin-products";
import SupplierRequests from "./supplier-requests";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  const user = await findCurrentUser(token);
  if (!user) redirect("/login?redirect=%2Fadmin");
  if (user.role !== "admin") redirect("/");

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminPage() {
  const { setProducts: setStoreProducts } = useStore();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [specsText, setSpecsText] = useState("{}");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadProducts = useCallback(async () => {
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    if (response.status === 401) { setAuthenticated(false); return; }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load products");
    setProducts(body);
    setStoreProducts(body.filter((product: Product) => product.published));
    setAuthenticated(true);
  }, [setStoreProducts]);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then(async (body) => {
        if (body.authenticated) await loadProducts();
        else setAuthenticated(false);
      })
      .catch(() => { setAuthenticated(false); setNotice("Could not connect to the admin service."); });
  }, [loadProducts]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Sign in failed");
      setPassword(""); await loadProducts();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Sign in failed"); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false); setProducts([]);
  }

  function openEditor(product: Product) {
    setEditing({ ...product, images: [...product.images], specs: { ...product.specs } });
    setSpecsText(JSON.stringify(product.specs, null, 2)); setNotice("");
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    let specs: Record<string, string>;
    try {
      const parsed: unknown = JSON.parse(specsText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.values(parsed).some((value) => typeof value !== "string")) throw new Error();
      specs = parsed as Record<string, string>;
    } catch { setNotice("Specifications must be a JSON object with text values."); setBusy(false); return; }
    const payload: Product = {
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
      const response = await fetch(payload.id ? `/api/admin/products/${encodeURIComponent(payload.id)}` : "/api/admin/products", {
        method: payload.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save product");
      await loadProducts(); setEditing(null); setNotice("Product saved to D1.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save product"); }
    finally { setBusy(false); }
  }

  async function togglePublished(product: Product) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...product, published: !product.published }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update publication");
      await loadProducts(); setNotice(product.published ? "Product unpublished." : "Product published.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update publication"); }
    finally { setBusy(false); }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete “${product.name}” permanently?`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not delete product");
      await loadProducts(); setNotice("Product deleted from D1.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete product"); }
    finally { setBusy(false); }
  }

  if (authenticated === null) return <main className="page-wrap admin-page"><p role="status">Loading admin workspace…</p></main>;
  if (!authenticated) return <main className="page-wrap admin-page admin-login">
    <p className="overline">MAGNITECH ADMIN</p><h1>Sign in<span className="title-period">.</span></h1>
    <p>Enter the administrator password configured for this Cloudflare Worker.</p>
    <form className="checkout-form" onSubmit={signIn}>
      <label className="wide">Admin password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      <button className="button dark-button wide" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    {notice && <p className="notice error" role="alert">{notice}</p>}
  </main>;

  return <main className="page-wrap admin-page">
    <div className="shop-top"><div><p className="overline">D1 PRODUCT CATALOG</p><h1>Product<br/><em>management.</em></h1></div>
      <div className="admin-actions"><a className="text-button" href="/root">D1 schema</a><button className="button dark-button" onClick={() => openEditor(blankProduct())}>+ Add product</button><button className="text-button" onClick={signOut}>Sign out</button></div>
    </div>
    <div className="local-banner">Changes are saved directly to the Cloudflare D1 catalog.</div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {products.length === 0 ? <p className="notice">No products in D1 yet. Add your first product.</p> : <div className="admin-table">
      <div className="admin-row admin-head"><span>PRODUCT</span><span>CATEGORY</span><span>SUPPLIER</span><span>SELLING</span><span>MARGIN</span><span>STATUS</span><span>ACTIONS</span></div>
      {products.map((product) => <div className="admin-row" key={product.id}>
        <div className="admin-product"><span><b>{product.name}</b><small>/{product.slug}</small></span></div>
        <span>{product.category}</span><span>{formatPrice(product.supplierPrice)}</span><span>{formatPrice(product.price)}</span>
        <span>{formatPrice(product.price - product.supplierPrice)} <small>({product.price ? Math.round((product.price - product.supplierPrice) / product.price * 100) : 0}%)</small></span>
        <span className={product.published ? "status-live" : "status-draft"}>{product.published ? "Published" : "Draft"}</span>
        <div className="row-actions"><button disabled={busy} onClick={() => openEditor(product)}>Edit</button><button disabled={busy} onClick={() => void togglePublished(product)}>{product.published ? "Unpublish" : "Publish"}</button><button disabled={busy} className="delete-action" onClick={() => void deleteProduct(product)}>Delete</button></div>
      </div>)}
    </div>}
    {editing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
      <section className="edit-modal"><div className="modal-title"><div><p className="overline">PRODUCT DETAILS</p><h2>{editing.id ? "Edit product" : "New product"}</h2></div><button onClick={() => setEditing(null)} aria-label="Close">×</button></div>
        <form className="form-grid" onSubmit={saveProduct}>
          <label>Product name<input name="name" defaultValue={editing.name} required maxLength={160}/></label>
          <label>Slug<input name="slug" defaultValue={editing.slug} maxLength={180}/></label>
          <label>Category<input name="category" defaultValue={editing.category} required maxLength={80}/></label>
          <label>Supplier price (€)<input name="supplierPrice" type="number" min="0" step="0.01" defaultValue={editing.supplierPrice} required/></label>
          <label>Selling price (€)<input name="price" type="number" min="0" step="0.01" defaultValue={editing.price} required/></label>
          <div className="margin-box">Expected margin <b>{formatPrice(editing.price - editing.supplierPrice)}</b></div>
          <label className="wide">Description<textarea name="description" rows={3} defaultValue={editing.description} maxLength={5000}/></label>
          <label className="wide">Image URLs <span>(one HTTP(S) URL per line)</span><textarea name="images" rows={3} defaultValue={editing.images.join("\n")}/></label>
          <label className="wide">Specifications <span>(JSON object with text values)</span><textarea rows={4} value={specsText} onChange={(event) => setSpecsText(event.target.value)}/></label>
          <label className="check"><input name="inStock" type="checkbox" defaultChecked={editing.inStock}/> In stock</label>
          <label className="check"><input name="featured" type="checkbox" defaultChecked={editing.featured}/> Featured</label>
          <label className="check"><input name="published" type="checkbox" defaultChecked={editing.published}/> Published</label>
          <div className="wide modal-buttons"><button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="button dark-button" disabled={busy}>{busy ? "Saving…" : "Save to D1"}</button></div>
        </form>
      </section>
    </div>}
  </main>;
}
