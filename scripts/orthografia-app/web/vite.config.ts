import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["content/**/*"],
      manifest: {
        name: "Ορθογραφία",
        short_name: "Ορθογραφία",
        description: "Εκμάθηση ελληνικής ορθογραφίας",
        theme_color: "#2a9d8f",
        background_color: "#f7f3ea",
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
        globPatterns: ["**/*.{js,css,html,json,mp3,wav,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /\/content\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "orthografia-content",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
