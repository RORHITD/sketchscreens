import { useEffect, useRef } from "react";
import rough from "roughjs";

/**
 * A hand-drawn on/off toggle drawn with rough.js.
 *
 * Replaces wired-toggle, which fills its knob via `hachureEllipseFill` → a
 * rough.js method that throws in this RC. We draw a pill track + a knob circle
 * with solid fill (no hachure), so nothing throws.
 */
export function RoughToggle({ on = false, seed = 5 }: { on?: boolean; seed?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const w = 40;
  const h = 20;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = rough.svg(svg);
    // Track (a rounded-ish rectangle; rough.js has no rounded rect, so a plain
    // one reads fine at sketch fidelity).
    svg.appendChild(
      rc.rectangle(1, 3, w - 2, h - 6, {
        stroke: "#2b2b2b",
        strokeWidth: 1,
        roughness: 1.2,
        seed,
        fill: on ? "#d7e6ee" : "transparent",
        fillStyle: "solid",
      }),
    );
    // Knob.
    const knobX = on ? w - 8 : 8;
    svg.appendChild(
      rc.circle(knobX, h / 2, 12, {
        stroke: "#2b2b2b",
        strokeWidth: 1,
        roughness: 1.1,
        seed: seed + 1,
        fill: "#fdfdfb",
        fillStyle: "solid",
      }),
    );
  }, [on, seed]);

  return <svg ref={svgRef} className="ss-toggle-svg" width={w} height={h} aria-hidden="true" />;
}
