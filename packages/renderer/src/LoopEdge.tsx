import { BaseEdge, EdgeLabelRenderer, type EdgeProps, type Edge } from "@xyflow/react";

/** Data carried by a `loop`-typed edge (see layout.ts's `buildGraph`). */
export interface LoopEdgeData extends Record<string, unknown> {
  /** True when source === target — a node looping back on itself. */
  isSelfLoop?: boolean;
}
export type LoopEdgeType = Edge<LoopEdgeData, "loop">;

/**
 * Custom edge type for automation/loop transitions: an edge whose target is
 * an ancestor of its source in the journey tree (or the source itself), or
 * that is explicitly flagged `kind: "loop"` in the map. These need to read as
 * distinctly different from the tree backbone and the faint secondary-nav
 * edges — a real cycle, not "another way to get here."
 *
 * Both shapes are built by hand rather than via `getBezierPath` — xyflow's
 * control-point offset scales with the distance between the two points, which
 * shrinks to ~0 for a self-loop (same point) and stays small for a back-edge
 * between two vertically-stacked nodes (the common case: a job looping back to
 * a scheduler almost directly above it). A FIXED horizontal bulge instead
 * guarantees both shapes clear the backbone by a visible margin regardless of
 * how the two nodes happen to line up:
 *  - Self-loop (source === target): a small loop bulging off the node's
 *    upper-right corner (anchored at the `sloop`/`tloop` handles — see
 *    NodeHandles in ScreenNode.tsx — so it doesn't share a pixel with a
 *    same-node back-edge anchored at `sr`/`tr`).
 *  - Back edge (target is an ancestor of source): leaves source heading
 *    right, bulges out, and re-enters target from the right — same idea as a
 *    bezier leaving/entering through Position.Right on both ends, just with a
 *    bulge that doesn't collapse when the two points are nearly in line.
 */
export function LoopEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  label,
  data,
}: EdgeProps<LoopEdgeType>) {
  const isSelfLoop = !!data?.isSelfLoop;

  let path: string;
  let labelX: number;
  let labelY: number;

  if (isSelfLoop) {
    // A small loop bulging off the node's right edge: leave just above
    // the anchor, sweep out to the right, come back just below it.
    const reach = 46;
    const half = 20;
    const topY = sourceY - half;
    const botY = sourceY + half;
    path = `M ${sourceX},${topY} C ${sourceX + reach * 1.6},${topY} ${sourceX + reach * 1.6},${botY} ${sourceX},${botY}`;
    labelX = sourceX + reach * 1.15;
    labelY = sourceY;
  } else {
    // Fixed bulge (not distance-scaled) so a back-edge between two nodes
    // that are nearly vertically aligned still swings clearly out to the
    // right of both, instead of hugging the backbone between them.
    const dy = Math.abs(targetY - sourceY);
    const bulge = Math.min(180, Math.max(70, dy * 0.35));
    const c1x = sourceX + bulge;
    const c2x = targetX + bulge;
    path = `M ${sourceX},${sourceY} C ${c1x},${sourceY} ${c2x},${targetY} ${targetX},${targetY}`;
    labelX = Math.max(sourceX, targetX) + bulge * 0.85;
    labelY = (sourceY + targetY) / 2;
  }

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {label != null && (
        <EdgeLabelRenderer>
          <div
            className="ss-loop-label"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
