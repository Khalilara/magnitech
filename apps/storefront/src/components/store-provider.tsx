"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { initialProducts, type Product } from "@/lib/products";

type Store = { products: Product[]; cart: Record<string, number>; setProducts:React.Dispatch<React.SetStateAction<Product[]>>; add:(id:string)=>void; quantity:(id:string, delta:number)=>void; clear:()=>void };
const StoreContext = createContext<Store | null>(null);
export function StoreProvider({children}:{children:React.ReactNode}) {
  const [products,setProducts]=useState(initialProducts); const [cart,setCart]=useState<Record<string,number>>({});const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{ try { const p=localStorage.getItem("magnitech-products"); if(p) setProducts(JSON.parse(p)); const c=localStorage.getItem("magnitech-cart"); if(c) setCart(JSON.parse(c)); } catch { /* Keep the bundled catalog if local data is invalid. */ } finally {setHydrated(true);} },[]);
  useEffect(()=>{if(hydrated)localStorage.setItem("magnitech-products",JSON.stringify(products));},[products,hydrated]);
  useEffect(()=>{if(hydrated)localStorage.setItem("magnitech-cart",JSON.stringify(cart));},[cart,hydrated]);
  const store=useMemo<Store>(()=>({products,cart,setProducts,add:(id)=>setCart(c=>({...c,[id]:(c[id]||0)+1})),quantity:(id,d)=>setCart(c=>{const n=(c[id]||0)+d;if(n<=0){const next={...c};delete next[id];return next;}return {...c,[id]:n};}),clear:()=>setCart({})}),[products,cart]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
export function useStore(){const value=useContext(StoreContext);if(!value)throw new Error("useStore must be used inside StoreProvider");return value;}
