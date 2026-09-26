import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const clerkKey = process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
if (process.env.VERCEL_ENV === "production" && clerkKey.startsWith("pk_test_")) {
  console.warn(
    "[build] VITE_CLERK_PUBLISHABLE_KEY is a Clerk *test* key in production. " +
      "Replace with pk_live_… in Vercel → Settings → Environment Variables.",
  );
}

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Ορθογραφία",
        short_name: "Ορθογραφία",
        description: "Εκμάθηση ελληνικής ορθογραφίας",
        theme_color: "#1B4F72",
        background_color: "#F3F6FA",
        display: "standalone",
        lang: "el",
        icons: [
          {
            src: "icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        // Keep the app shell small — content (JSON + audio) is fetched on demand.
        globPatterns: ["**/*.{js,css,html,ico,svg,webmanifest}"],
        globIgnores: ["**/content/**"],
        runtimeCaching: [
          {
            // StaleWhileRevalidate so new Vercel deploys reach users without a full precache refresh.
            urlPattern: /\/content\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "orthografia-content",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
