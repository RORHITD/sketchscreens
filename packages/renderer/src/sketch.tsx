import { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import type { RoughSVG } from "roughjs/bin/svg";

/**
 * The hand-drawn primitive kit — all wireframe shapes drawn with rough.js, one
 * rendering engine, one visual language.
 *
 * Replaces wired-elements entirely: that dependency is a stale release
 * candidate whose fills throw, and mixing its Web Components with our rough.js
 * meant two wobble styles + two stroke colors + no control over button
 * variants. Everything here is ~15 lines of rough.js we fully own.
 *
 * rough.js draws only strokes/fills; text and glyphs are normal DOM layered on
 * top (the same approach Excalidraw uses).
 */

const INK = "#2b2b2b";

/**
 * Measure a host element's width with a ResizeObserver and hand it to a draw
 * callback. Fixes the first-paint `clientWidth === 0` double-draw: we never draw
 * until we have a real width.
 */
function useRoughDraw(
  height: number,
  draw: (rc: RoughSVG, w: number, h: number) => void,
  deps: unknown[],
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => setW(host.clientWidth));
    ro.observe(host);
    setW(host.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || w === 0) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${height}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    draw(rough.svg(svg), w, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, height, ...deps]);

  return { hostRef, svgRef, w };
}

/** A hand-drawn rounded-ish rectangle input field. */
export function SketchInput({
  placeholder,
  seed = 1,
}: {
  placeholder?: string;
  seed?: number;
}) {
  const h = 26;
  const { hostRef, svgRef } = useRoughDraw(
    h,
    (rc, w) => {
      svgRef.current!.appendChild(
        rc.rectangle(1.5, 1.5, w - 3, h - 3, { stroke: INK, strokeWidth: 0.9, roughness: 1.3, seed }),
      );
    },
    [seed],
  );
  return (
    <div ref={hostRef} className="ss-prim ss-prim-input" style={{ height: h }}>
      <svg ref={svgRef} className="ss-prim-svg" height={h} />
      {placeholder && <span className="ss-prim-placeholder">{placeholder}</span>}
    </div>
  );
}

/** A multi-line text area. */
export function SketchTextarea({ placeholder, rows = 2, seed = 2 }: { placeholder?: string; rows?: number; seed?: number }) {
  const h = 22 + rows * 12;
  const { hostRef, svgRef } = useRoughDraw(
    h,
    (rc, w) => {
      svgRef.current!.appendChild(
        rc.rectangle(1.5, 1.5, w - 3, h - 3, { stroke: INK, strokeWidth: 0.9, roughness: 1.3, seed }),
      );
    },
    [seed, rows],
  );
  return (
    <div ref={hostRef} className="ss-prim ss-prim-textarea" style={{ height: h }}>
      <svg ref={svgRef} className="ss-prim-svg" height={h} />
      {placeholder && <span className="ss-prim-placeholder">{placeholder}</span>}
    </div>
  );
}

const BUTTON_FILL: Record<string, string | undefined> = {
  primary: "#d7e6ee",
  secondary: undefined,
  destructive: "#f3ddd7",
  ghost: undefined,
  link: undefined,
};

/** A hand-drawn button; variant controls fill/stroke/emphasis. */
export function SketchButton({ label, variant, seed = 3 }: { label: string; variant?: string; seed?: number }) {
  const h = 28;
  const isLink = variant === "link";
  const fill = variant ? BUTTON_FILL[variant] : undefined;
  const { hostRef, svgRef } = useRoughDraw(
    h,
    (rc, w) => {
      if (isLink) return; // links are underlined text, no box
      svgRef.current!.appendChild(
        rc.rectangle(1.5, 1.5, w - 3, h - 3, {
          stroke: variant === "destructive" ? "#a6432b" : INK,
          strokeWidth: variant === "primary" ? 1.3 : 1,
          roughness: 1.2,
          seed,
          fill,
          fillStyle: "solid",
        }),
      );
    },
    [seed, variant],
  );
  return (
    <div
      ref={hostRef}
      className={`ss-prim ss-prim-button ss-btn-${variant ?? "secondary"}`}
      style={isLink ? undefined : { height: h }}
    >
      {!isLink && <svg ref={svgRef} className="ss-prim-svg" height={h} />}
      <span className="ss-prim-btn-label">{label}</span>
    </div>
  );
}

/** A checkbox (rough box + optional check) with a label. */
export function SketchCheckbox({ label, checked = false, seed = 4 }: { label?: string; checked?: boolean; seed?: number }) {
  const s = 16;
  const { hostRef, svgRef } = useRoughDraw(
    s,
    (rc) => {
      const svg = svgRef.current!;
      svg.appendChild(rc.rectangle(1, 1, s - 2, s - 2, { stroke: INK, strokeWidth: 0.9, roughness: 1.1, seed }));
      if (checked) {
        svg.appendChild(
          rc.linearPath([[3, 8], [7, 12], [13, 3]], { stroke: INK, strokeWidth: 1.2, roughness: 0.8, seed }),
        );
      }
    },
    [checked, seed],
  );
  return (
    <label className="ss-inline">
      <div ref={hostRef} className="ss-prim-checkbox" style={{ width: s, height: s }}>
        <svg ref={svgRef} className="ss-prim-svg" width={s} height={s} viewBox={`0 0 ${s} ${s}`} />
      </div>
      {label && <span>{label}</span>}
    </label>
  );
}

