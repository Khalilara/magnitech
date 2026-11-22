"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/store-provider";
import { formatPrice } from "@/lib/products";
import type { CheckoutDetails } from "@/lib/payment";

export default function CheckoutPage() {
  const { cart, products, clear } = useStore();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const items = products.filter((product) => cart[product.id]);
  const total = items.reduce((sum, product) => sum + product.price * cart[product.id], 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const details = Object.fromEntries(formData.entries()) as unknown as CheckoutDetails;
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          customer: { ...details, orderConsent: formData.get("orderConsent") === "on" },
          items: items.map((product) => ({ productId: product.id, quantity: cart[product.id] })),
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; reference?: string; notificationSent?: boolean | null };
      if (!response.ok || !result.reference) throw new Error(result.error || "The order request could not be saved. Please try again.");
      sessionStorage.setItem("magnitech-order-reference", result.reference);
      sessionStorage.setItem("magnitech-order-status", "request-received");
      if (typeof result.notificationSent === "boolean") sessionStorage.setItem("magnitech-order-notification-sent", String(result.notificationSent));
      clear();
      router.push("/order-confirmation");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The order request could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!total) return <main className="page-wrap empty"><h1>Your shopping cart is empty.</h1><Link href="/shop" className="button dark-button">Continue Shopping ↗</Link></main>;

  return <main className="page-wrap checkout-layout">
    <div>
      <p className="overline">CHECKOUT · STEP 01</p>
      <h1>Delivery details<span className="title-period">.</span></h1>
      <p>Submit your order request. We will save it securely and notify the store so we can confirm availability and follow up about payment.</p>
      <form className="checkout-form" onSubmit={submit}>
        <label>First name<input name="firstName" autoComplete="given-name" required/></label>
        <label>Last name<input name="lastName" autoComplete="family-name" required/></label>
        <label className="wide">Email<input name="email" type="email" autoComplete="email" required/></label>
        <label>Phone<input name="phone" type="tel" autoComplete="tel" required/></label>
        <label>Country<input name="country" autoComplete="country-name" placeholder="France or FR" required/></label>
        <label className="wide">Full address<input name="address" autoComplete="street-address" required/></label>
        <label>City<input name="city" autoComplete="address-level2" required/></label>
        <label>Postal code<input name="postalCode" autoComplete="postal-code" required/></label>
        <label className="wide">Delivery instructions <span>(optional)</span><textarea name="instructions" rows={3}/></label>
        <label className="wide order-consent"><input type="checkbox" name="orderConsent" required/> I agree to send these details to MAGNITECH to process my order request.</label>
        <button className="button dark-button wide" disabled={busy}>{busy ? "Saving order request…" : "Submit order request"}<span>↗</span></button>
      </form>
      {message && <p className="notice error" role="alert">{message}</p>}
      <p className="fine-print">Submitting creates an unpaid order request only. We’ll contact you to confirm the order and arrange payment; no payment is taken on this page.</p>
    </div>
    <aside className="summary">
      <p className="overline">ORDER SUMMARY</p>
      {items.map((product) => <div key={product.id}><span>{product.name} × {cart[product.id]}</span><b>{formatPrice(product.price * cart[product.id])}</b></div>)}
      <div><span>Delivery</span><span>{total >= 55 ? "Free" : "Confirmed with your order"}</span></div>
      <div className="summary-total"><b>Total</b><b>{formatPrice(total)}</b></div>
      <p className="fine-print">This is an order request total. Payment will be arranged separately after the store contacts you.</p>
    </aside>
  </main>;
}
