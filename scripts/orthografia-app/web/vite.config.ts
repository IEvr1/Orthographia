import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
      includeAssets: ["content/**/*"],
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
        globPatterns: ["**/*.{js,css,html,json,mp3,wav,png,svg}"],
        runtimeCaching: [
          {
            // Prefer network so content deploys (words.json / audio) aren't stuck for a year.
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
