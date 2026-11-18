import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 15 dev and build otherwise share `.next`. Running a production build
  // while `next dev` is open can replace the dev CSS manifest and yield 404s.
  // Keep dev assets isolated; Vercel and `next start` still use `.next`.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // Build autonome (server.js + node_modules minimal) pour l'image Docker
  output: process.platform === "win32" ? undefined : "standalone",
  // Monorepo : tracer les dépendances depuis la racine pour inclure les packages internes
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@maghitech/ui", "@maghitech/api-client"],
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: process.env.MEDIA_HOSTNAME ?? "**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