/** A radio (rough circle + optional dot) with a label. */
export function SketchRadio({ label, checked = false, seed = 5 }: { label?: string; checked?: boolean; seed?: number }) {
  const s = 16;
  const { hostRef, svgRef } = useRoughDraw(
    s,
    (rc) => {
      const svg = svgRef.current!;
      svg.appendChild(rc.circle(s / 2, s / 2, s - 3, { stroke: INK, strokeWidth: 0.9, roughness: 1.1, seed }));
      if (checked) svg.appendChild(rc.circle(s / 2, s / 2, 6, { stroke: INK, fill: INK, fillStyle: "solid", seed }));
    },
    [checked, seed],
  );
  return (
    <label className="ss-inline">
      <div ref={hostRef} className="ss-prim-radio" style={{ width: s, height: s }}>
        <svg ref={svgRef} className="ss-prim-svg" width={s} height={s} viewBox={`0 0 ${s} ${s}`} />
      </div>
      {label && <span>{label}</span>}
    </label>
  );
}

/** A horizontal hand-drawn divider line, with an optional centered label. */
export function SketchDivider({ label, seed = 6 }: { label?: string; seed?: number }) {
  const h = label ? 16 : 8;
  const { hostRef, svgRef } = useRoughDraw(
    h,
    (rc, w) => {
      const y = h / 2;
      if (label) {
        const gap = 30;
        svgRef.current!.appendChild(rc.line(0, y, w / 2 - gap, y, { stroke: "#b9b6ac", strokeWidth: 0.8, roughness: 1, seed }));
        svgRef.current!.appendChild(rc.line(w / 2 + gap, y, w, y, { stroke: "#b9b6ac", strokeWidth: 0.8, roughness: 1, seed }));
      } else {
        svgRef.current!.appendChild(rc.line(0, y, w, y, { stroke: "#b9b6ac", strokeWidth: 0.8, roughness: 1, seed }));
      }
    },
    [label, seed],
  );
  return (
    <div ref={hostRef} className="ss-prim ss-prim-divider" style={{ height: h }}>
      <svg ref={svgRef} className="ss-prim-svg" height={h} />
      {label && <span className="ss-prim-divider-label">{label}</span>}
    </div>
  );
}

/** A dropdown/select: rough box + a hand-drawn chevron. */
export function SketchSelect({ value, seed = 7 }: { value?: string; seed?: number }) {
  const h = 26;
  const { hostRef, svgRef } = useRoughDraw(
    h,
    (rc, w) => {
      const svg = svgRef.current!;
      svg.appendChild(rc.rectangle(1.5, 1.5, w - 3, h - 3, { stroke: INK, strokeWidth: 0.9, roughness: 1.3, seed }));
      const cx = w - 14;
      const cy = h / 2 - 1;
      svg.appendChild(
        rc.linearPath([[cx - 4, cy - 2], [cx, cy + 3], [cx + 4, cy - 2]], { stroke: INK, strokeWidth: 1, roughness: 1, seed }),
      );
    },
    [seed],
  );
  return (
    <div ref={hostRef} className="ss-prim ss-prim-select" style={{ height: h }}>
      <svg ref={svgRef} className="ss-prim-svg" height={h} />
      <span className="ss-prim-placeholder">{value ?? "Choose…"}</span>
    </div>
  );
}

/** An image/avatar placeholder: a rough framed box with the wireframe X. */
export function SketchImage({ label, seed = 8 }: { label?: string; seed?: number }) {
  const h = 46;
  const { hostRef, svgRef } = useRoughDraw(
    h,
    (rc, w) => {
      const svg = svgRef.current!;
      svg.appendChild(rc.rectangle(1.5, 1.5, w - 3, h - 3, { stroke: "#b9b6ac", strokeWidth: 0.9, roughness: 1.2, seed }));
      // The universal "image" wireframe glyph: an X across the box.
      svg.appendChild(rc.line(2, 2, w - 2, h - 2, { stroke: "#cfccc2", strokeWidth: 0.8, roughness: 1, seed }));
      svg.appendChild(rc.line(w - 2, 2, 2, h - 2, { stroke: "#cfccc2", strokeWidth: 0.8, roughness: 1, seed }));
    },
    [seed],
  );
  return (
    <div ref={hostRef} className="ss-prim ss-prim-image" style={{ height: h }}>
      <svg ref={svgRef} className="ss-prim-svg" height={h} />
      {label && <span className="ss-prim-image-label">{label}</span>}
    </div>
  );
}
