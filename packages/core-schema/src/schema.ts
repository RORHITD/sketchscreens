import { z } from "zod";

/**
 * The SketchScreens contract.
 *
 * One JSON shape, produced by the extractor and consumed by the renderer.
 * It is deliberately stack-agnostic: a Next.js screen and a Flutter screen
 * both reduce to the same `ScreenSpec`, so the renderer draws them identically.
 *
 * Design note: `ElementType` is a CLOSED enum on purpose. Each value maps 1:1
 * onto a renderable hand-drawn primitive (mostly wired-elements). A closed set
 * keeps every map renderable and stops the LLM extractor from inventing element
 * types the renderer can't draw.
 */

// ---------------------------------------------------------------------------
// Elements — the things that appear on a screen, in top-to-bottom order.
// ---------------------------------------------------------------------------

/** The closed set of wireframe primitives. Each maps to a renderable widget. */
export const ElementType = z.enum([
  "heading", // a title / section header
  "text", // a paragraph or helper/caption text
  "input", // a single-line text field
  "textarea", // a multi-line text field
  "button", // a clickable button (may own a nav edge via its label)
  "checkbox", // a single checkbox
  "radio", // a radio option (usually one of a group)
  "toggle", // an on/off switch
  "select", // a dropdown / combo
  "listbox", // a scrollable option list
  "card", // a bordered container / tile
  "image", // an image or avatar placeholder
  "list", // a repeated row list (feeds, tables-as-list)
  "divider", // a visual separator
  "nav", // a nav bar / tab bar / menu
  "tabs", // a tab strip
]);
export type ElementType = z.infer<typeof ElementType>;

/** Optional visual role for buttons, so the renderer can vary emphasis. */
export const ElementVariant = z.enum([
  "primary",
  "secondary",
  "destructive",
  "ghost",
  "link",
]);
export type ElementVariant = z.infer<typeof ElementVariant>;

/**
 * One UI element on a screen. `label` is the visible text (button caption,
 * field label, heading text). Order in the `elements` array = top-to-bottom
 * position in the sketch (structural fidelity, not pixel-exact).
 */
export const ScreenElement = z.object({
  type: ElementType,
  /** Visible text: caption, label, or heading. Optional for dividers/images. */
  label: z.string().optional(),
  /** Placeholder / hint text for inputs. */
  placeholder: z.string().optional(),
  /** Visual emphasis (mainly for buttons). */
  variant: ElementVariant.optional(),
  /** True for password / masked inputs. */
  secure: z.boolean().optional(),
  /** True if the element is marked required in the source. */
  required: z.boolean().optional(),
  /**
   * Optional grouping key. Elements sharing a group render inside one
   * card/section, preserving the source's visual grouping.
   */
  group: z.string().optional(),
  /** Free-form note the extractor wants to surface (e.g. "conditionally shown"). */
  note: z.string().optional(),
});
export type ScreenElement = z.infer<typeof ScreenElement>;

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

/** One screen = one node in the map. */
export const ScreenSpec = z.object({
  /** Stable id, unique within the map. Referenced by edges. */
  id: z.string().min(1),
  /** Human-friendly screen name (e.g. "Login"). */
  name: z.string().min(1),
  /**
   * The route or address of this screen: a URL path (`/settings/profile`),
   * a Flutter widget class (`SettingsScreen`), or an API path group. Optional
   * because not every screen is addressable (e.g. a modal).
   */
  route: z.string().optional(),
  /** Repo-relative path of the file this screen was extracted from. */
  sourceFile: z.string().optional(),
  /** The elements on this screen, in top-to-bottom order. */
  elements: z.array(ScreenElement).default([]),
  /** Optional short description / purpose of the screen. */
  description: z.string().optional(),
  /**
   * Optional label-path for this screen's section, most-general first, using
   * " › " as the separator — e.g. "Settings › AI Settings". Groups cluster and
   * label screens; the renderer nests group labels. Deriveable from the route.
   * (For the overall journey SHAPE, prefer `parent` below.)
   */
  group: z.string().optional(),
  /**
   * Optional id of the screen this one hangs beneath in the JOURNEY tree — the
   * screen a user reaches this one *from*. This is what roots the map as a real
   * flow: an entry screen has no parent; the auth screen's parent is the entry;
   * each feature-section hub's parent is the dashboard; etc. When set, it
   * overrides route-derived nesting so the tree matches how users actually
   * navigate. Must reference another screen's `id`.
   */
  parent: z.string().optional(),
  /**
   * Optional hint that this screen is the app's entry point / root of the
   * journey (what the user sees first). At most one screen should set this; the
   * renderer roots the tree here. If none is set, the renderer infers a root.
   */
  isEntry: z.boolean().optional(),
});
export type ScreenSpec = z.infer<typeof ScreenSpec>;

/** Split a group path ("Settings › AI Settings") into its segments. */
export function groupSegments(group: string | undefined): string[] {
  if (!group) return [];
  return group
    .split("›")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Edges — navigation between screens
// ---------------------------------------------------------------------------

/** A navigation transition from one screen to another. */
export const Edge = z.object({
  /** Source screen id. */
  from: z.string().min(1),
  /** Destination screen id. */
  to: z.string().min(1),
  /**
   * What triggers the transition — usually a button/link label
   * ("Continue", "Forgot?"). Rendered as the edge label.
   */
  trigger: z.string().optional(),
  /** How the transition is expressed, if useful (e.g. "redirect", "push", "link"). */
  kind: z.string().optional(),
});
export type Edge = z.infer<typeof Edge>;

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

/**
 * Which surface this map represents. Each surface is its own map — a web app,
 * a mobile app, a CRM, and a backend are mapped separately, not tangled into one.
 */
export const Surface = z.enum([
  "web",
  "mobile",
  "crm",
  "admin",
  "backend",
  "desktop",
  "other",
]);
export type Surface = z.infer<typeof Surface>;

/** Optional provenance / metadata about how this map was produced. */
export const ProjectMapMeta = z.object({
  /** The tool version that produced the map. */
  generator: z.string().optional(),
  /** Repo-relative or absolute root the map was extracted from. */
  repoRoot: z.string().optional(),
  /** ISO timestamp string (set by the producer; schema stays time-agnostic). */
  generatedAt: z.string().optional(),
  /** How elements were derived: "agent", "static", or "hybrid". */
  extraction: z.enum(["agent", "static", "hybrid", "manual"]).optional(),
});
export type ProjectMapMeta = z.infer<typeof ProjectMapMeta>;

/** The whole thing: one surface's screens + the flow between them. */
export const ProjectMap = z.object({
  /** Contract version, so renderers can evolve safely. */
  version: z.literal(1).default(1),
  /** Display name for this map (e.g. "AiPhone 360 — Web App"). */
  name: z.string().min(1),
  /** Which surface this represents. */
  surface: Surface,
  /** The screens (nodes). */
  screens: z.array(ScreenSpec).default([]),
  /** The navigation transitions (edges). */
  edges: z.array(Edge).default([]),
  /** Optional provenance. */
  meta: ProjectMapMeta.optional(),
});
export type ProjectMap = z.infer<typeof ProjectMap>;
