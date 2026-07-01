import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { groupSegments, type ProjectMapT, type ScreenSpecT } from "@sketchscreens/core-schema";

/** Data carried by each screen node. */
export interface ScreenNodeData extends Record<string, unknown> {
  screen: ScreenSpecT;
}
export type ScreenNode = Node<ScreenNodeData, "screen">;

/** Data carried by each group (section-header) node. */
export interface GroupNodeData extends Record<string, unknown> {
  label: string;
  /** Full path of this group, e.g. "Settings › AI Settings". */
  path: string;
  /** Depth in the tree (root groups = 0). */
  depth: number;
}
export type GroupNode = Node<GroupNodeData, "group">;

export type AnyNode = ScreenNode | GroupNode;

const SCREEN_WIDTH = 240;

/** Estimate a screen node's height from its element count (kept in sync with ScreenNode). */
export function estimateScreenSize(screen: ScreenSpecT): { width: number; height: number } {
  const header = 52;
  const perElement = 26;
  const padding = 22;
  return { width: SCREEN_WIDTH, height: header + screen.elements.length * perElement + padding };
}

const GROUP_WIDTH = 200;
const GROUP_HEIGHT = 46;

/**
 * Build a top-down hierarchy (org-chart) graph from a ProjectMap.
 *
 * Each screen's `group` path ("Settings › AI Settings") is expanded into a
 * chain of group nodes; the screen hangs beneath its deepest group. Screens
 * with no group hang beneath a synthetic root for their... well, they attach to
 * the root. The result is laid out top-to-bottom with dagre so parents sit
 * above their children like an org chart.
 *
 * Real navigation edges are returned separately (as faint "flow" edges) so the
 * tree stays the dominant structure.
 */
export function buildGraph(map: ProjectMapT): { nodes: AnyNode[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 28, ranksep: 70, marginx: 30, marginy: 30 });

  // --- 1. Materialize group nodes from every screen's group path ---
  // groupId -> { label, path, depth, parentId | null }
  const groups = new Map<string, GroupNodeData & { parentId: string | null }>();
  const groupId = (segments: string[]) => "grp:" + segments.join(" › ");

  for (const screen of map.screens) {
    const segs = groupSegments(screen.group);
    for (let i = 0; i < segs.length; i++) {
      const path = segs.slice(0, i + 1);
      const id = groupId(path);
      if (!groups.has(id)) {
        groups.set(id, {
          label: path[i]!,
          path: path.join(" › "),
          depth: i,
          parentId: i > 0 ? groupId(path.slice(0, i)) : null,
        });
      }
    }
  }

  // --- 2. Register nodes with dagre (group nodes + screen nodes) ---
  for (const [id] of groups) {
    g.setNode(id, { width: GROUP_WIDTH, height: GROUP_HEIGHT });
  }
  for (const screen of map.screens) {
    const { width, height } = estimateScreenSize(screen);
    g.setNode(screen.id, { width, height });
  }

  // --- 3. Hierarchy edges: parent group -> child group, group -> its screens ---
  const treeEdges: Array<{ from: string; to: string }> = [];
  for (const [id, data] of groups) {
    if (data.parentId) treeEdges.push({ from: data.parentId, to: id });
  }
  for (const screen of map.screens) {
    const segs = groupSegments(screen.group);
    if (segs.length > 0) treeEdges.push({ from: groupId(segs), to: screen.id });
  }
  for (const { from, to } of treeEdges) g.setEdge(from, to);

  Dagre.layout(g);

  // --- 4. Emit React Flow nodes ---
  const nodes: AnyNode[] = [];
  for (const [id, data] of groups) {
    const p = g.node(id);
    nodes.push({
      id,
      type: "group",
      position: { x: p.x - GROUP_WIDTH / 2, y: p.y - GROUP_HEIGHT / 2 },
      data: { label: data.label, path: data.path, depth: data.depth },
      draggable: false,
      selectable: false,
    });
  }
  for (const screen of map.screens) {
    const p = g.node(screen.id);
    const { width, height } = estimateScreenSize(screen);
    nodes.push({
      id: screen.id,
      type: "screen",
      position: { x: p.x - width / 2, y: p.y - height / 2 },
      data: { screen },
    });
  }

  // --- 5. Hierarchy edges (solid, structural) + nav edges (faint, dashed) ---
  const edges: Edge[] = [];
  treeEdges.forEach(({ from, to }, i) => {
    edges.push({
      id: `tree-${i}-${from}-${to}`,
      source: from,
      target: to,
      type: "smoothstep",
      style: { stroke: "#b9b6ac", strokeWidth: 1.4 },
      selectable: false,
    });
  });
  map.edges.forEach((edge, i) => {
    edges.push({
      id: `flow-${i}-${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: edge.trigger,
      type: "bezier",
      animated: false,
      style: { stroke: "#cfc4e6", strokeWidth: 1, strokeDasharray: "4 4" },
      labelStyle: { fill: "#8a7fb0", fontSize: 10, fontFamily: "var(--ss-sketch-font)" },
      labelBgStyle: { fill: "#fdfdfb", fillOpacity: 0.85 },
    });
  });

  return { nodes, edges };
}
