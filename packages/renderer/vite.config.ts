import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// wired-elements ships as Lit-based Web Components. React 19 binds custom
// elements natively, so no compiler config is needed — but we tell esbuild to
// leave the custom-element tag names alone.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4317,
    // Local-first: bind to localhost only. Nothing about the user's code is
    // exposed to the network.
    host: "127.0.0.1",
  },
  // The viewer app injects the map at window.__SKETCHSCREENS_MAP__; in dev we
  // fall back to loading examples/ over a fetch (see src/loadMap.ts).
});
