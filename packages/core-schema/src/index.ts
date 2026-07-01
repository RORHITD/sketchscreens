/**
 * @sketchscreens/core-schema
 *
 * The contract at the center of SketchScreens: the `ProjectMap` shape that the
 * extractor produces and the renderer consumes. Import the zod schemas to
 * validate, or the inferred types to build maps in TypeScript.
 */

export {
  ElementType,
  ElementVariant,
  ScreenElement,
  ScreenSpec,
  Edge,
  Surface,
  ProjectMapMeta,
  ProjectMap,
} from "./schema.js";

export type {
  ElementType as ElementTypeT,
  ElementVariant as ElementVariantT,
  ScreenElement as ScreenElementT,
  ScreenSpec as ScreenSpecT,
  Edge as EdgeT,
  Surface as SurfaceT,
  ProjectMapMeta as ProjectMapMetaT,
  ProjectMap as ProjectMapT,
} from "./schema.js";

export {
  validateProjectMap,
  parseProjectMap,
  type ValidationIssue,
  type ValidationResult,
} from "./validate.js";
