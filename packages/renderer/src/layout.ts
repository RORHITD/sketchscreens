import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { ProjectMapT, ScreenSpecT } from "@sketchscreens/core-schema";

/** Data carried by each screen node. */
export interface ScreenNodeData extends Record<string, unknown> {
  screen: ScreenSpecT;
}

export type ScreenNode = Node<ScreenNodeData, "screen">;

/**
 * Estimate a node's rendered height so dagre can space rows without overlap.
 * A wireframe is a titled frame + one row per element. Kept in sync with the
 * ScreenNode component's sizing.
 */
export function estimateNodeSize(screen: ScreenSpecT): { width: number; height: number } {
  const width = 260;
  const header = 56; // title + route
  const perElement = 30;
  const padding = 24;
  const height = header + screen.elements.length * perElement + padding;
  return { width, height };
}

/**
 * Turn a ProjectMap into laid-out React Flow nodes + edges.
 *
 * Uses dagre with `rankdir: 'LR'` for a clean left-to-right flow — the reading
 * order most people expect for a screen-flow diagram.
 */
export function buildGraph(map: ProjectMapT): { nodes: ScreenNode[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 });

  for (const screen of map.screens) {
    const { width, height } = estimateNodeSize(screen);
    g.setNode(screen.id, { width, height });
  }
  for (const edge of map.edges) {
    // dagre throws if an edge references a node it doesn't know; the schema
    // validator already guarantees both ends exist, so this is safe.
    g.setEdge(edge.from, edge.to);
  }

  Dagre.layout(g);

  const nodes: ScreenNode[] = map.screens.map((screen) => {
    const { x, y } = g.node(screen.id);
    const { width, height } = estimateNodeSize(screen);
    return {
      id: screen.id,
      type: "screen",
      // dagre centers nodes; React Flow positions by top-left corner.
      position: { x: x - width / 2, y: y - height / 2 },
      data: { screen },
    };
  });

  const edges: Edge[] = map.edges.map((edge, i) => ({
    id: `e${i}-${edge.from}-${edge.to}`,
    source: edge.from,
    target: edge.to,
    label: edge.trigger,
    animated: false,
    style: { stroke: "#8a8a8a", strokeWidth: 1.5 },
    labelStyle: { fill: "#555", fontSize: 11, fontFamily: "var(--ss-sketch-font)" },
    labelBgStyle: { fill: "#fdfdfb", fillOpacity: 0.9 },
  }));

  return { nodes, edges };
}
