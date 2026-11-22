"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPrice, type Product } from "@/lib/products";

type Status = "pending" | "rejected" | "approved" | "archived";
type ReviewProduct = Product & {
  supplierEmail: string | null;
  supplierCompany: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
};
const tabs: Status[] = ["pending", "rejected", "approved", "archived"];
const labels: Record<Status, string> = {
  pending: "Pending review", rejected: "Rejected", approved: "Approved", archived: "Archived",
};

export default function ProductApprovals() {
  const [status, setStatus] = useState<Status>("pending");
  const [products, setProducts] = useState<ReviewProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (next: Status) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/products/review?status=${next}`, { cache: "no-store" });
      const body = await response.json() as ReviewProduct[] | { error?: string };
      if (!response.ok || !Array.isArray(body)) throw new Error(!Array.isArray(body) ? body.error ?? "Could not load products." : "Could not load products.");
      setProducts(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load products.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(status); }, [load, status]);

  async function decide(product: ReviewProduct, action: "approve" | "reject" | "archive") {
    const actionLabel = action === "approve" ? "Approve and publish" : action === "reject" ? "Reject" : "Archive";
    if (!window.confirm(`${actionLabel} "${product.name}"?`)) return;
    const note = action === "approve" ? "" : (window.prompt(action === "reject" ? "Reason for rejection (optional):" : "Archive note (optional):", product.rejectionReason ?? "") ?? "");
    setBusy(product.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/products/review", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: product.id, action, note }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not update product status.");
      setNotice(action === "approve" ? `${product.name} was approved and published.` : action === "reject" ? `${product.name} was rejected.` : `${product.name} was archived.`);
      await load(status);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update product status.");
    } finally { setBusy(""); }
  }

  return <main className="page-wrap admin-page product-approval-page">
    <div className="shop-top"><div><p className="overline">D1 CATALOG / MODERATION</p><h1>Product<br/><em>approvals.</em></h1></div><Link className="text-button" href="/admin">Back to admin</Link></div>
    <div className="local-banner">Approved products are published to the shop. Rejected proposals remain editable by their supplier.</div>
    <div className="approval-tabs" role="tablist" aria-label="Product approval status">{tabs.map((tab) => <button key={tab} role="tab" aria-selected={status === tab} className={status === tab ? "active" : ""} onClick={() => setStatus(tab)}>{labels[tab]}</button>)}</div>
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading {labels[status].toLowerCase()} products...</p> : products.length === 0 ? <div className="empty"><p>No {labels[status].toLowerCase()} products.</p></div> : <div className="approval-product-list">{products.map((product) => <article className="approval-product-card" key={product.id}>
      {product.images.map((image) => <div className="approval-product-image" key={image}><Image src={image} alt={`${product.name} product photo`} fill sizes="(max-width:700px) 100vw, 180px"/></div>)}
      <div className="approval-product-info"><span className={`supplier-status ${product.approvalStatus}`}>{product.approvalStatus}</span><h2>{product.name}</h2>
        <p className="overline">{product.category} ? {formatPrice(product.price)} ? Supplier cost {formatPrice(product.supplierPrice)}</p><p>{product.description}</p>
        <p><b>Supplier:</b> {product.supplierCompany ?? "MAGNITECH catalog"}{product.supplierEmail && <> ? <a href={`mailto:${product.supplierEmail}`}>{product.supplierEmail}</a></>}</p>
        {Object.keys(product.specs).length > 0 && <dl className="approval-specs">{Object.entries(product.specs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}
        {product.rejectionReason && <p className="supplier-review-note">Admin note: {product.rejectionReason}</p>}
        <div className="supplier-review-actions">{product.approvalStatus !== "approved" && <button className="button dark-button" disabled={Boolean(busy)} onClick={() => void decide(product, "approve")}>{busy === product.id ? "Updating..." : "Approve and publish"}</button>}
          {(product.approvalStatus === "pending" || product.approvalStatus === "rejected") && <button className="text-button" disabled={Boolean(busy)} onClick={() => void decide(product, "reject")}>Reject with note</button>}
          {product.approvalStatus === "approved" && <button className="text-button" disabled={Boolean(busy)} onClick={() => void decide(product, "archive")}>Archive product</button>}
        </div>
      </div>
    </article>)}</div>}
  </main>;
}
