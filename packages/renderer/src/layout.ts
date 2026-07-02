import Dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { groupSegments, type ProjectMapT, type ScreenSpecT } from "@sketchscreens/core-schema";
import { layoutElements, bandsHeight } from "./elementLayout";

/** Data carried by each screen node. */
export interface ScreenNodeData extends Record<string, unknown> {
  screen: ScreenSpecT;
  /** True for the journey root (the app's entry screen). */
  isRoot?: boolean;
  /** Top-level section (first group segment) and its assigned identity color. */
  section?: string;
  sectionColor?: string;
}
export type ScreenNode = Node<ScreenNodeData, "screen">;
export type AnyNode = ScreenNode;

/**
 * Muted, ink-friendly section palette (assigned to top-level groups in sorted
 * order, so the same map always colors the same way). Colors are used at low
 * alpha for badges/tints and full-strength for the minimap.
 */
const SECTION_PALETTE = [
  "#2f6f8f", // steel blue
  "#8f5f2f", // ochre
  "#5f8f4f", // moss
  "#8f4f6f", // plum
  "#4f6f8f", // slate
  "#8f7f2f", // olive gold
  "#6f4f8f", // violet
  "#8f4f3f", // clay
];

/** Deterministic section → color assignment for one map. */
export function sectionColors(map: ProjectMapT): Map<string, string> {
  const sections = [...new Set(
    map.screens.map((s) => groupSegments(s.group)[0]).filter((g): g is string => !!g),
  )].sort();
  return new Map(sections.map((s, i) => [s, SECTION_PALETTE[i % SECTION_PALETTE.length]!]));
}

const SCREEN_WIDTH = 260;

/** Estimate a screen node's height from its banded, type-weighted layout. */
export function estimateScreenSize(screen: ScreenSpecT): { width: number; height: number } {
  const layout = layoutElements(screen.elements);
  const header = 60; // title + route + section badge + description caption
  const padding = 24;
  const body = screen.elements.length === 0 ? 28 : bandsHeight(layout);
  return { width: SCREEN_WIDTH, height: header + body + padding };
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
  // With an accurate per-type height estimate (elementHeight), separation can be
  // modest — screens are spaced, not sprawling. (Was cranked to 90/130 only to
  // paper over a height estimate that under-counted tall elements.)
  g.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 90, marginx: 48, marginy: 48 });

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

  const colors = sectionColors(map);
  const nodes: AnyNode[] = map.screens.map((screen) => {
    const p = g.node(screen.id);
    const { width, height } = estimateScreenSize(screen);
    const section = groupSegments(screen.group)[0];
    return {
      id: screen.id,
      type: "screen",
      position: { x: p.x - width / 2, y: p.y - height / 2 },
      // Dimensions up front (same estimate dagre laid out with) — lets the
      // minimap and fitView work before/without DOM measurement.
      initialWidth: width,
      initialHeight: height,
      data: {
        screen,
        isRoot: screen.id === root,
        section,
        sectionColor: section ? colors.get(section) : undefined,
      },
    };
  });

  const edges: Edge[] = [];
  // Structural journey edges (solid, arrowed — the dominant layer).
  treeEdges.forEach(({ from, to }, i) => {
    edges.push({
      id: `tree-${i}-${from}-${to}`,
      source: from,
      target: to,
      type: "smoothstep",
      style: { stroke: "#8a8f95", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#8a8f95", width: 16, height: 16 },
      selectable: false,
    });
  });
  // Secondary nav edges (dashed, arrowed) — skip ones that duplicate a tree edge.
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
      style: { stroke: "#b9a9dd", strokeWidth: 1.4, strokeDasharray: "5 4" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#b9a9dd", width: 14, height: 14 },
      labelStyle: { fill: "#7a6fa5", fontSize: 11, fontFamily: "var(--ss-sketch-font)" },
      labelBgStyle: { fill: "#fdfdfb", fillOpacity: 0.85 },
    });
  });

  return { nodes, edges };
}
