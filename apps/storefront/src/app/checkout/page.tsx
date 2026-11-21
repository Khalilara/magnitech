"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/store-provider";
import { formatPrice } from "@/lib/products";
import type { CheckoutDetails } from "@/lib/payment";

const orderEndpoint = process.env.NEXT_PUBLIC_ORDER_FORM_ENDPOINT;

export default function CheckoutPage() {
  const { cart, products, clear } = useStore();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const items = products.filter((product) => cart[product.id]);
  const total = items.reduce((sum, product) => sum + product.price * cart[product.id], 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!orderEndpoint) {
      setMessage("Order email is not configured yet. Please contact the store before placing your order.");
      return;
    }
    setBusy(true);
    const form = event.currentTarget;
    const details = Object.fromEntries(new FormData(form).entries()) as unknown as CheckoutDetails;
    const reference = `MN-${Date.now().toString(36).toUpperCase()}`;
    const orderLines = items.map((product) =>
      `${product.name} × ${cart[product.id]} — ${formatPrice(product.price * cart[product.id])}`,
    );
    try {
      const response = await fetch(orderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `MAGNITECH order request ${reference}`,
          _template: "table",
          _replyto: details.email,
          _url: window.location.href,
          orderReference: reference,
          orderStatus: "Order request received — awaiting manual confirmation. No payment taken.",
          name: `${details.firstName} ${details.lastName}`,
          email: details.email,
          phone: details.phone,
          deliveryCountry: details.country,
          deliveryCity: details.city,
          deliveryAddress: details.address,
          deliveryPostalCode: details.postalCode,
          deliveryInstructions: details.instructions || "None",
          products: orderLines.join("\n"),
          orderTotal: formatPrice(total),
          paymentStatus: "NOT PAID — contact the customer to confirm payment separately",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || (result.success !== true && result.success !== "true")) {
        throw new Error(result.message || "The order email could not be sent. Please try again.");
      }
      sessionStorage.setItem("magnitech-order-reference", reference);
      sessionStorage.setItem("magnitech-order-status", "request-received");
      clear();
      router.push("/order-confirmation");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The order email could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!total) return <main className="page-wrap empty"><h1>Your shopping cart is empty.</h1><Link href="/shop" className="button dark-button">Continue Shopping ↗</Link></main>;

  return <main className="page-wrap checkout-layout">
    <div>
      <p className="overline">CHECKOUT · STEP 01</p>
      <h1>Delivery details<span className="title-period">.</span></h1>
      <p>Submit your order request. We’ll email the store with your details so we can confirm availability and follow up with you about payment.</p>
      <form className="checkout-form" onSubmit={submit}>
        <label>First name<input name="firstName" autoComplete="given-name" required/></label>
        <label>Last name<input name="lastName" autoComplete="family-name" required/></label>
        <label className="wide">Email<input name="email" type="email" autoComplete="email" required/></label>
        <label>Phone<input name="phone" type="tel" autoComplete="tel" required/></label>
        <label>Country<input name="country" autoComplete="country-name" required/></label>
        <label className="wide">Full address<input name="address" autoComplete="street-address" required/></label>
        <label>City<input name="city" autoComplete="address-level2" required/></label>
        <label>Postal code<input name="postalCode" autoComplete="postal-code" required/></label>
        <label className="wide">Delivery instructions <span>(optional)</span><textarea name="instructions" rows={3}/></label>
        <label className="wide order-consent"><input type="checkbox" name="orderConsent" required/> I agree to send these details to MAGNITECH by email to process my order request.</label>
        <button className="button dark-button wide" disabled={!orderEndpoint || busy}>{busy ? "Sending order request…" : "Submit order request"}<span>↗</span></button>
      </form>
      {!orderEndpoint && <p className="notice" role="status">Order email is not configured yet. Add the store’s FormSubmit AJAX endpoint to <code>NEXT_PUBLIC_ORDER_FORM_ENDPOINT</code> to enable this button.</p>}
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
