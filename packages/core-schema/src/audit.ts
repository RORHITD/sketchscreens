import { existsSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { ProjectMap } from "./schema.js";
import type { ValidationIssue } from "./validate.js";

/**
 * NODE-ONLY provenance audit. Separate from validate.ts (which stays
 * browser-safe) because this touches the filesystem — only the CLI imports it.
 *
 * Verifies each screen's `sourceFile` actually exists under the repo root, so a
 * hallucinated path can't masquerade as real provenance. Missing files are
 * WARNINGS, not errors: a modal/dialog screen may legitimately have no file.
 */

export interface AuditResult {
  /** Repo root the sourceFiles were resolved against. */
  repoRoot: string;
  /** How many screens declared a sourceFile. */
  withSourceFile: number;
  /** How many of those resolved to a real file. */
  resolved: number;
  /** sourceFiles that didn't resolve (repo-relative as written). */
  missing: string[];
  /** Warning issues (one per missing sourceFile). */
  issues: ValidationIssue[];
}

/**
 * Audit a map's `sourceFile`s against `repoRoot`. Pass the root from the map's
 * `meta.repoRoot` (or the cwd the extraction ran in). `~` is expanded.
 */
export function auditSourceFiles(map: ProjectMap, repoRoot: string): AuditResult {
  const root = expandHome(repoRoot);
  const missing: string[] = [];
  const issues: ValidationIssue[] = [];
  let withSourceFile = 0;
  let resolved = 0;

  for (const screen of map.screens) {
    const sf = screen.sourceFile;
    if (!sf) continue;
    withSourceFile++;
    const abs = isAbsolute(sf) ? sf : resolve(root, sf);
    if (existsSync(abs) && statSync(abs).isFile()) {
      resolved++;
    } else {
      missing.push(sf);
      issues.push({
        code: "sourcefile_missing",
        severity: "warning",
        message: `Screen "${screen.id}" sourceFile does not exist: ${sf}`,
        path: `screens[id=${screen.id}].sourceFile`,
      });
    }
  }

  return { repoRoot: root, withSourceFile, resolved, missing, issues };
}

/** Expand a leading ~ to the user's home directory. */
function expandHome(p: string): string {
  if (p === "~" || p.startsWith("~/")) {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    return home + p.slice(1);
  }
  return p;
}
