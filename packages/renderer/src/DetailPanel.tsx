import { useMemo } from "react";
import type { ProjectMapT, ScreenSpecT } from "@sketchscreens/core-schema";

/**
 * Slide-in panel: a screen's provenance + navigation + full element list. The
 * "trust but verify" surface — which file it came from, how you get here, where
 * you can go, and every field the extractor recorded.
 */
export function DetailPanel({
  screen,
  map,
  repoRoot,
  onSelect,
  onClose,
}: {
  screen: ScreenSpecT;
  map: ProjectMapT;
  repoRoot?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const nameOf = useMemo(() => {
    const m = new Map(map.screens.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? id;
  }, [map]);

  const arrivesFrom = map.edges.filter((e) => e.to === screen.id);
  const goesTo = map.edges.filter((e) => e.from === screen.id);
  const sourceHref = screen.sourceFile
    ? `vscode://file/${(repoRoot ? repoRoot.replace(/\/$/, "") + "/" : "") + screen.sourceFile}`
    : undefined;

  return (
    <aside className="ss-detail">
      <div className="ss-detail-head">
        <h2>{screen.name}</h2>
        <button className="ss-detail-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {screen.route && (
        <div className="ss-detail-row">
          <span className="ss-detail-key">Route</span>
          <code>{screen.route}</code>
        </div>
      )}
      {screen.presentation && screen.presentation !== "screen" && (
        <div className="ss-detail-row">
          <span className="ss-detail-key">Presentation</span>
          <code>{screen.presentation}</code>
        </div>
      )}

      {screen.sourceFile && (
        <div className="ss-detail-row">
          <span className="ss-detail-key">Source</span>
          {sourceHref ? (
            <a className="ss-detail-source" href={sourceHref}>
              {screen.sourceFile}
            </a>
          ) : (
            <code className="ss-detail-source">{screen.sourceFile}</code>
          )}
        </div>
      )}

      {screen.description && <p className="ss-detail-desc">{screen.description}</p>}

      {arrivesFrom.length > 0 && (
        <div className="ss-detail-nav">
          <span className="ss-detail-key">Arrives from</span>
          <ul>
            {arrivesFrom.map((e, i) => (
              <li key={i}>
                <button className="ss-detail-link" onClick={() => onSelect(e.from)}>
                  ← {nameOf(e.from)}
                </button>
                {e.trigger && <span className="ss-detail-trigger">via “{e.trigger}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {goesTo.length > 0 && (
        <div className="ss-detail-nav">
          <span className="ss-detail-key">Goes to</span>
          <ul>
            {goesTo.map((e, i) => (
              <li key={i}>
                <button className="ss-detail-link" onClick={() => onSelect(e.to)}>
                  → {nameOf(e.to)}
                </button>
                {e.trigger && <span className="ss-detail-trigger">via “{e.trigger}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ss-detail-row">
        <span className="ss-detail-key">Elements ({screen.elements.length})</span>
      </div>
      <ol className="ss-detail-elements">
        {screen.elements.map((el, i) => (
          <li key={i}>
            <span className="ss-detail-type">{el.type}</span>
            {el.label && (
              <span className={`ss-detail-elabel${el.labelKind === "descriptive" ? " ss-descriptive" : ""}`}>
                {el.label}
              </span>
            )}
            {el.variant && <span className="ss-detail-tag">{el.variant}</span>}
            {el.required && <span className="ss-detail-tag ss-req">required</span>}
            {el.secure && <span className="ss-detail-tag">secure</span>}
            {el.note && <span className="ss-detail-note">⚠ {el.note}</span>}
          </li>
        ))}
      </ol>
    </aside>
  );
}
