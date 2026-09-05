import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
// NOTE: xyflow's stylesheet is intentionally NOT imported here — App.tsx is
// shared by both the standalone entry (main.tsx) and the embed entry
// (embed.tsx), and each needs different CSS delivery (a normal asset link vs.
// a single inlined <style> tag). Each entry point imports it itself.
import { toPng } from "html-to-image";

import { groupSegments, type ProjectMapT, type ScreenSpecT } from "@sketchscreens/core-schema";
import { buildGraph, sectionColors, type AnyNode } from "./layout";
import { ScreenNode } from "./ScreenNode";
import { loadProjectMap } from "./loadMap";
import { DetailPanel } from "./DetailPanel";
import { cssVar } from "./theme";

const nodeTypes = { screen: ScreenNode };

/** A host-supplied action button, rendered at the top of the DetailPanel. */
export interface ScreenAction {
  label: string;
  kind?: "primary" | "ghost";
  onClick: (screen: ScreenSpecT) => void;
}

/** Imperative controls handed back to an embedder via a ref. */
export interface CanvasApi {
  select: (id: string | null) => void;
  fit: () => void;
}

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

export function Canvas({
  map,
  chromeless = false,
  actions,
  onSelect,
  apiRef,
}: {
  map: ProjectMapT;
  /** Hide the brand/logo + map name from the top bar. Everything else stays. */
  chromeless?: boolean;
  /** Rendered as buttons at the top of the DetailPanel for the selected screen. */
  actions?: ScreenAction[];
  /** Fires whenever selection changes, including deselect (-> null). */
  onSelect?: (screen: ScreenSpecT | null) => void;
  /** Populated with imperative controls (select/fit) once mounted. */
  apiRef?: React.MutableRefObject<CanvasApi | null>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const flowWrapRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  // Every selection change (click, deselect, arrives-from/goes-to jump, or an
  // embedder calling handle.select()) funnels through here so onSelect always
  // fires and the fit-to-node behavior stays in one place.
  const selectScreen = useCallback(
    (id: string | null, opts?: { fit?: boolean }) => {
      setSelectedId(id);
      const screen = id ? map.screens.find((s) => s.id === id) ?? null : null;
      onSelect?.(screen);
      if (opts?.fit && id) fitView({ nodes: [{ id }], duration: 400, maxZoom: 1 });
    },
    [map, onSelect, fitView],
  );

  // Populate the imperative handle synchronously with the commit (not a
  // regular effect) so it's ready the instant an embedder's mount() returns.
  useLayoutEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      select: (id) => selectScreen(id, { fit: !!id }),
      fit: () => fitView({ duration: 300, padding: 0.1 }),
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, selectScreen, fitView]);

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
          style = { ...style, stroke: "var(--ss-accent)", strokeWidth: 3, opacity: 1 };
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

  const onNodeClick = useCallback((_: unknown, node: Node) => selectScreen(node.id), [selectScreen]);
  const selectedScreen = useMemo(
    () => map.screens.find((s) => s.id === selectedId) ?? null,
    [map, selectedId],
  );

  const exportPng = useCallback(async () => {
    const el = flowWrapRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!el) return;
    setExporting(true);
    try {
      // toPng needs a literal color, not a CSS var — read the live paper
      // token so a dark-themed embed exports on a dark background too.
      const backgroundColor = cssVar(flowWrapRef.current, "--ss-paper", "#fdfdfb");
      const dataUrl = await toPng(el, {
        backgroundColor,
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
        {!chromeless && <span className="ss-logo">SketchScreens</span>}
        {!chromeless && <span className="ss-map-name">{map.name}</span>}
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
          onPaneClick={() => selectScreen(null)}
          fitView
          minZoom={0.1}
          nodesDraggable={false}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--ss-dot)" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            bgColor="var(--ss-paper-2)"
            nodeColor={(n) => (n.data?.sectionColor as string) ?? "var(--ss-minimap-fallback)"}
            nodeStrokeColor="var(--ss-minimap-stroke)"
            nodeStrokeWidth={2}
            maskColor="var(--ss-minimap-mask)"
            style={{ border: "1px solid var(--ss-line)", borderRadius: 6 }}
          />
        </ReactFlow>

        {selectedScreen && (
          <DetailPanel
            screen={selectedScreen}
            map={map}
            repoRoot={map.meta?.repoRoot}
            actions={actions}
            onSelect={(id) => selectScreen(id, { fit: true })}
            onClose={() => selectScreen(null)}
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
