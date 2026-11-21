"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice, type Product } from "@/lib/products";
import { useStore } from "./store-provider";

export function Header(){
  const {cart,notice,dismissNotice}=useStore();
  const [cartOpen,setCartOpen]=useState(false);
  const [accountOpen,setAccountOpen]=useState(false);
  const accountRef=useRef<HTMLDivElement>(null);
  const path=usePathname();
  const count=Object.values(cart).reduce((total,quantity)=>total+quantity,0);
  useEffect(()=>{document.body.classList.remove("menu-open");setCartOpen(false);setAccountOpen(false)},[path]);
  useEffect(()=>{if(!accountOpen)return;const close=(event:MouseEvent)=>{if(!accountRef.current?.contains(event.target as Node))setAccountOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setAccountOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",escape)}},[accountOpen]);
  useEffect(()=>{if(!notice)return;const timeout=window.setTimeout(dismissNotice,2600);return()=>window.clearTimeout(timeout)},[notice,dismissNotice]);
  return <>
    <div className="announcement">FREE SHIPPING ON ORDERS OVER <span>€55</span></div>
    <header className="header">
      <Link className="wordmark header-brand" href="/" aria-label="MAGNITECH home"><svg className="brand-symbol" viewBox="0 0 76 52" aria-hidden="true"><path d="M6 40 18 10c2-5 8-6 11-1l9 18 10-18c3-5 9-4 11 1l12 30c2 5-1 9-5 10-4 1-7-1-9-5L50 30 43 45c-2 5-8 7-12 3l-4-3-7-15-7 15c-2 4-6 6-10 4-4-1-6-5-4-9Z"/></svg><span>MAGNI<strong>TECH</strong></span><i>®</i></Link>
      <nav aria-label="Main navigation">
        <Link className={path==="/"?"active":""} href="/">Home</Link><Link className={path==="/shop"?"active":""} href="/shop">Shop</Link><Link href="/#collections">Collections</Link><Link href="/contact">Contact</Link>
      </nav>
      <div className="head-right">
        <form className="header-search" action="/shop"><input name="q" aria-label="Search products" placeholder="Search products..."/><button aria-label="Submit search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></svg></button></form>
        <ThemeToggle/>
        <div className="account-control" ref={accountRef}>
          <button className="account-button" aria-label="Open account options" aria-haspopup="dialog" aria-expanded={accountOpen} onClick={()=>setAccountOpen(value=>!value)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.7-4 3.2-6 7.5-6s6.8 2 7.5 6"/></svg></button>
          {accountOpen&&<section className="account-popover" aria-label="Account options"><b>Welcome back!</b><Link className="account-email" href="/login">✉&nbsp; Continue with email</Link><p className="account-signup">New here? <Link href="/register">Create an account</Link></p></section>}
        </div>
        {count>0&&<button className="cart-link" onClick={()=>setCartOpen(true)} aria-label={`Open shopping cart, ${count} items`} aria-haspopup="dialog" aria-expanded={cartOpen}>Shopping Cart <span>{count}</span></button>}
        <button className="mobile-menu" aria-label="Open navigation" onClick={()=>document.body.classList.toggle("menu-open")}>☰</button>
      </div>
    </header>
    {notice&&<div className="cart-toast" role="status"><span aria-hidden="true">✓</span>{notice}<button onClick={dismissNotice} aria-label="Dismiss notification">×</button></div>}
    <CartDrawer open={cartOpen} onClose={()=>setCartOpen(false)}/>
  </>;
}

function ThemeToggle(){const [dark,setDark]=useState(false);useEffect(()=>{const saved=localStorage.getItem("magnitech-theme")==="dark";setDark(saved);document.documentElement.dataset.theme=saved?"dark":"light"},[]);return <button className="theme-toggle" aria-label={dark?"Switch to light theme":"Switch to dark theme"} onClick={()=>{const next=!dark;setDark(next);document.documentElement.dataset.theme=next?"dark":"light";localStorage.setItem("magnitech-theme",next?"dark":"light")}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={dark?"M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z":"M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"}/></svg></button>}

function CartDrawer({open,onClose}:{open:boolean;onClose:()=>void}){
  const {cart,products,quantity,remove}=useStore();
  const items=products.filter(product=>cart[product.id]);
  const count=items.reduce((total,product)=>total+cart[product.id],0);
  const subtotal=items.reduce((total,product)=>total+product.price*cart[product.id],0);
  useEffect(()=>{if(!open)return;const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};document.addEventListener("keydown",onKey);document.body.classList.add("cart-drawer-open");return()=>{document.removeEventListener("keydown",onKey);document.body.classList.remove("cart-drawer-open")}},[open,onClose]);
  if(!open)return null;
  return <div className="cart-drawer-layer" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
      <header><div><p className="overline">YOUR SELECTION</p><h2 id="cart-drawer-title">Shopping Cart <span>({count})</span></h2></div><button className="cart-drawer-close" onClick={onClose} aria-label="Close shopping cart">×</button></header>
      {items.length===0?<div className="cart-drawer-empty"><span aria-hidden="true">＋</span><h3>Your shopping cart is empty.</h3><Link className="button dark-button" href="/shop" onClick={onClose}>Continue Shopping<span>↗</span></Link></div>:<>
        <div className="cart-drawer-items">{items.map(product=><article className="cart-drawer-item" key={product.id}>
          <Link className="cart-drawer-image" href={`/product/${product.slug}`} onClick={onClose}><Image src={product.images[0]} alt={product.name} fill sizes="84px"/></Link>
          <div className="cart-drawer-product"><Link href={`/product/${product.slug}`} onClick={onClose}>{product.name}</Link><span>{product.category}</span><div className="cart-drawer-quantity"><button onClick={()=>quantity(product.id,-1)} aria-label={`Decrease ${product.name} quantity`}>−</button><span>{cart[product.id]}</span><button onClick={()=>quantity(product.id,1)} aria-label={`Increase ${product.name} quantity`} disabled={cart[product.id]>=99}>+</button></div></div>
          <div className="cart-drawer-price"><b>{formatPrice(product.price*cart[product.id])}</b><button onClick={()=>remove(product.id)} aria-label={`Remove ${product.name} from cart`}>Remove</button></div>
        </article>)}</div>
        <div className="cart-drawer-summary"><div><span>Subtotal</span><b>{formatPrice(subtotal)}</b></div><div><span>Delivery</span><span>{subtotal>=55?"Free":"Confirmed with your order"}</span></div><div className="cart-drawer-total"><b>Order request total</b><b>{formatPrice(subtotal)}</b></div><Link className="button cart-checkout-button" href="/checkout" onClick={onClose}>Proceed to Checkout<span>↗</span></Link><p>Payment is arranged separately after we confirm your order request.</p></div>
      </>}
    </aside>
  </div>;
}

const brands=["amazon","google","microsoft","apple","samsung","meta","intel","dell","adobe","sony","lenovo","hp"];
export function BrandMarquee(){return <section className="brand-showcase" aria-label="Technology brands"><p>TRUSTED BY INDUSTRY LEADERS</p><div className="brand-track">{[0,1].map(copy=><div className="brand-group" key={copy} aria-hidden={copy===1}>{brands.map(name=><Image key={name} src={`/brands/${name}.svg`} alt={copy===0?`${name[0].toUpperCase()}${name.slice(1)} logo`:""} width={120} height={32} loading="eager"/> )}</div>)}</div></section>}
export function Footer(){return <footer className="footer"><div><Link className="wordmark" href="/">MAGNI<span>TECH</span><i>®</i></Link><p>Technology, thoughtfully chosen.<br/>Everyday tools made to work beautifully.</p></div><div><b>Explore</b><Link href="/shop">All products</Link><Link href="/contact">Contact</Link></div><div><b>Information</b><Link href="/legal">Privacy & terms</Link><span>Shipping & returns</span><span>© Magnitech 2026</span></div><div className="foot-note">A quieter kind of<br/><em>upgrade.</em></div></footer>}
export function ProductCard({product}:{product:Product}){const {add}=useStore();return <article className="product-card"><Link href={`/product/${product.slug}`} className="product-photo"><Image src={product.images[0]} alt={product.name} fill sizes="(max-width:680px) 50vw, (max-width:1000px) 33vw, 25vw"/><span className="photo-tag">{product.inStock?"READY TO SHIP":"COMING BACK SOON"}</span></Link><div className="product-under"><Link href={`/product/${product.slug}`}><h3>{product.name}</h3></Link><button className="quick-add" onClick={()=>add(product.id)} aria-label={`Add ${product.name} to cart`}>+</button><div><span>{product.category}</span><strong>{formatPrice(product.price)}</strong></div></div></article>}
export function ProductGrid({items}:{items:Product[]}){return items.length?<div className="product-grid">{items.map(p=><ProductCard key={p.id} product={p}/>)}</div>:<div className="empty"><h3>No products found</h3><p>Try another search or category.</p></div>}
export function Shop(){const {products}=useStore();const [cat,setCat]=useState("All products"),[query,setQuery]=useState(""),[sort,setSort]=useState("featured");useEffect(()=>{setQuery(new URLSearchParams(window.location.search).get("q")??"")},[]);const categories=["All products",...Array.from(new Set(products.filter(p=>p.published).map(p=>p.category)))];const visible=useMemo(()=>products.filter(p=>p.published&&(cat==="All products"||p.category===cat)&&`${p.name} ${p.category} ${p.description}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==="price-low"?a.price-b.price:sort==="price-high"?b.price-a.price:sort==="name"?a.name.localeCompare(b.name):Number(b.featured)-Number(a.featured)),[products,cat,query,sort]);return <main className="page-wrap"><div className="shop-top"><div><p className="overline">THE MAGNITECH EDIT</p><h1>Technology that<br/><em>fits your everyday.</em></h1></div><p className="shop-intro">Considered essentials for work, play and everything in between. Find the right piece for your daily rhythm.</p></div><div className="shop-controls"><div className="chips">{categories.map(c=><button key={c} onClick={()=>setCat(c)} className={cat===c?"chosen":""}>{c}</button>)}</div><div className="filter-controls"><label className="search"><span>⌕</span><input placeholder="Search the edit" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Sort products" value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></div></div><p className="result-count">Showing {visible.length} pieces</p><ProductGrid items={visible}/></main>}
