import type { ScreenSpecT } from "@sketchscreens/core-schema";

/**
 * Slide-in panel showing a screen's provenance: its source file and the raw
 * element list the extractor produced. This is the "trust but verify" surface —
 * click a wireframe, see exactly which file it came from.
 */
export function DetailPanel({ screen, onClose }: { screen: ScreenSpecT; onClose: () => void }) {
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

      {screen.sourceFile && (
        <div className="ss-detail-row">
          <span className="ss-detail-key">Source</span>
          <code className="ss-detail-source">{screen.sourceFile}</code>
        </div>
      )}

      {screen.description && <p className="ss-detail-desc">{screen.description}</p>}

      <div className="ss-detail-row">
        <span className="ss-detail-key">Elements ({screen.elements.length})</span>
      </div>
      <ol className="ss-detail-elements">
        {screen.elements.map((el, i) => (
          <li key={i}>
            <span className="ss-detail-type">{el.type}</span>
            {el.label && <span className="ss-detail-elabel">{el.label}</span>}
            {el.variant && <span className="ss-detail-tag">{el.variant}</span>}
            {el.required && <span className="ss-detail-tag ss-req">required</span>}
          </li>
        ))}
      </ol>
    </aside>
  );
}
