import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { ProjectMapT, ScreenSpecT } from "@sketchscreens/core-schema";

/** Data carried by each screen node. */
export interface ScreenNodeData extends Record<string, unknown> {
  screen: ScreenSpecT;
  /** True for the journey root (the app's entry screen). */
  isRoot?: boolean;
}
export type ScreenNode = Node<ScreenNodeData, "screen">;
export type AnyNode = ScreenNode;

const SCREEN_WIDTH = 240;

/** Estimate a screen node's height from its element count (kept in sync with ScreenNode). */
export function estimateScreenSize(screen: ScreenSpecT): { width: number; height: number } {
  const header = 54; // title + route + optional group badge
  const perElement = 26;
  const padding = 22;
  return { width: SCREEN_WIDTH, height: header + screen.elements.length * perElement + padding };
}

/**
 * Choose the journey root: the screen a user sees first.
 *
 * Priority: an explicit `isEntry` screen → a screen nobody else parents and
 * that has no parent itself (a source) → the first screen. This is the node the
 * whole tree hangs from.
 */
function pickRoot(map: ProjectMapT): string | undefined {
  const entry = map.screens.find((s) => s.isEntry);
  if (entry) return entry.id;

  const hasParent = new Set(map.screens.filter((s) => s.parent).map((s) => s.id));
  const isParent = new Set(map.screens.map((s) => s.parent).filter(Boolean) as string[]);
  // A source that other screens hang off of.
  const rootish = map.screens.find((s) => !hasParent.has(s.id) && isParent.has(s.id));
  if (rootish) return rootish.id;

  return map.screens[0]?.id;
}

/**
 * Build the JOURNEY tree, rooted at the entry screen.
 *
 * Structure comes from each screen's `parent` (the screen you reach it from):
 * entry → auth → dashboard → each section, exactly as a user navigates. Screens
 * with no `parent` (and that aren't the root) attach to the root so nothing
 * floats. Laid out top-down (dagre TB). Real navigation edges are drawn faint
 * and dashed as a secondary layer so the journey tree stays dominant.
 */
export function buildGraph(map: ProjectMapT): { nodes: AnyNode[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 34, ranksep: 78, marginx: 40, marginy: 40 });

  const ids = new Set(map.screens.map((s) => s.id));
  const root = pickRoot(map);

  for (const screen of map.screens) {
    const { width, height } = estimateScreenSize(screen);
    g.setNode(screen.id, { width, height });
  }

  // Tree edges from parent → child. Root has none; parentless non-root screens
  // attach to the root so the tree is connected.
  const treeEdges: Array<{ from: string; to: string }> = [];
  for (const screen of map.screens) {
    if (screen.id === root) continue;
    const parent = screen.parent && ids.has(screen.parent) ? screen.parent : root;
    if (parent && parent !== screen.id) treeEdges.push({ from: parent, to: screen.id });
  }
  for (const { from, to } of treeEdges) g.setEdge(from, to);

  Dagre.layout(g);

  const nodes: AnyNode[] = map.screens.map((screen) => {
    const p = g.node(screen.id);
    const { width, height } = estimateScreenSize(screen);
    return {
      id: screen.id,
      type: "screen",
      position: { x: p.x - width / 2, y: p.y - height / 2 },
      data: { screen, isRoot: screen.id === root },
    };
  });

  const edges: Edge[] = [];
  // Structural journey edges (solid).
  treeEdges.forEach(({ from, to }, i) => {
    edges.push({
      id: `tree-${i}-${from}-${to}`,
      source: from,
      target: to,
      type: "smoothstep",
      style: { stroke: "#9aa0a6", strokeWidth: 1.6 },
      selectable: false,
    });
  });
  // Secondary nav edges (faint dashed) — skip ones that duplicate a tree edge.
  const treeKey = new Set(treeEdges.map((e) => `${e.from}->${e.to}`));
  map.edges.forEach((edge, i) => {
    if (treeKey.has(`${edge.from}->${edge.to}`)) return;
    edges.push({
      id: `flow-${i}-${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: edge.trigger,
      type: "bezier",
      animated: false,
      style: { stroke: "#d5cbe8", strokeWidth: 1, strokeDasharray: "4 4" },
      labelStyle: { fill: "#8a7fb0", fontSize: 10, fontFamily: "var(--ss-sketch-font)" },
      labelBgStyle: { fill: "#fdfdfb", fillOpacity: 0.85 },
    });
  });

  return { nodes, edges };
}
