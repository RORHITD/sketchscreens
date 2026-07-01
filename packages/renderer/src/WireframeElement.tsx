import type { ScreenElementT } from "@sketchscreens/core-schema";
import { RoughBox } from "./RoughBox";
import { RoughFrame } from "./RoughFrame";
import { RoughToggle } from "./RoughToggle";

/**
 * Render one screen element as a hand-drawn wireframe primitive.
 *
 * Each `type` in the closed ElementType enum maps to a wired-element (or a
 * simple sketch-styled block). Labels render as normal text layered with the
 * sketch widget — wired-elements/rough.js draw the shape, not the text.
 */
export function WireframeElement({ element }: { element: ScreenElementT }) {
  const label = element.label ?? "";

  switch (element.type) {
    case "heading":
      return <div className="ss-heading">{label || "Heading"}</div>;

    case "text":
      return <div className="ss-text">{label || "Text"}</div>;

    case "input":
      return (
        <label className="ss-field">
          {label && <span className="ss-field-label">{label}</span>}
          <wired-input placeholder={element.placeholder ?? (element.secure ? "••••••••" : "")} />
        </label>
      );

    case "textarea":
      return (
        <label className="ss-field">
          {label && <span className="ss-field-label">{label}</span>}
          <wired-textarea rows={2} placeholder={element.placeholder ?? ""} />
        </label>
      );

    case "button":
      return (
        <wired-button
          class={element.variant === "primary" ? "ss-btn ss-btn-primary" : "ss-btn"}
          elevation={element.variant === "primary" ? 2 : 1}
        >
          {label || "Button"}
        </wired-button>
      );

    case "checkbox":
      return <wired-checkbox checked={false}>{label}</wired-checkbox>;

    case "radio":
      return <wired-radio>{label}</wired-radio>;

    case "toggle":
      return (
        <label className="ss-inline">
          <RoughToggle on />
          {label && <span>{label}</span>}
        </label>
      );

    case "select":
      // rough.js dropdown instead of wired-combo, whose chevron-fill throws in
      // the current wired-elements RC.
      return (
        <label className="ss-field">
          {label && <span className="ss-field-label">{label}</span>}
          <RoughBox chevron>
            <span className="ss-select-value">{element.placeholder ?? "Choose…"}</span>
          </RoughBox>
        </label>
      );

    case "listbox":
    case "list":
      return (
        <div className="ss-list">
          {label && <span className="ss-field-label">{label}</span>}
          <RoughBox height={62} seed={3}>
            <div className="ss-list-rows">
              <span>Item one</span>
              <span>Item two</span>
              <span>Item three</span>
            </div>
          </RoughBox>
        </div>
      );

    case "card":
      return (
        <RoughFrame className="ss-subcard" seed={7}>
          <span>{label || "Card"}</span>
        </RoughFrame>
      );

    case "image":
      return (
        <div className="ss-image">
          <span>🖼 {label || "image"}</span>
        </div>
      );

    case "nav":
      return <div className="ss-nav">{label || "Navigation"}</div>;

    case "tabs":
      return <div className="ss-tabs">{label || "Tab · Tab · Tab"}</div>;

    case "divider":
      return <wired-divider class="ss-divider" />;

    default: {
      // Exhaustiveness guard — if a new ElementType is added to the schema and
      // not handled here, TypeScript flags this line.
      const _never: never = element.type;
      return <div className="ss-text">{String(_never)}</div>;
    }
  }
}
