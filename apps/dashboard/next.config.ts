import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome (server.js + node_modules minimal) pour l'image Docker
  output: process.platform === "win32" ? undefined : "standalone",
  // Monorepo : tracer les dépendances depuis la racine pour inclure les packages internes
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@maghitech/ui", "@maghitech/api-client"],
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: process.env.MEDIA_HOSTNAME ?? "**" }],
  },
};

export default nextConfig;
