import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

export default defineConfig({
  plugins: [
    dyadComponentTagger(), 
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
