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
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

import { validateProjectMap } from "@sketchscreens/core-schema";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Build ONE self-contained HTML string: the renderer's built JS + CSS inlined
 * (so there are no external asset requests) plus the map on `window`. The
 * result opens in any browser offline and can be emailed/hosted as a single file.
 * @param {string} dist
 * @param {string} indexHtml
 * @param {unknown} map
 */
async function buildStandaloneHtml(dist, indexHtml, map) {
  const assetsDir = join(dist, "assets");
  const files = existsSync(assetsDir) ? await readdir(assetsDir) : [];
  const jsFile = files.find((f) => f.endsWith(".js"));
  const cssFile = files.find((f) => f.endsWith(".css"));
  const js = jsFile ? await readFile(join(assetsDir, jsFile), "utf8") : "";
  const css = cssFile ? await readFile(join(assetsDir, cssFile), "utf8") : "";

  // Base64 the JS bundle into a data: URI. This sidesteps every HTML-parsing
  // pitfall of inlining a huge minified bundle (a literal "</script>" inside the
  // JS would otherwise close the tag early and corrupt the document).
  const jsDataUri = "data:text/javascript;base64," + Buffer.from(js, "utf8").toString("base64");
  // The map JSON goes in a normal script; escape "</script" just in case.
  const mapJson = JSON.stringify(map).replace(/<\/(script)/gi, "<\\/$1");

  let html = indexHtml;
  // Drop the external stylesheet link(s) and the external module script tag —
  // we inline/redirect both below.
  html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/g, "");
  html = html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g, "");

  const head =
    `<script>window.__SKETCHSCREENS_MAP__ = ${mapJson};</script>` +
    (css ? `\n<style>${css}</style>` : "");
  html = html.replace("</head>", `${head}\n</head>`);
  html = html.replace("</body>", `<script type="module" src="${jsDataUri}"></script>\n</body>`);
  return html;
}

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
  /** @type {{ mapPath: string | null, port: number, open: boolean, exportHtml: string | null }} */
  const args = { mapPath: null, port: 4318, open: true, exportHtml: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--no-open") args.open = false;
    else if (a === "--export-html") args.exportHtml = argv[++i] || "sketchscreens.html";
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
  const opts = parseArgs(process.argv.slice(2));
  const { mapPath, port, open } = opts;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid --port value (expected 1-65535).`);
    process.exit(1);
  }

  if (!mapPath) {
    console.error("Usage: sketchscreens-view <path-to-map.json> [--port N] [--no-open] [--export-html [file]]");
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

  // --export-html: emit ONE self-contained .html (renderer JS+CSS + map all
  // inlined) — a portable file you can email/host anywhere, no server, no
  // account. The free "share a file" story.
  if (opts.exportHtml) {
    const html = await buildStandaloneHtml(dist, indexHtml, map);
    const outPath = resolve(process.cwd(), opts.exportHtml);
    await writeFile(outPath, html, "utf8");
    const kb = Math.round(Buffer.byteLength(html) / 1024);
    console.log(`\n  Exported self-contained map → ${outPath} (${kb} KB)`);
    console.log("  Open it in any browser, or email/host it anywhere.\n");
    return;
  }

  const server = createServer(async (req, res) => {
    const url = (req.url || "/").split("?")[0];
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": MIME[".html"] });
      res.end(injected);
      return;
    }
    // Serve built assets, guarding against path traversal. Compare against
    // dist + sep so a sibling dir sharing the prefix (dist-foo) can't match.
    const filePath = join(dist, url);
    if (!filePath.startsWith(dist + sep) || !existsSync(filePath)) {
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

  // Bind to the requested port; if it's busy, walk to the next free one (this
  // tool is re-run-heavy — a stale server on the port shouldn't crash it).
  let attempts = 0;
  /** @param {number} p */
  const listen = (p) => {
    server.once("error", (/** @type {NodeJS.ErrnoException} */ err) => {
      if (err.code === "EADDRINUSE" && attempts < 20) {
        attempts++;
        listen(p + 1);
      } else {
        console.error(`Could not start server: ${err.message}`);
        process.exit(1);
      }
    });
    server.listen(p, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${p}/`;
      if (p !== port) console.log(`  (port ${port} was busy — using ${p})`);
      console.log(`\n  SketchScreens — ${map.name}`);
      console.log(`  ${map.screens.length} screens · ${map.edges.length} flows`);
      console.log(`\n  ▶  ${url}\n`);
      console.log("  (Ctrl+C to stop)\n");
      if (open) openBrowser(url);
    });
  };
  listen(port);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
