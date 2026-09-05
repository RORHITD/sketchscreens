/**
 * rough.js draws SVG shapes with explicit stroke/fill attribute VALUES — it
 * has no notion of CSS custom properties, so hand-drawn primitives can't just
 * say `stroke: var(--ss-ink)` and have dark mode "work". Instead we read the
 * already-cascaded value of a `--ss-*` token off a live DOM node (any node
 * inside the themed subtree — the CSS variable inherits down from wherever
 * `data-theme` was set) at draw time and hand rough.js a literal color.
 *
 * This only needs to run once per draw (themes don't change after mount), so
 * a plain `getComputedStyle` read is cheap enough to not bother caching.
 */
export function cssVar(el: Element | null | undefined, name: string, fallback: string): string {
  if (!el || typeof getComputedStyle !== "function") return fallback;
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}
