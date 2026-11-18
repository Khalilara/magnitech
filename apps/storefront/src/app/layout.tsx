import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Magnitech — Le commerce qui a du cœur", template: "%s | Magnitech" },
  description:
    "Découvrez les pépites de la tech et du quotidien chez des commerçants indépendants.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
