import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GroupNode as GroupNodeType } from "./layout";

/**
 * A section-header node in the hierarchy tree (e.g. "Settings", "AI Settings").
 * Renders as a labeled pill; parent groups connect down to child groups and to
 * their screens. Depth tints the pill so nesting reads at a glance.
 */
export function GroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className={`ss-group ss-group-d${Math.min(data.depth, 3)}`}>
      <Handle type="target" position={Position.Top} className="ss-handle-hidden" />
      <span className="ss-group-label">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="ss-handle-hidden" />
    </div>
  );
}
