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
  const lastAlign: Record<ElementRegionT, string | null> = { top: null, main: null, bottom: null };

  for (const el of elements) {
    const region = regionOf(el);
    const item: LaidOutElement = { element: el, align: defaultAlign(el) };
    const rows = bands[region];
    const prevRow = rows[rows.length - 1];

    if (prevRow && prevRow.length > 0 && pairable(prevRow[prevRow.length - 1]!, item)) {
      prevRow.push(item); // extend the current row (e.g. [Cancel][Save])
    } else {
      rows.push([item]);
    }
    lastAlign[region] = item.align;
  }

  return { top: bands.top, main: bands.main, bottom: bands.bottom };
}

/** Total number of rendered rows across all bands (for height estimation). */
export function rowCount(layout: BandedLayout): number {
  return layout.top.length + layout.main.length + layout.bottom.length;
}
