import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ScreenNode as ScreenNodeType } from "./layout";
import { WireframeElement } from "./WireframeElement";
import { RoughFrame } from "./RoughFrame";

// A small stable hash so each screen's sketch frame has its own hand-drawn
// wobble (deterministic per id — same screen redraws identically).
function seedFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000;
}

/**
 * A React Flow custom node: one screen drawn as a hand-sketched wireframe.
 *
 * The node IS the wireframe — a titled frame (wired-card) containing the
 * screen's elements stacked top-to-bottom in source order. Left/right handles
 * let flow edges connect screen-to-screen.
 */
export function ScreenNode({ data, selected }: NodeProps<ScreenNodeType>) {
  const { screen } = data;
  return (
    <div className={`ss-screen${selected ? " ss-screen-selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="ss-handle" />

      <RoughFrame className="ss-screen-card" seed={seedFor(screen.id)}>
        <div className="ss-screen-titlebar">
          <span className="ss-screen-name">{screen.name}</span>
          {screen.route && <span className="ss-screen-route">{screen.route}</span>}
        </div>

        <div className="ss-screen-body">
          {screen.elements.length === 0 ? (
            <div className="ss-empty">no elements extracted</div>
          ) : (
            screen.elements.map((el, i) => (
              <div className="ss-element" key={i}>
                <WireframeElement element={el} />
              </div>
            ))
          )}
        </div>
      </RoughFrame>

      <Handle type="source" position={Position.Right} className="ss-handle" />
    </div>
  );
}
