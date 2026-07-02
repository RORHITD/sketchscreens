import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  ReactFlowProvider,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";

import { groupSegments, type ProjectMapT } from "@sketchscreens/core-schema";
import { buildGraph, sectionColors, type AnyNode } from "./layout";
import { ScreenNode } from "./ScreenNode";
import { loadProjectMap } from "./loadMap";
import { DetailPanel } from "./DetailPanel";

const nodeTypes = { screen: ScreenNode };

/** Does a screen match the search query (name / route / element labels)? */
function screenMatches(
  screen: ProjectMapT["screens"][number],
  q: string,
): boolean {
  if (!q) return true;
  const hay = [
    screen.name,
    screen.route ?? "",
    screen.description ?? "",
    ...screen.elements.map((e) => e.label ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

function Canvas({ map }: { map: ProjectMapT }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const flowWrapRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const graph = useMemo(() => buildGraph(map), [map]);

  // Top-level sections (sorted) + their identity colors, for the legend.
  const sections = useMemo(() => {
    const set = new Set<string>();
    for (const s of map.screens) {
      const top = groupSegments(s.group)[0];
      if (top) set.add(top);
    }
    return [...set].sort();
  }, [map]);
  const colors = useMemo(() => sectionColors(map), [map]);

  // Adjacency for hover-highlighting: nodeId → its edges + neighbor nodes.
  const adjacency = useMemo(() => {
    const m = new Map<string, { nodes: Set<string>; edges: Set<string> }>();
    const entry = (id: string) => {
      let e = m.get(id);
      if (!e) m.set(id, (e = { nodes: new Set([id]), edges: new Set() }));
      return e;
    };
    for (const e of graph.edges) {
      entry(e.source).nodes.add(e.target);
      entry(e.source).edges.add(e.id);
      entry(e.target).nodes.add(e.source);
      entry(e.target).edges.add(e.id);
    }
    return m;
  }, [graph.edges]);
  const hovered = hoveredId ? adjacency.get(hoveredId) : undefined;

  // Which screen ids are "active" given the search + section filter.
  const activeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of map.screens) {
      const topSection = groupSegments(s.group)[0] ?? "";
      const sectionOk = !sectionFilter || topSection === sectionFilter;
      if (sectionOk && screenMatches(s, query)) ids.add(s.id);
    }
    return ids;
  }, [map, query, sectionFilter]);

  const filtering = query.length > 0 || sectionFilter.length > 0;

  // Journey trace: the tree path from START down to the selected screen —
  // "how does a user actually reach this?" Highlighted whenever selected,
  // and it survives hover (the mouse is usually still on the clicked node).
  const path = useMemo(() => {
    const pairs = new Set<string>();
    const nodes = new Set<string>();
    if (!selectedId) return { pairs, nodes };
    const byId = new Map(map.screens.map((s) => [s.id, s]));
    nodes.add(selectedId);
    let cur = byId.get(selectedId);
    const seen = new Set<string>();
    while (cur?.parent && !seen.has(cur.id)) {
      seen.add(cur.id);
      pairs.add(`${cur.parent}->${cur.id}`);
      nodes.add(cur.parent);
      cur = byId.get(cur.parent);
    }
    return { pairs, nodes };
  }, [map, selectedId]);

  // Emphasis rules, in priority order: hover-connectivity > journey trace >
  // search/section filter > everything plain.
  const tracing = path.pairs.size > 0;
  const nodes = useMemo(
    () =>
      graph.nodes.map((n) => {
        let opacity = 1;
        const onPath = tracing && path.nodes.has(n.id);
        if (hovered) opacity = hovered.nodes.has(n.id) || onPath ? 1 : 0.2;
        else if (tracing) opacity = onPath ? 1 : 0.35;
        else if (filtering) opacity = activeIds.has(n.id) ? 1 : 0.18;
        return { ...n, style: { ...n.style, opacity } };
      }),
    [graph.nodes, hovered, filtering, activeIds, tracing, path.nodes],
  );
  const edges = useMemo(
    () =>
      graph.edges.map((e) => {
        const onPath = tracing && path.pairs.has(`${e.source}->${e.target}`);
        let style = { ...e.style };
        if (onPath) {
          // The journey trace outranks everything — visible even mid-hover.
          style = { ...style, stroke: "#2f6f8f", strokeWidth: 3, opacity: 1 };
        } else if (hovered) {
          style = hovered.edges.has(e.id)
            ? { ...style, opacity: 1, strokeWidth: Number(style.strokeWidth ?? 1.4) + 1 }
            : { ...style, opacity: 0.06 };
        } else if (tracing) {
          style = { ...style, opacity: 0.2 }; // quiet everything off-path
        } else if (filtering && !(activeIds.has(e.source) && activeIds.has(e.target))) {
          style = { ...style, opacity: 0.08 };
        }
        return { ...e, style };
      }),
    [graph.edges, hovered, filtering, activeIds, tracing, path.pairs],
  );

  const onNodeClick = useCallback((_: unknown, node: Node) => setSelectedId(node.id), []);
  const selectedScreen = useMemo(
    () => map.screens.find((s) => s.id === selectedId) ?? null,
    [map, selectedId],
  );

  const exportPng = useCallback(async () => {
    const el = flowWrapRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!el) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: "#fdfdfb",
        pixelRatio: 2,
        // Capture the full graph regardless of current pan/zoom.
        width: el.scrollWidth,
        height: el.scrollHeight,
        style: { transform: "translate(0,0) scale(1)" },
      });
      const a = document.createElement("a");
      a.download = `${map.name.replace(/[^\w.-]+/g, "-").toLowerCase()}.png`;
      a.href = dataUrl;
      a.click();
    } finally {
      setExporting(false);
    }
  }, [map.name]);

  return (
    <div className="ss-root">
      <header className="ss-topbar">
        <span className="ss-logo">SketchScreens</span>
        <span className="ss-map-name">{map.name}</span>
        <span className="ss-surface-badge">{map.surface}</span>
        <div className="ss-topbar-tools">
          <input
            className="ss-search"
            placeholder="Search screens…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {sections.length > 1 && (
            <div className="ss-legend" role="group" aria-label="Sections">
              <button
                className={`ss-chip${!sectionFilter ? " ss-chip-active" : ""}`}
                onClick={() => {
                  setSectionFilter("");
                  fitView({ duration: 450, padding: 0.1 });
                }}
              >
                All
              </button>
              {sections.map((s) => (
                <button
                  key={s}
                  className={`ss-chip${sectionFilter === s ? " ss-chip-active" : ""}`}
                  style={{ "--ss-chip-color": colors.get(s) } as React.CSSProperties}
                  onClick={() => {
                    const next = sectionFilter === s ? "" : s;
                    setSectionFilter(next);
                    if (next) {
                      const ids = map.screens
                        .filter((sc) => groupSegments(sc.group)[0] === s)
                        .map((sc) => ({ id: sc.id }));
                      fitView({ nodes: ids, duration: 450, padding: 0.2, maxZoom: 1 });
                    } else {
                      fitView({ duration: 450, padding: 0.1 });
                    }
                  }}
                >
                  <span className="ss-chip-dot" />
                  {s}
                </button>
              ))}
            </div>
          )}
          <button className="ss-export-btn" onClick={exportPng} disabled={exporting}>
            {exporting ? "Exporting…" : "Export PNG"}
          </button>
        </div>
        <span className="ss-count">
          {map.screens.length} screens · {map.edges.length} flows
        </span>
      </header>

      <div className="ss-canvas" ref={flowWrapRef}>
        <ReactFlow<AnyNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          minZoom={0.1}
          nodesDraggable={false}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e0d8" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => (n.data?.sectionColor as string) ?? "#c9c5b8"}
            nodeStrokeColor="#8a877c"
            nodeStrokeWidth={2}
            maskColor="rgba(230,228,218,0.75)"
            style={{ border: "1px solid #d9d6cc", borderRadius: 6 }}
          />
        </ReactFlow>

        {selectedScreen && (
          <DetailPanel
            screen={selectedScreen}
            map={map}
            repoRoot={map.meta?.repoRoot}
            onSelect={(id) => {
              setSelectedId(id);
              fitView({ nodes: [{ id }], duration: 400, maxZoom: 1 });
            }}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

export function App() {
  const [map, setMap] = useState<ProjectMapT | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjectMap()
      .then(setMap)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <div className="ss-error">
        <h1>Couldn't render the map</h1>
        <pre>{error}</pre>
      </div>
    );
  }
  if (!map) return <div className="ss-loading">Loading…</div>;
  if (map.screens.length === 0) {
    return (
      <div className="ss-loading">
        <h1>No screens were extracted</h1>
        <p>The map “{map.name}” has no screens to show.</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <Canvas map={map} />
    </ReactFlowProvider>
  );
}
