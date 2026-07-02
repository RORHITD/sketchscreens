import type { ScreenElementT, ElementRegionT, ElementAlignT } from "@sketchscreens/core-schema";

/**
 * Turn a flat, ordered element list into the coarse on-screen layout:
 * a top band, a main band, and a bottom band, each a list of ROWS, where a row
 * is one-or-more elements shown side by side. This is what makes the sketch
 * mirror the real screen (a centered button centered, a bottom action bar at the
 * bottom, two buttons in a row) without pixel positions.
 *
 * Rules:
 *  - `region` places an element in top / main / bottom (default main).
 *  - consecutive elements in the SAME region that are both `center`- or
 *    `right`-aligned buttons collapse into one row (Cancel/Save bars, social
 *    button pairs). Everything else is its own full-width row.
 */

export interface LaidOutElement {
  element: ScreenElementT;
  align: ElementAlignT;
}
export type Row = LaidOutElement[];
export interface BandedLayout {
  top: Row[];
  main: Row[];
  bottom: Row[];
}

/** Default horizontal alignment when the extractor didn't set one. */
function defaultAlign(el: ScreenElementT): ElementAlignT {
  if (el.align) return el.align;
  switch (el.type) {
    case "heading":
    case "text":
      return "left";
    case "button":
      return el.variant === "primary" ? "center" : "left";
    case "nav":
    case "tabs":
    case "divider":
      return "full";
    default:
      return "full"; // inputs, selects, lists, cards…
  }
}

function regionOf(el: ScreenElementT): ElementRegionT {
  if (el.region) return el.region;
  if (el.type === "nav" || el.type === "tabs") return "top";
  return "main";
}

/** Can two adjacent elements share a horizontal row? */
function pairable(a: LaidOutElement, b: LaidOutElement): boolean {
  const bothButtons = a.element.type === "button" && b.element.type === "button";
  const sideAligned = (x: ElementAlignT) => x === "center" || x === "right";
  return bothButtons && sideAligned(a.align) && sideAligned(b.align);
}

export function layoutElements(elements: ScreenElementT[]): BandedLayout {
  const bands: Record<ElementRegionT, Row[]> = { top: [], main: [], bottom: [] };

  for (const el of elements) {
    const region = regionOf(el);
    const item: LaidOutElement = { element: el, align: defaultAlign(el) };
    const rows = bands[region];
    const prevRow = rows[rows.length - 1];

    // Cap merged rows at 3 — a 4th+ adjacent button wraps to a new row instead
    // of cramming the 260px frame.
    if (prevRow && prevRow.length > 0 && prevRow.length < 3 && pairable(prevRow[prevRow.length - 1]!, item)) {
      prevRow.push(item); // extend the current row (e.g. [Cancel][Save])
    } else {
      rows.push([item]);
    }
  }

  return { top: bands.top, main: bands.main, bottom: bands.bottom };
}

/**
 * Approximate rendered height of a single element, in px — weighted by type so
 * the layout height estimate matches the real DOM. (A list frame is far taller
 * than a heading; treating them equally is what forced the separation to be
 * cranked up.) Kept in sync with the rendered sizes in ScreenNode/sketch/CSS.
 */
export function elementHeight(el: ScreenElementT): number {
  const hasLabel = !!el.label;
  switch (el.type) {
    case "heading":
      return 20;
    case "text":
      return 22;
    case "divider":
      return el.label ? 18 : 12;
    case "checkbox":
    case "radio":
    case "toggle":
      return 20;
    case "button":
      return 30;
    case "nav":
    case "tabs":
      return 26;
    case "input":
    case "select":
      return (hasLabel ? 16 : 0) + 30;
    case "textarea":
      return (hasLabel ? 16 : 0) + 48;
    case "image":
      return 50;
    case "card":
      return el.group === "stats" ? 52 : 58;
    case "list":
    case "listbox":
      return (hasLabel ? 16 : 0) + 74;
    default:
      return 30;
  }
}

/** Height of one laid-out row = the tallest element in it (rows are side-by-side). */
export function rowHeight(row: Row): number {
  return Math.max(...row.map((r) => elementHeight(r.element)), 24);
}

/** Estimated total body height of all bands (sum of row heights + gaps). */
export function bandsHeight(layout: BandedLayout): number {
  const rows = [...layout.top, ...layout.main, ...layout.bottom];
  const rowGap = 9;
  const bandGap = 12;
  const bands = [layout.top, layout.main, layout.bottom].filter((b) => b.length).length;
  return rows.reduce((sum, r) => sum + rowHeight(r), 0) + rows.length * rowGap + bands * bandGap;
}
