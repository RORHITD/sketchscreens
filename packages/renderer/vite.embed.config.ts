import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Builds the embeddable bundle: ONE self-contained, minified IIFE file
 * (`dist-embed/sketchscreens-embed.js`) exposing `window.SketchScreens.mount`.
 *
 * Everything is bundled in on purpose — React, ReactDOM, @xyflow/react, dagre,
 * roughjs — so a plain-JS host page only needs a single <script src> and a
 * strict CSP that allows same-origin scripts (no CDN, no external chunks). CSS
 * is imported as raw text (`?raw` in embed.tsx) and injected via a <style>
 * tag at mount time instead of being extracted as a separate asset, which is
 * what keeps this a ONE-file build — `cssCodeSplit` is irrelevant here since
 * embed.tsx never imports a stylesheet through Vite's normal CSS pipeline.
 *
 * This is a SEPARATE config from vite.config.ts (the normal `pnpm build` /
 * `pnpm dev` app) on purpose: different `build.lib` target, different output
 * dir, different format. Run via `pnpm build:embed`.
 */
export default defineConfig({
  plugins: [react()],
  // React (and friends) read process.env.NODE_ENV directly; Vite's own app
  // build replaces this via its default esbuild config, but a `lib` build
  // does not always inherit that automatically for a bare `process` global —
  // a plain-JS host page has no Node polyfill, so left alone this throws
  // `ReferenceError: process is not defined` the instant the bundle runs.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-embed",
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    lib: {
      entry: "src/embed.tsx",
      name: "SketchScreens",
      formats: ["iife"],
      fileName: () => "sketchscreens-embed.js",
    },
    // No `rollupOptions.external` — react/react-dom/@xyflow/react/
    // @dagrejs/dagre/roughjs all get bundled into the single output file.
  },
});
