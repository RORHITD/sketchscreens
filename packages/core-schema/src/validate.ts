import { ProjectMap } from "./schema.js";

/** A validation problem found in a ProjectMap. */
export interface ValidationIssue {
  /** Machine-readable code. */
  code:
    | "schema"
    | "duplicate_screen_id"
    | "edge_unknown_from"
    | "edge_unknown_to"
    | "self_edge"
    | "parent_unknown"
    | "parent_self"
    | "parent_cycle";
  /** Human-readable message. */
  message: string;
  /** JSON-ish path to the offending value, when known. */
  path?: string;
}

export interface ValidationResult {
  ok: boolean;
  /** The parsed map when `ok` is true (defaults applied), else undefined. */
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
      message: i.message,
      path: i.path.join("."),
    }));
    return { ok: false, issues };
  }

  const map = parsed.data;
  const issues: ValidationIssue[] = [];

  // Unique screen ids.
  const seen = new Set<string>();
  for (const screen of map.screens) {
    if (seen.has(screen.id)) {
      issues.push({
        code: "duplicate_screen_id",
        message: `Duplicate screen id "${screen.id}".`,
        path: `screens[id=${screen.id}]`,
      });
    }
    seen.add(screen.id);
  }

  // Edges must reference existing screens, and not point a screen at itself.
  map.edges.forEach((edge, idx) => {
    if (!seen.has(edge.from)) {
      issues.push({
        code: "edge_unknown_from",
        message: `Edge #${idx} references unknown source screen "${edge.from}".`,
        path: `edges[${idx}].from`,
      });
    }
    if (!seen.has(edge.to)) {
      issues.push({
        code: "edge_unknown_to",
        message: `Edge #${idx} references unknown target screen "${edge.to}".`,
        path: `edges[${idx}].to`,
      });
    }
    if (edge.from === edge.to) {
      issues.push({
        code: "self_edge",
        message: `Edge #${idx} points screen "${edge.from}" at itself.`,
        path: `edges[${idx}]`,
      });
    }
  });

  // Journey `parent` links: must reference an existing screen, not self, and
  // must not form a cycle (walking parents from any screen must terminate).
  const parentOf = new Map<string, string>();
  for (const screen of map.screens) {
    if (screen.parent === undefined) continue;
    if (screen.parent === screen.id) {
      issues.push({
        code: "parent_self",
        message: `Screen "${screen.id}" lists itself as its parent.`,
        path: `screens[id=${screen.id}].parent`,
      });
      continue;
    }
    if (!seen.has(screen.parent)) {
      issues.push({
        code: "parent_unknown",
        message: `Screen "${screen.id}" has unknown parent "${screen.parent}".`,
        path: `screens[id=${screen.id}].parent`,
      });
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
        issues.push({
          code: "parent_cycle",
          message: `Parent chain from "${start}" forms a cycle at "${cur}".`,
          path: `screens[id=${start}].parent`,
        });
        break;
      }
      visited.add(cur);
      cur = parentOf.get(cur);
    }
  }

  if (issues.length > 0) {
    return { ok: false, map, issues };
  }
  return { ok: true, map, issues: [] };
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
