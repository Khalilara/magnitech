"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { initialProducts, type Product } from "@/lib/products";

type Store = {
  products: Product[];
  cart: Record<string, number>;
  notice: string;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  add: (id: string) => void;
  quantity: (id: string, delta: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  dismissNotice: () => void;
};

const StoreContext = createContext<Store | null>(null);

function readCart(value: string | null): Record<string, number> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, count]) =>
      typeof count === "number" && Number.isInteger(count) && count > 0
        ? [[id, Math.min(count, 99)]] : []));
  } catch {
    return {};
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState(initialProducts);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const response = await fetch("/api/products", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load products");
        const remoteProducts = await response.json() as Product[];
        if (!cancelled) setProducts(remoteProducts);
      } catch {
        // Keep the bundled catalog if D1 is unavailable.
      }
    }
    void loadProducts();
    setCart(readCart(localStorage.getItem("magnitech-cart")));
    setHydrated(true);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("magnitech-cart", JSON.stringify(cart));
  }, [cart, hydrated]);

  const store = useMemo<Store>(() => ({
    products,
    cart,
    notice,
    setProducts,
    add: (id) => {
      setCart((current) => ({ ...current, [id]: Math.min(99, (current[id] ?? 0) + 1) }));
      setNotice("Added to cart");
    },
    quantity: (id, delta) => setCart((current) => {
      const nextQuantity = Math.max(0, Math.min(99, (current[id] ?? 0) + delta));
      if (!nextQuantity) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: nextQuantity };
    }),
    remove: (id) => setCart((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    }),
    clear: () => setCart({}),
    dismissNotice: () => setNotice(""),
  }), [products, cart, notice]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
