import type { ScreenElementT } from "@sketchscreens/core-schema";
import { RoughFrame } from "./RoughFrame";
import { RoughToggle } from "./RoughToggle";
import {
  SketchInput,
  SketchTextarea,
  SketchButton,
  SketchCheckbox,
  SketchRadio,
  SketchDivider,
  SketchSelect,
  SketchImage,
} from "./sketch";

/**
 * Render one screen element as a hand-drawn wireframe primitive.
 *
 * All primitives are our own rough.js (see ./sketch) — one rendering engine,
 * one visual language, full control over button variants. Lists/cards/tabs/nav
 * render their REAL content (parsed from the label) instead of placeholders.
 */

/** Split a "Foo · Bar · Baz" or "Foo | Bar" label into its parts. */
function splitParts(label: string | undefined): string[] {
  if (!label) return [];
  return label
    .split(/[·|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A label like "Calls table (Time · Contact · Direction)" carries a caption
 * ("Calls table") + column hints ("Time", "Contact", "Direction"). Pull them
 * apart: text before the first "(" is the caption; the `·`-list inside "()" are
 * columns.
 */
function parseListLabel(label: string | undefined): { caption: string; columns: string[] } {
  if (!label) return { caption: "", columns: [] };
  const m = label.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m && m[2] && /[·|]/.test(m[2])) {
    return { caption: m[1]!.trim(), columns: splitParts(m[2]) };
  }
  return { caption: label, columns: [] };
}

export function WireframeElement({ element }: { element: ScreenElementT }) {
  const label = element.label ?? "";
  const descriptive = element.labelKind === "descriptive";

  switch (element.type) {
    case "heading":
      return <div className="ss-heading">{label || "Heading"}</div>;

    case "text":
      return <div className={`ss-text${descriptive ? " ss-descriptive" : ""}`}>{label || "Text"}</div>;

    case "input":
      return (
        <label className="ss-field">
          {label && <span className="ss-field-label">{label}</span>}
          <SketchInput placeholder={element.placeholder ?? (element.secure ? "••••••••" : "")} />
        </label>
      );

    case "textarea":
      return (
        <label className="ss-field">
          {label && <span className="ss-field-label">{label}</span>}
          <SketchTextarea rows={2} placeholder={element.placeholder ?? ""} />
        </label>
      );

    case "button":
      return <SketchButton label={label || "Button"} variant={element.variant} />;

    case "checkbox":
      return <SketchCheckbox label={label} checked={element.checked ?? false} />;

    case "radio":
      return <SketchRadio label={label} checked={element.checked ?? false} />;

    case "toggle":
      // Unknown state draws "on" — a filled switch reads as a toggle at sketch
      // fidelity; an explicit checked:false draws it off.
      return (
        <label className="ss-inline">
          <RoughToggle on={element.checked ?? true} />
          {label && <span>{label}</span>}
        </label>
      );

    case "select":
      return (
        <label className="ss-field">
          {label && <span className="ss-field-label">{label}</span>}
          <SketchSelect value={element.placeholder} />
        </label>
      );

    case "listbox":
    case "list": {
      const { caption, columns } = parseListLabel(label);
      return (
        <div className="ss-list">
          {caption && <span className={`ss-field-label${descriptive ? " ss-descriptive" : ""}`}>{caption}</span>}
          <RoughFrame className="ss-listframe" seed={3}>
            {columns.length > 0 && (
              <div className="ss-list-cols">
                {columns.map((c, i) => (
                  <span key={i} className="ss-list-col">
                    {c}
                  </span>
                ))}
              </div>
            )}
            <div className="ss-list-rows">
              <span className="ss-list-row" />
              <span className="ss-list-row" />
              <span className="ss-list-row" />
            </div>
          </RoughFrame>
        </div>
      );
    }

    case "card": {
      // A stat/metric card (group "stats") reads as a metric tile.
      if (element.group === "stats") {
        return (
          <RoughFrame className="ss-metric" seed={7}>
            <span className="ss-metric-value">123</span>
            <span className="ss-metric-label">{label || "Metric"}</span>
          </RoughFrame>
        );
      }
      const { caption } = parseListLabel(label);
      return (
        <RoughFrame className="ss-subcard" seed={7}>
          {caption && <span className="ss-subcard-title">{caption}</span>}
          <span className="ss-subcard-line" />
          <span className="ss-subcard-line ss-subcard-line-short" />
        </RoughFrame>
      );
    }

    case "image":
      return <SketchImage label={label} />;

    case "nav": {
      const parts = splitParts(label);
      return (
        <div className="ss-nav">
          {(parts.length ? parts : ["Navigation"]).map((p, i) => (
            <span key={i} className={`ss-nav-item${i === 0 ? " ss-nav-active" : ""}`}>
              {p}
            </span>
          ))}
        </div>
      );
    }

    case "tabs": {
      const parts = splitParts(label);
      return (
        <div className="ss-tabs">
          {(parts.length ? parts : ["Tab", "Tab", "Tab"]).map((p, i) => (
            <span key={i} className={`ss-tab${i === 0 ? " ss-tab-active" : ""}`}>
              {p}
            </span>
          ))}
        </div>
      );
    }

    case "divider":
      return <SketchDivider label={descriptive ? undefined : label || undefined} />;

    default: {
      // Exhaustiveness guard — if a new ElementType is added to the schema and
      // not handled here, TypeScript flags this line.
      const _never: never = element.type;
      return <div className="ss-text">{String(_never)}</div>;
    }
  }
}
