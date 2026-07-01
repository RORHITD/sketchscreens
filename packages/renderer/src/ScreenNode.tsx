import { Handle, Position, type NodeProps } from "@xyflow/react";
import { groupSegments } from "@sketchscreens/core-schema";
import type { ScreenNode as ScreenNodeType } from "./layout";
import { WireframeElement } from "./WireframeElement";
import { RoughFrame } from "./RoughFrame";
import { layoutElements, type Row } from "./elementLayout";

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
 * The node IS the wireframe — a titled frame containing the screen's elements
 * stacked top-to-bottom in source order. In the hierarchy layout a Top handle
 * receives the tree line from its group; a Bottom handle emits nav-flow edges.
 * Left/Right handles catch nav edges arriving from the sides.
 */
/** Render one row of elements with the row's horizontal alignment. */
function RowBand({ row, band }: { row: Row; band: string }) {
  // The row's alignment comes from its (first) element's align.
  const align = row[0]?.align ?? "full";
  return (
    <div className={`ss-row ss-row-${align} ss-band-${band}`}>
      {row.map((item, i) => (
        <div className={`ss-cell ss-cell-${item.align}`} key={i}>
          <WireframeElement element={item.element} />
        </div>
      ))}
    </div>
  );
}

export function ScreenNode({ data, selected }: NodeProps<ScreenNodeType>) {
  const { screen, isRoot } = data;
  // The deepest segment of the group path is the section label badge.
  const section = groupSegments(screen.group).pop();
  const isModal = screen.presentation && screen.presentation !== "screen";
  const layout = layoutElements(screen.elements);
  return (
    <div
      className={
        "ss-screen" +
        (selected ? " ss-screen-selected" : "") +
        (isRoot ? " ss-screen-root" : "") +
        (isModal ? " ss-screen-modal" : "")
      }
    >
      <Handle type="target" position={Position.Top} className="ss-handle" />
      <Handle type="target" position={Position.Left} className="ss-handle-hidden" />

      <RoughFrame className="ss-screen-card" seed={seedFor(screen.id)}>
        <div className="ss-screen-titlebar">
          <div className="ss-screen-titlerow">
            <span className="ss-screen-name">{screen.name}</span>
            {isRoot && <span className="ss-root-badge">START</span>}
            {isModal && <span className="ss-modal-badge">{screen.presentation}</span>}
            {!isRoot && section && <span className="ss-section-badge">{section}</span>}
          </div>
          {screen.route && <span className="ss-screen-route">{screen.route}</span>}
          {screen.description && <span className="ss-screen-desc">{screen.description}</span>}
        </div>

        {screen.elements.length === 0 ? (
          <div className="ss-empty">no elements extracted</div>
        ) : (
          <div className="ss-screen-layout">
            {layout.top.length > 0 && (
              <div className="ss-band ss-band-top">
                {layout.top.map((row, i) => (
                  <RowBand row={row} band="top" key={i} />
                ))}
              </div>
            )}
            {layout.main.length > 0 && (
              <div className="ss-band ss-band-main">
                {layout.main.map((row, i) => (
                  <RowBand row={row} band="main" key={i} />
                ))}
              </div>
            )}
            {layout.bottom.length > 0 && (
              <div className="ss-band ss-band-bottom">
                {layout.bottom.map((row, i) => (
                  <RowBand row={row} band="bottom" key={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </RoughFrame>

      <Handle type="source" position={Position.Bottom} className="ss-handle-hidden" />
      <Handle type="source" position={Position.Right} className="ss-handle-hidden" />
    </div>
  );
}
