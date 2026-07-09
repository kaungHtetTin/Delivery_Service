import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import laravel from "laravel-vite-plugin";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ["leaflet"],
        },
      },
    },
  },
  plugins: [
    laravel({
      input: ["resources/js/main.jsx"],
      refresh: true,
    }),
    react(),
  ],
});
