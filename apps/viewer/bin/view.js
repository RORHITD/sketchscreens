#!/usr/bin/env node
/**
 * sketchscreens-view — serve the renderer + a map.json on localhost, open browser.
 *
 * Usage:
 *   sketchscreens-view <path-to-map.json> [--port 4318] [--no-open]
 *
 * Local-first by design: binds to 127.0.0.1 only. Nothing about the user's code
 * leaves the machine. The map is validated before serving.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

import { validateProjectMap } from "@sketchscreens/core-schema";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {Record<string, string>} */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ mapPath: string | null, port: number, open: boolean }} */
  const args = { mapPath: null, port: 4318, open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--no-open") args.open = false;
    else if (!a.startsWith("--")) args.mapPath = a;
  }
  return args;
}

/** Locate the renderer's built dist/ directory. */
function findRendererDist() {
  // Resolve the renderer package, then its dist. Works from the monorepo and
  // from a global install where the package is a real dependency.
  const candidates = [
    resolve(here, "../../../packages/renderer/dist"),
    (() => {
      try {
        const pkg = fileURLToPath(
          import.meta.resolve("@sketchscreens/renderer/package.json"),
        );
        return join(dirname(pkg), "dist");
      } catch {
        return null;
      }
    })(),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (dir && existsSync(join(dir, "index.html"))) return dir;
  }
  return null;
}

/** @param {string} url */
function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true, shell: platform === "win32" }).unref();
}

async function main() {
  const { mapPath, port, open } = parseArgs(process.argv.slice(2));

  if (!mapPath) {
    console.error("Usage: sketchscreens-view <path-to-map.json> [--port N] [--no-open]");
    process.exit(1);
  }

  const abs = resolve(process.cwd(), mapPath);
  if (!existsSync(abs)) {
    console.error(`Map file not found: ${abs}`);
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(abs, "utf8"));
  const result = validateProjectMap(raw);
  if (!result.ok || !result.map) {
    console.error("The map is not a valid ProjectMap:");
    for (const issue of result.issues) console.error(`  - ${issue.message}`);
    process.exit(1);
    return;
  }
  const map = result.map;

  const dist = findRendererDist();
  if (!dist) {
    console.error(
      "Renderer build not found. Run `pnpm --filter @sketchscreens/renderer build` first.",
    );
    process.exit(1);
  }

  const indexHtml = await readFile(join(dist, "index.html"), "utf8");
  // Inject the validated map so the renderer reads it from window.
  const injected = indexHtml.replace(
    "<head>",
    `<head>\n<script>window.__SKETCHSCREENS_MAP__ = ${JSON.stringify(map)};</script>`,
  );

  const server = createServer(async (req, res) => {
    const url = (req.url || "/").split("?")[0];
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": MIME[".html"] });
      res.end(injected);
      return;
    }
    // Serve built assets, guarding against path traversal.
    const filePath = join(dist, url);
    if (!filePath.startsWith(dist) || !existsSync(filePath)) {
      res.writeHead(404).end("Not found");
      return;
    }
    try {
      const body = await readFile(filePath);
      res.writeHead(200, { "content-type": MIME[extname(filePath)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(500).end("Read error");
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`\n  SketchScreens — ${map.name}`);
    console.log(`  ${map.screens.length} screens · ${map.edges.length} flows`);
    console.log(`\n  ▶  ${url}\n`);
    console.log("  (Ctrl+C to stop)\n");
    if (open) openBrowser(url);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
