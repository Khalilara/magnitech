"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function OrderConfirmation() {
  const [reference, setReference] = useState("");
  useEffect(() => {
    setReference(sessionStorage.getItem("magnitech-order-reference") || "");
    sessionStorage.removeItem("magnitech-order-reference");
    sessionStorage.removeItem("magnitech-order-status");
  }, []);
  return <main className="page-wrap simple-page order-confirmation">
    <p className="overline">ORDER REQUEST RECEIVED</p>
    <h1>Thank you<span className="title-period">.</span></h1>
    {reference && <p className="order-reference">Reference {reference}</p>}
    <p>Your order request has been sent to MAGNITECH. We’ll review availability and contact you to confirm the order and arrange payment.</p>
    <p className="payment-status">Payment status: <strong>not paid</strong>. No payment has been taken.</p>
    <Link className="button dark-button" href="/shop">Continue exploring <span>↗</span></Link>
  </main>;
}
