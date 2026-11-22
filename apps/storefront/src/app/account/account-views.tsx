"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/products";
import { useStore } from "@/components/store-provider";

type Profile = { email: string; firstName: string; lastName: string; phone: string };

export function ProfileView() {
  const { setAuthenticatedUser } = useStore();
  const [profile, setProfile] = useState<Profile>({ email: "", firstName: "", lastName: "", phone: "" });
  const [busy, setBusy] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/account/profile", { cache: "no-store" }).then(async (response) => {
    const body = await response.json() as { error?: string; profile?: Profile };
    if (!response.ok) throw new Error(body.error ?? "Could not load your profile.");
    if (body.profile) setProfile(body.profile);
  }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load your profile.")).finally(() => setBusy(false)); }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const body = await response.json() as { error?: string; profile?: Profile };
      if (!response.ok) throw new Error(body.error ?? "Could not save your profile.");
      if (body.profile) setProfile(body.profile);
      setAuthenticatedUser((current) => current ? { ...current, firstName: profile.firstName, lastName: profile.lastName } : current);
      setMessage("Your profile has been saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your profile."); }
    finally { setSaving(false); }
  }
  if (busy) return <p role="status">Loading your profile…</p>;
  return <form className="account-form" onSubmit={save}><div className="auth-form-row"><label>First name<input required maxLength={100} autoComplete="given-name" value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })}/></label><label>Last name<input required maxLength={100} autoComplete="family-name" value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })}/></label></div><label>Email<input value={profile.email} readOnly/></label><label>Phone<input type="tel" maxLength={40} autoComplete="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })}/></label>{error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="account-success" role="status">{message}</p>}<button className="button dark-button" disabled={saving}>{saving?"Saving…":"Save profile"}<span>↗</span></button></form>;
}

type Order = { id: string; reference: string; status: string; payment_status: string; currency: string; total_cents: number; created_at: string };
export function OrdersView() {
  const [orders,setOrders]=useState<Order[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{void fetch("/api/account/orders",{cache:"no-store"}).then(async response=>{const body=await response.json() as {error?:string;orders?:Order[]};if(!response.ok)throw new Error(body.error??"Could not load your orders.");setOrders(body.orders??[])}).catch(reason=>setError(reason instanceof Error?reason.message:"Could not load your orders.")).finally(()=>setLoading(false))},[]);
  if(loading)return <p role="status">Loading your orders…</p>;
  if(error)return <p className="auth-error" role="alert">{error}</p>;
  if(!orders.length)return <div className="account-empty"><h2>No orders yet.</h2><p>Orders you place while signed in will appear here.</p><Link className="button dark-button" href="/shop">Explore the shop<span>↗</span></Link></div>;
  return <div className="account-orders">{orders.map(order=><article key={order.id}><div><b>{order.reference}</b><span>{new Date(order.created_at).toLocaleDateString()}</span></div><span className="account-order-status">{order.status.replaceAll("_"," ")}</span><b>{formatPrice(order.total_cents/100)}</b><small>Payment: {order.payment_status}</small></article>)}</div>;
}

type Address = { id: string; name: string; line: string; city: string; postal: string; country: string };
const ADDRESS_KEY="magnitech-addresses";
function readAddresses(): Address[] { try { const value: unknown=JSON.parse(localStorage.getItem(ADDRESS_KEY)??"[]");return Array.isArray(value)?value.filter((entry):entry is Address=>!!entry&&typeof entry==="object"&&typeof (entry as Address).id==="string"):[] } catch { return []; } }
export function AddressesView() {
  const [addresses,setAddresses]=useState<Address[]>([]),[ready,setReady]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{setAddresses(readAddresses());setReady(true)},[]);
  useEffect(()=>{if(ready)localStorage.setItem(ADDRESS_KEY,JSON.stringify(addresses))},[addresses,ready]);
  function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);const address:Address={id:crypto.randomUUID(),name:String(data.get("name")),line:String(data.get("line")),city:String(data.get("city")),postal:String(data.get("postal")),country:String(data.get("country"))};setAddresses(current=>[address,...current]);event.currentTarget.reset();setMessage("Address saved on this device.")}
  return <><form className="account-form" onSubmit={save}><h2>Add an address</h2><label>Full name<input name="name" autoComplete="name" required maxLength={120}/></label><label>Street address<input name="line" autoComplete="street-address" required maxLength={250}/></label><div className="auth-form-row"><label>City<input name="city" autoComplete="address-level2" required maxLength={100}/></label><label>Postal code<input name="postal" autoComplete="postal-code" required maxLength={20}/></label></div><label>Country<input name="country" autoComplete="country-name" required maxLength={100}/></label><button className="button dark-button">Save address<span>↗</span></button>{message&&<p className="account-success" role="status">{message}</p>}</form><div className="account-address-list">{addresses.map(address=><article key={address.id}><div><b>{address.name}</b><span>{address.line}</span><span>{address.postal} {address.city}, {address.country}</span></div><button type="button" onClick={()=>setAddresses(current=>current.filter(item=>item.id!==address.id))}>Remove</button></article>)}{ready&&!addresses.length&&<p>No saved addresses yet.</p>}</div><p className="account-storage-note">Saved addresses are kept in this browser on this device.</p></>;
}

export function WishlistView() {
  const {wishlist,products,removeWishlist,add}=useStore();
  const items=products.filter(product=>wishlist.includes(product.id));
  if(!items.length)return <div className="account-empty"><h2>Your wishlist is empty.</h2><p>Save products here to find them again.</p><Link className="button dark-button" href="/shop">Explore the shop<span>↗</span></Link></div>;
  return <div className="account-wishlist">{items.map(product=><article key={product.id}><Link className="account-wishlist-image" href={`/product/${product.slug}`}><Image src={product.images[0]} alt={product.name} fill sizes="120px"/></Link><div><Link href={`/product/${product.slug}`}><b>{product.name}</b></Link><span>{formatPrice(product.price)}</span><div><button onClick={()=>add(product.id)}>Add to cart</button><button onClick={()=>removeWishlist(product.id)}>Remove</button></div></div></article>)}</div>;
}

export function SettingsView() {
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setError("");setMessage("");const form=event.currentTarget;const data=new FormData(form);if(data.get("newPassword")!==data.get("confirmPassword")){setError("The new passwords do not match.");return}setBusy(true);try{const response=await fetch("/api/auth/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword:data.get("currentPassword"),newPassword:data.get("newPassword")})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error??"Could not update your password.");form.reset();setMessage("Your password has been updated.")}catch(reason){setError(reason instanceof Error?reason.message:"Could not update your password.")}finally{setBusy(false)}}
  return <><p>Update the password used to sign in to your MAGNITECH account.</p><form className="account-form" onSubmit={submit}><label>Current password<input type="password" name="currentPassword" autoComplete="current-password" maxLength={128} required/></label><label>New password<input type="password" name="newPassword" autoComplete="new-password" maxLength={128} required/></label><label>Confirm new password<input type="password" name="confirmPassword" autoComplete="new-password" maxLength={128} required/></label>{error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="account-success" role="status">{message}</p>}<button className="button dark-button" disabled={busy}>{busy?"Saving…":"Update password"}<span>↗</span></button></form></>;
}
