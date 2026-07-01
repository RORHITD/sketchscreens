import { useEffect, useRef } from "react";
import rough from "roughjs";

/**
 * A hand-drawn rectangle drawn with rough.js, with children layered on top.
 *
 * We use this instead of a few of wired-elements' components that are buggy in
 * the current release candidate (notably wired-combo, whose dropdown-arrow fill
 * calls a rough.js method that throws). rough.js draws only the border/fill —
 * text and any glyphs are normal DOM layered over the sketch (the same approach
 * Excalidraw uses).
 */
export function RoughBox({
  height = 30,
  children,
  chevron = false,
  seed = 1,
}: {
  height?: number;
  children?: React.ReactNode;
  /** Draw a hand-sketched dropdown chevron on the right (for selects). */
  chevron?: boolean;
  seed?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const w = svg.clientWidth || 220;
    const h = height;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const rc = rough.svg(svg);
    svg.appendChild(
      rc.rectangle(2, 2, w - 4, h - 4, {
        stroke: "#2b2b2b",
        strokeWidth: 1,
        roughness: 1.4,
        seed,
      }),
    );
    if (chevron) {
      const cx = w - 16;
      const cy = h / 2 - 2;
      svg.appendChild(
        rc.linearPath(
          [
            [cx - 5, cy - 2],
            [cx, cy + 3],
            [cx + 5, cy - 2],
          ],
          { stroke: "#2b2b2b", strokeWidth: 1, roughness: 1.2, seed },
        ),
      );
    }
  }, [height, chevron, seed]);

  return (
    <div className="ss-roughbox" style={{ height }}>
      <svg ref={svgRef} className="ss-roughbox-svg" width="100%" height={height} />
      <div className="ss-roughbox-content">{children}</div>
    </div>
  );
}
