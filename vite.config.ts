import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  // Self-hosted woff2 fonts are imported via relative URLs in styles.css;
  // the build emits a hashed copy under /assets/.
  assetsInclude: ["**/*.woff2"],
  publicDir: "public",
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Emit a stable name for the font assets so the preload link works.
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".woff2")) {
            return "fonts/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true
      }
    }
  }
});
