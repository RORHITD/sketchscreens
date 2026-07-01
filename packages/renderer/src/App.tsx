import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { ProjectMapT } from "@sketchscreens/core-schema";
import { buildGraph, type AnyNode } from "./layout";
import { ScreenNode } from "./ScreenNode";
import { loadProjectMap } from "./loadMap";
import { DetailPanel } from "./DetailPanel";

const nodeTypes = { screen: ScreenNode };

export function App() {
  const [map, setMap] = useState<ProjectMapT | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadProjectMap()
      .then(setMap)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const graph = useMemo(() => (map ? buildGraph(map) : null), [map]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedId(node.id);
  }, []);

  const selectedScreen = useMemo(
    () => map?.screens.find((s) => s.id === selectedId) ?? null,
    [map, selectedId],
  );

  if (error) {
    return (
      <div className="ss-error">
        <h1>Couldn't render the map</h1>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!map || !graph) {
    return <div className="ss-loading">Loading…</div>;
  }

  return (
    <div className="ss-root">
      <header className="ss-topbar">
        <span className="ss-logo">SketchScreens</span>
        <span className="ss-map-name">{map.name}</span>
        <span className="ss-surface-badge">{map.surface}</span>
        <span className="ss-count">
          {map.screens.length} screens · {map.edges.length} flows
        </span>
      </header>

      <div className="ss-canvas">
        <ReactFlow<AnyNode>
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedId(null)}
          fitView
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e0d8" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => (n.data?.isRoot ? "#2f6f8f" : "#d9d6cc")}
            maskColor="rgba(253,253,251,0.7)"
          />
        </ReactFlow>

        {selectedScreen && (
          <DetailPanel screen={selectedScreen} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
}
