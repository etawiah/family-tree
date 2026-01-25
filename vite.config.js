import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration tailored for Cloudflare Pages deployment.
export default defineConfig({
  // React plugin enables JSX, Fast Refresh, and modern React transforms.
  plugins: [react()],

  // Only load environment variables prefixed with VITE_ for client safety.
  envPrefix: "VITE_",

  build: {
    // Cloudflare Pages expects static output in the dist/ directory.
    outDir: "dist",
    // Keep the default assets directory for predictable hosting paths.
    assetsDir: "assets",
    // Sourcemaps help debug production issues without shipping full source.
    sourcemap: true,
  },

  server: {
    // Keep the default Vite port while failing fast if it is taken.
    port: 5173,
    strictPort: true,
  },

  preview: {
    // Match the default preview port and fail fast if unavailable.
    port: 4173,
    strictPort: true,
  },
});
