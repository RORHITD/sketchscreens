#!/usr/bin/env node
/**
 * sketchscreens — the one command.
 *
 *   sketchscreens doctor              check the install; build the renderer if needed
 *   sketchscreens prompt              print the extraction prompt (what the agent follows)
 *   sketchscreens open <map.json>     validate + serve a map in the local viewer
 *   sketchscreens map <cand> [out]    validate + write a candidate map, then serve it
 *   sketchscreens --help
 *
 * This is the abstraction boundary the skill talks to: no monorepo-internal
 * paths, no two-invocation dance, no "build first" preamble — the CLI ensures
 * the renderer is built and dispatches to the right package.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));

/** Resolve a workspace package's directory (works in the monorepo + installed). */
function pkgDir(name) {
  try {
    const pj = fileURLToPath(import.meta.resolve(`${name}/package.json`));
    return dirname(pj);
  } catch {
    // Monorepo fallback: sibling under packages/ or apps/.
    for (const base of ["../../packages", "../../apps"]) {
      const d = resolve(here, base, name.replace(/^@sketchscreens\//, ""));
      if (existsSync(join(d, "package.json"))) return d;
    }
    return null;
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  return r.status ?? 1;
}

/** Ensure the renderer is built (dist/index.html present); build if missing. */
function ensureRendererBuilt() {
  const dir = pkgDir("@sketchscreens/renderer");
  if (dir && existsSync(join(dir, "dist", "index.html"))) return true;
  console.log("Renderer not built yet — building (one-time)…");
  // Prefer a workspace filter build; fall back to a direct build in the dir.
  const root = dir && resolve(dir, "../..");
  const viaPnpm = run("pnpm", ["--filter", "@sketchscreens/renderer", "build"], { cwd: root });
  if (viaPnpm === 0) return true;
  if (dir) return run("npm", ["run", "build"], { cwd: dir }) === 0;
  return false;
}

/** Ensure the extractor is built (dist/index.js present); build if missing. */
function ensureExtractorBuilt() {
  const dir = pkgDir("@sketchscreens/extractor");
  if (dir && existsSync(join(dir, "dist", "index.js"))) return true;
  const root = dir && resolve(dir, "../..");
  run("pnpm", ["--filter", "@sketchscreens/core-schema", "build"], { cwd: root });
  const s = run("pnpm", ["--filter", "@sketchscreens/extractor", "build"], { cwd: root });
  return s === 0;
}

function extractorBin(name) {
  const dir = pkgDir("@sketchscreens/extractor");
  return dir ? join(dir, "bin", name) : null;
}
function viewerBin() {
  const dir = pkgDir("@sketchscreens/viewer");
  return dir ? join(dir, "bin", "view.js") : null;
}

function usage() {
  console.log(`sketchscreens — sketch-wireframe an app from its source

  sketchscreens doctor            check the install (builds the renderer if needed)
  sketchscreens prompt            print the extraction prompt the agent follows
  sketchscreens open <map.json>   validate + open a map in the local viewer
  sketchscreens map <cand> [out]  validate + write a candidate map, then open it

Run /visual-map in your coding agent to generate a map, or author one by hand
following \`sketchscreens prompt\`.`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
    case undefined:
    case "-h":
    case "--help":
    case "help":
      usage();
      return 0;

    case "doctor": {
      console.log(`node ${process.version}`);
      const okR = ensureRendererBuilt();
      const okE = ensureExtractorBuilt();
      console.log(`renderer build: ${okR ? "ok" : "MISSING"}`);
      console.log(`extractor build: ${okE ? "ok" : "MISSING"}`);
      const p = extractorBin("write-map.js");
      console.log(`extraction prompt: ${p ? "available (sketchscreens prompt)" : "unknown"}`);
      return okR && okE ? 0 : 1;
    }

    case "prompt": {
      const { EXTRACTION_PROMPT_PATH } = await import("@sketchscreens/extractor").catch(() => ({}));
      if (EXTRACTION_PROMPT_PATH && existsSync(EXTRACTION_PROMPT_PATH)) {
        const { readFileSync } = await import("node:fs");
        process.stdout.write(readFileSync(EXTRACTION_PROMPT_PATH, "utf8"));
        return 0;
      }
      // Fallback to the file on disk.
      const dir = pkgDir("@sketchscreens/extractor");
      const f = dir && join(dir, "prompts", "extract.md");
      if (f && existsSync(f)) {
        const { readFileSync } = await import("node:fs");
        process.stdout.write(readFileSync(f, "utf8"));
        return 0;
      }
      console.error("Could not locate the extraction prompt.");
      return 1;
    }

    case "open": {
      const map = rest[0];
      if (!map) return (console.error("Usage: sketchscreens open <map.json> [--port N] [--no-open]"), 1);
      ensureRendererBuilt();
      const bin = viewerBin();
      if (!bin) return (console.error("Viewer not found."), 1);
      return run(process.execPath, [bin, ...rest]);
    }

    case "map": {
      const flags = rest.filter((a) => a.startsWith("--"));
      const pos = rest.filter((a) => !a.startsWith("--"));
      const cand = pos[0];
      const out = pos[1] || "sketchscreens.map.json";
      const noServe = flags.includes("--no-serve");
      if (!cand) return (console.error("Usage: sketchscreens map <candidate.json> [out.json] [--no-serve] [--no-open]"), 1);
      ensureExtractorBuilt();
      const wm = extractorBin("write-map.js");
      const status = run(process.execPath, [wm, cand, out]);
      if (status !== 0) return status; // invalid map — write-map already explained
      if (noServe) return 0; // validate + write only (scripts / CI)
      ensureRendererBuilt();
      const bin = viewerBin();
      return run(process.execPath, [bin, out, ...flags.filter((f) => f !== "--no-serve")]);
    }

    default:
      console.error(`Unknown command: ${cmd}\n`);
      usage();
      return 1;
  }
}

main().then((code) => process.exit(code ?? 0));
