"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function OrderConfirmation() {
  const [reference, setReference] = useState("");
  const [notificationFailed, setNotificationFailed] = useState(false);
  useEffect(() => {
    setReference(sessionStorage.getItem("magnitech-order-reference") || "");
    setNotificationFailed(sessionStorage.getItem("magnitech-order-notification-sent") === "false");
    sessionStorage.removeItem("magnitech-order-reference");
    sessionStorage.removeItem("magnitech-order-status");
    sessionStorage.removeItem("magnitech-order-notification-sent");
  }, []);
  return <main className="page-wrap simple-page order-confirmation">
    <p className="overline">ORDER REQUEST RECEIVED</p>
    <h1>Thank you<span className="title-period">.</span></h1>
    {reference && <p className="order-reference">Reference {reference}</p>}
    <p>Your order request has been saved. We will review availability and contact you to confirm the order and arrange payment.</p>
    {notificationFailed && <p className="notice" role="status">Your request is saved, but the store email notification could not be sent. Please contact MAGNITECH and share your order reference.</p>}
    <p className="payment-status">Payment status: <strong>not paid</strong>. No payment has been taken.</p>
    <Link className="button dark-button" href="/shop">Continue exploring <span>↗</span></Link>
  </main>;
}
