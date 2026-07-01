import { ProjectMap } from "./schema.js";

/** How serious a validation issue is. Errors fail the gate; warnings don't. */
export type IssueSeverity = "error" | "warning";

/** A validation problem found in a ProjectMap. */
export interface ValidationIssue {
  /** Machine-readable code. */
  code:
    // errors — the map is malformed and must not render
    | "schema"
    | "duplicate_screen_id"
    | "edge_unknown_from"
    | "edge_unknown_to"
    | "self_edge"
    | "parent_unknown"
    | "parent_self"
    | "parent_cycle"
    // warnings — the map renders but something's off
    | "no_screens"
    | "entry_count"
    | "duplicate_edge"
    | "sourcefile_missing";
  /** Error (fails the gate) or warning (renders anyway). Defaults to error. */
  severity: IssueSeverity;
  /** Human-readable message. */
  message: string;
  /** JSON-ish path to the offending value, when known. */
  path?: string;
}

export interface ValidationResult {
  /** True when there are no ERROR-severity issues (warnings don't fail it). */
  ok: boolean;
  /** The parsed map when the shape is valid (defaults applied), else undefined. */
  map?: ProjectMap;
  issues: ValidationIssue[];
}

/**
 * Validate a raw object as a ProjectMap.
 *
 * Runs the zod schema first (shape + enums + defaults), then referential
 * checks that zod can't express: unique screen ids and edges that point at
 * screens that actually exist. This is the gate the extractor's output must
 * pass before the renderer will draw it.
 */
export function validateProjectMap(input: unknown): ValidationResult {
  const parsed = ProjectMap.safeParse(input);
  if (!parsed.success) {
    const issues: ValidationIssue[] = parsed.error.issues.map((i) => ({
      code: "schema",
      severity: "error",
      message: i.message,
      path: i.path.join("."),
    }));
    return { ok: false, issues };
  }

  const map = parsed.data;
  const issues: ValidationIssue[] = [];
  const err = (code: ValidationIssue["code"], message: string, path?: string) =>
    issues.push({ code, severity: "error", message, path });
  const warn = (code: ValidationIssue["code"], message: string, path?: string) =>
    issues.push({ code, severity: "warning", message, path });

  // A map with no screens renders as a blank canvas — warn rather than crash.
  if (map.screens.length === 0) {
    warn("no_screens", "The map has no screens.");
  }

  // Unique screen ids.
  const seen = new Set<string>();
  for (const screen of map.screens) {
    if (seen.has(screen.id)) {
      err("duplicate_screen_id", `Duplicate screen id "${screen.id}".`, `screens[id=${screen.id}]`);
    }
    seen.add(screen.id);
  }

  // At most one entry screen; ideally exactly one (the renderer infers if 0).
  const entryCount = map.screens.filter((s) => s.isEntry).length;
  if (entryCount > 1) {
    warn(
      "entry_count",
      `${entryCount} screens are marked isEntry; there should be exactly one (the app's first screen).`,
    );
  }

  // Edges must reference existing screens, and not point a screen at itself.
  const edgeKeys = new Set<string>();
  map.edges.forEach((edge, idx) => {
    if (!seen.has(edge.from)) {
      err("edge_unknown_from", `Edge #${idx} references unknown source screen "${edge.from}".`, `edges[${idx}].from`);
    }
    if (!seen.has(edge.to)) {
      err("edge_unknown_to", `Edge #${idx} references unknown target screen "${edge.to}".`, `edges[${idx}].to`);
    }
    if (edge.from === edge.to) {
      err("self_edge", `Edge #${idx} points screen "${edge.from}" at itself.`, `edges[${idx}]`);
    }
    const key = `${edge.from}->${edge.to}`;
    if (edgeKeys.has(key)) {
      warn("duplicate_edge", `Edge #${idx} duplicates ${key}.`, `edges[${idx}]`);
    }
    edgeKeys.add(key);
  });

  // Journey `parent` links: must reference an existing screen, not self, and
  // must not form a cycle (walking parents from any screen must terminate).
  const parentOf = new Map<string, string>();
  for (const screen of map.screens) {
    if (screen.parent === undefined) continue;
    if (screen.parent === screen.id) {
      err("parent_self", `Screen "${screen.id}" lists itself as its parent.`, `screens[id=${screen.id}].parent`);
      continue;
    }
    if (!seen.has(screen.parent)) {
      err("parent_unknown", `Screen "${screen.id}" has unknown parent "${screen.parent}".`, `screens[id=${screen.id}].parent`);
      continue;
    }
    parentOf.set(screen.id, screen.parent);
  }
  // Cycle detection over the parent chains.
  for (const start of parentOf.keys()) {
    const visited = new Set<string>([start]);
    let cur = parentOf.get(start);
    while (cur !== undefined) {
      if (visited.has(cur)) {
        err("parent_cycle", `Parent chain from "${start}" forms a cycle at "${cur}".`, `screens[id=${start}].parent`);
        break;
      }
      visited.add(cur);
      cur = parentOf.get(cur);
    }
  }

  // The gate fails only on ERROR-severity issues; warnings render anyway.
  const ok = !issues.some((i) => i.severity === "error");
  return { ok, map, issues };
}

/**
 * Like {@link validateProjectMap} but throws on failure. Useful in scripts
 * and tests where an invalid map should hard-stop.
 */
export function parseProjectMap(input: unknown): ProjectMap {
  const result = validateProjectMap(input);
  if (!result.ok || !result.map) {
    const detail = result.issues
      .map((i) => `  - [${i.code}] ${i.message}${i.path ? ` (${i.path})` : ""}`)
      .join("\n");
    throw new Error(`Invalid ProjectMap:\n${detail}`);
  }
  return result.map;
}
