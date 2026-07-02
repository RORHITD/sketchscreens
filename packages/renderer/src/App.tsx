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
import { buildGraph, type AnyNode } from "./layout";
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

  const graph = useMemo(() => buildGraph(map), [map]);

  // Top-level sections for the filter dropdown.
  const sections = useMemo(() => {
    const set = new Set<string>();
    for (const s of map.screens) {
      const top = groupSegments(s.group)[0];
      if (top) set.add(top);
    }
    return [...set].sort();
  }, [map]);

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

  // Dim non-matching nodes/edges when filtering.
  const nodes = useMemo(
    () =>
      graph.nodes.map((n) => ({
        ...n,
        style: { ...n.style, opacity: filtering && !activeIds.has(n.id) ? 0.18 : 1 },
      })),
    [graph.nodes, filtering, activeIds],
  );
  const edges = useMemo(
    () =>
      graph.edges.map((e) => ({
        ...e,
        style: {
          ...e.style,
          opacity: filtering && !(activeIds.has(e.source) && activeIds.has(e.target)) ? 0.08 : undefined,
        },
      })),
    [graph.edges, filtering, activeIds],
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
            <select
              className="ss-section-select"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="">All sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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
