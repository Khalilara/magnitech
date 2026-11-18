import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/components/store-provider";
import { Footer, Header } from "@/components/storefront";

export const metadata: Metadata = {
  title: { default: "MAGNITECH — Technology, thoughtfully chosen", template: "%s | MAGNITECH" },
  description: "A considered collection of everyday technology, accessories and smart devices.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body><StoreProvider><Header />{children}<Footer /></StoreProvider></body>
    </html>
  );
}
