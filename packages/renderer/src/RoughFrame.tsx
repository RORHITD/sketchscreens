import { useEffect, useRef, useState } from "react";
import rough from "roughjs";

/**
 * A hand-drawn rectangular frame that auto-sizes to its content.
 *
 * Used for the screen card and the `card` element, replacing wired-card (whose
 * hachure fill calls a rough.js method that throws in the current RC). A
 * ResizeObserver redraws the border whenever the content reflows, so the sketch
 * frame always hugs the elements inside it.
 */
export function RoughFrame({
  children,
  className,
  seed = 1,
  roughness = 1.3,
}: {
  children: React.ReactNode;
  className?: string;
  seed?: number;
  roughness?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: host.clientWidth, h: host.clientHeight });
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.w === 0 || size.h === 0) return;
    svg.setAttribute("viewBox", `0 0 ${size.w} ${size.h}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = rough.svg(svg);
    svg.appendChild(
      rc.rectangle(2, 2, size.w - 4, size.h - 4, {
        stroke: "#2b2b2b",
        strokeWidth: 1.1,
        roughness,
        seed,
        fill: "#fdfdfb",
        fillStyle: "solid",
      }),
    );
  }, [size, seed, roughness]);

  return (
    <div ref={hostRef} className={`ss-frame${className ? " " + className : ""}`}>
      <svg
        ref={svgRef}
        className="ss-frame-svg"
        width={size.w}
        height={size.h}
        aria-hidden="true"
      />
      <div className="ss-frame-content">{children}</div>
    </div>
  );
}
