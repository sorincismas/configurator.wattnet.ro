import type { NextConfig } from "next";

/**
 * Aplicatie 100% client-side, exportata static (fara server, fara baza de date).
 * Merge pe Vercel, Cloudflare Pages, Netlify sau orice hosting static.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
