import { validateProjectMap, type ProjectMapT } from "@sketchscreens/core-schema";
// Dev fallback, bundled at build time so `pnpm dev` always has something to show.
import sampleMap from "../../../examples/shopwave-web-journey.map.json";

declare global {
  interface Window {
    /** The viewer server / skill injects the map here before the app boots. */
    __SKETCHSCREENS_MAP__?: unknown;
  }
}

/**
 * Resolve the ProjectMap to render.
 *
 * Priority:
 *  1. `window.__SKETCHSCREENS_MAP__` — injected by the local viewer or the skill.
 *  2. `?map=<url>` query param — fetch a map.json from a URL.
 *  3. Dev fallback — the committed Shopwave sample, so `pnpm dev` shows something.
 */
export async function loadProjectMap(): Promise<ProjectMapT> {
  const injected = window.__SKETCHSCREENS_MAP__;
  if (injected) {
    return validated(injected, "window.__SKETCHSCREENS_MAP__");
  }

  const url = new URLSearchParams(window.location.search).get("map");
  if (url) {
    // Only http(s) maps — blocks data:/javascript:/file: smuggled via ?map=.
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Refusing to load map from ${parsed.protocol} URL — use http(s).`);
    }
    const res = await fetch(parsed);
    if (!res.ok) {
      throw new Error(`Failed to fetch map from ${url}: ${res.status}`);
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`The response from ${url} is not valid JSON.`);
    }
    return validated(json, url);
  }

  return validated(sampleMap, "examples/shopwave-web-journey.map.json (dev fallback)");
}

function validated(raw: unknown, source: string): ProjectMapT {
  const result = validateProjectMap(raw);
  if (!result.ok || !result.map) {
    const detail = result.issues.map((i) => `  - ${i.message}`).join("\n");
    throw new Error(`Invalid ProjectMap from ${source}:\n${detail}`);
  }
  return result.map;
}
