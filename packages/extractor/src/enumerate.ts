/**
 * Static screen ENUMERATION — the deterministic "what screens exist" pass.
 *
 * This is the cheap-but-crucial half of extraction: an agent can misread a file
 * it opened, but it can't read a file it never listed. So we enumerate the true
 * screen set from the filesystem convention (no full parse, no LLM), and use it
 * to (a) seed the agent and (b) report coverage (discovered vs mapped) so a
 * silently-missed surface — like an omitted auth flow — becomes visible.
 *
 * Enumeration ONLY. Element reading stays with the agent (the whole point of
 * agent-first: no per-framework element parser to maintain).
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ProjectMap } from "@sketchscreens/core-schema";

export interface DiscoveredScreen {
  /** Stable id derived from the route/path (kebab-case). */
  id: string;
  /** URL path or widget identifier. */
  route: string;
  /** Repo-relative path of the screen-defining file. */
  sourceFile: string;
}

export type Stack = "next-app" | "next-pages" | "flutter" | "unknown";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
]);

/** Walk a directory tree, yielding files that match `pred`. */
function walk(root: string, pred: (relPath: string) => boolean, acc: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(join(root, e.name), pred, acc);
    } else if (e.isFile()) {
      const full = join(root, e.name);
      if (pred(full)) acc.push(full);
    }
  }
  return acc;
}

/** Detect the stack from the repo layout. */
export function detectStack(repoRoot: string): Stack {
  const has = (p: string) => existsSync(join(repoRoot, p)) && statSync(join(repoRoot, p)).isDirectory();
  if (has("src/app") || has("app")) return "next-app";
  if (has("src/pages") || has("pages")) return "next-pages";
  if (has("lib") && existsSync(join(repoRoot, "pubspec.yaml"))) return "flutter";
  return "unknown";
}

/** kebab-case an arbitrary string for a stable id. */
function kebab(s: string): string {
  return (
    s
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/^-+|-+$/g, "") || "screen"
  );
}

/** Next.js App Router: each `page.{tsx,jsx}` is a route; folder path → URL. */
function enumerateNextApp(repoRoot: string): DiscoveredScreen[] {
  const appDir = existsSync(join(repoRoot, "src/app")) ? join(repoRoot, "src/app") : join(repoRoot, "app");
  const files = walk(appDir, (f) => /[/\\]page\.(tsx|jsx|ts|js)$/.test(f));
  return files.map((abs) => {
    const relFromApp = relative(appDir, abs).split(sep).slice(0, -1); // drop page.tsx
    // Strip (route groups); [param] -> :param; @slots and _private are skipped later.
    const segs = relFromApp
      .filter((s) => !(s.startsWith("(") && s.endsWith(")")))
      .filter((s) => !s.startsWith("@"))
      .map((s) => s.replace(/^\[(\.\.\.)?(.+)\]$/, ":$2"));
    const route = "/" + segs.join("/");
    return {
      id: kebab(route === "/" ? "home" : route),
      route: route === "/" ? "/" : route,
      sourceFile: relative(repoRoot, abs),
    };
  });
}

/** Next.js Pages Router: files under pages/ (excluding _app/_document/api). */
function enumerateNextPages(repoRoot: string): DiscoveredScreen[] {
  const pagesDir = existsSync(join(repoRoot, "src/pages")) ? join(repoRoot, "src/pages") : join(repoRoot, "pages");
  const files = walk(pagesDir, (f) => /\.(tsx|jsx|ts|js)$/.test(f));
  return files
    .filter((f) => !/[/\\]_(app|document)\.|[/\\]api[/\\]/.test(f))
    .map((abs) => {
      const rel = relative(pagesDir, abs).replace(/\.(tsx|jsx|ts|js)$/, "");
      const segs = rel
        .split(sep)
        .filter((s) => s !== "index")
        .map((s) => s.replace(/^\[(\.\.\.)?(.+)\]$/, ":$2"));
      const route = "/" + segs.join("/");
      return { id: kebab(route === "/" ? "home" : route), route: route || "/", sourceFile: relative(repoRoot, abs) };
    });
}

/** Flutter: classes ending Screen/Page/View that extend a widget. */
function enumerateFlutter(repoRoot: string): DiscoveredScreen[] {
  const libDir = join(repoRoot, "lib");
  const files = walk(libDir, (f) => /\.dart$/.test(f));
  const screens: DiscoveredScreen[] = [];
  const re = /class\s+(\w+(?:Screen|Page|View))\s+extends\s+(?:Stateless|Stateful)Widget/g;
  for (const abs of files) {
    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const cls = m[1]!;
      screens.push({ id: kebab(cls), route: cls, sourceFile: relative(repoRoot, abs) });
    }
  }
  return screens;
}

/** Enumerate the true screen set for a repo. Empty if the stack is unknown. */
export function enumerateScreens(repoRoot: string, stack: Stack = detectStack(repoRoot)): {
  stack: Stack;
  screens: DiscoveredScreen[];
} {
  switch (stack) {
    case "next-app":
      return { stack, screens: enumerateNextApp(repoRoot) };
    case "next-pages":
      return { stack, screens: enumerateNextPages(repoRoot) };
    case "flutter":
      return { stack, screens: enumerateFlutter(repoRoot) };
    default:
      return { stack: "unknown", screens: [] };
  }
}

export interface CoverageReport {
  stack: Stack;
  discovered: number;
  mapped: number;
  /** Discovered screen files that are NOT in the map (potential omissions). */
  missing: DiscoveredScreen[];
  /** Map screens whose sourceFile isn't among the discovered files (agent-added). */
  extra: string[];
}

/**
 * Compare a produced map against the statically-discovered screen set.
 * Matches on sourceFile primarily (the reliable key), route as a fallback.
 */
export function coverage(map: ProjectMap, repoRoot: string): CoverageReport {
  const { stack, screens: discovered } = enumerateScreens(repoRoot);
  const mappedFiles = new Set(map.screens.map((s) => s.sourceFile).filter(Boolean) as string[]);
  const mappedRoutes = new Set(map.screens.map((s) => s.route).filter(Boolean) as string[]);

  const missing = discovered.filter(
    (d) => !mappedFiles.has(d.sourceFile) && !mappedRoutes.has(d.route),
  );
  const discoveredFiles = new Set(discovered.map((d) => d.sourceFile));
  const extra = map.screens
    .filter((s) => s.sourceFile && !discoveredFiles.has(s.sourceFile))
    .map((s) => s.id);

  return {
    stack,
    discovered: discovered.length,
    mapped: discovered.length - missing.length,
    missing,
    extra,
  };
}
