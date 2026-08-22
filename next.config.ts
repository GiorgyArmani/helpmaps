import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: import.meta.dirname },
  experimental: {
    // Don't preload every route's modules at startup — keeps the dev server's JS heap
    // flat (the single-country app OOMed without this).
    preloadEntriesOnStart: false,
  },
  // El manual de marca se sirve en /marca. El archivo vive en `public/marca/index.html`
  // —copia de `docs/marca/manual-marca.html`, que es la fuente— y esta reescritura es lo
  // que hace que la URL sin extensión funcione.
  async rewrites() {
    return [{ source: "/marca", destination: "/marca/index.html" }];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
