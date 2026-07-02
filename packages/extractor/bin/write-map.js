#!/usr/bin/env node
/**
 * sketchscreens-write-map — validate an agent-produced ProjectMap, audit its
 * provenance + coverage, and write it.
 *
 * Usage:
 *   sketchscreens-write-map <candidate.json> <out.json>
 *
 * Exit 0 + writes <out.json> when the map has no ERRORS (warnings are fine).
 * Exit 1 + prints precise errors (for the agent to fix) when it doesn't.
 *
 * Beyond shape validation, it runs two TRUST checks when meta.repoRoot is set:
 *  - sourceFile audit: every screen's file must exist on disk (else warn).
 *  - coverage: statically-discovered screens vs mapped ones (catches a silently
 *    omitted surface, e.g. a missing auth flow).
 * These are WARNINGS — they inform, they don't block.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { writeMapIfValid, auditSourceFiles, coverage } from "../dist/index.js";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const [, , candidatePath, outPath] = process.argv;
if (!candidatePath || !outPath) fail("Usage: sketchscreens-write-map <candidate.json> <out.json>");

const abs = resolve(process.cwd(), candidatePath);
if (!existsSync(abs)) fail(`Candidate map not found: ${abs}`);

let raw;
try {
  raw = JSON.parse(await readFile(abs, "utf8"));
} catch (e) {
  fail(`Candidate is not valid JSON: ${e.message}`);
}

const result = await writeMapIfValid(raw, resolve(process.cwd(), outPath));

// Errors block; print them and bail.
const errors = result.issues.filter((i) => i.severity === "error");
if (!result.ok) {
  console.error("Map is INVALID. Fix these and retry:");
  for (const i of errors) {
    console.error(`  ✗ [${i.code}] ${i.message}${i.path ? ` (${i.path})` : ""}`);
  }
  process.exit(1);
}

const m = result.map;
console.log(`OK — ${m.screens.length} screens, ${m.edges.length} edges → ${outPath}`);

// Warnings (schema-level: entry count, dup edges, empty map).
const warnings = result.issues.filter((i) => i.severity === "warning");

// Trust checks (need a repo root to resolve files / discover screens).
const repoRoot = m.meta?.repoRoot;
if (repoRoot) {
  const audit = auditSourceFiles(m, repoRoot);
  console.log(`\nProvenance: ${audit.resolved}/${audit.withSourceFile} sourceFiles resolved on disk.`);
  warnings.push(...audit.issues);

  const cov = coverage(m, repoRoot);
  if (cov.stack !== "unknown") {
    console.log(`Coverage (${cov.stack}): ${cov.mapped}/${cov.discovered} discovered screens mapped.`);
    if (cov.missing.length) {
      console.log(`  ⚠ ${cov.missing.length} discovered screen(s) NOT in the map (possible omissions):`);
      for (const d of cov.missing.slice(0, 20)) console.log(`      - ${d.route}  (${d.sourceFile})`);
      if (cov.missing.length > 20) console.log(`      … and ${cov.missing.length - 20} more`);
    }
    if (cov.extra.length) {
      console.log(`  ⚠ ${cov.extra.length} map screen(s) NOT among discovered files (agent-added; verify they exist):`);
      for (const id of cov.extra.slice(0, 20)) console.log(`      - ${id}`);
      if (cov.extra.length > 20) console.log(`      … and ${cov.extra.length - 20} more`);
    }
  }
} else {
  console.log("\n(no meta.repoRoot — skipped sourceFile + coverage checks)");
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const i of warnings.slice(0, 25)) {
    console.log(`  ⚠ [${i.code}] ${i.message}${i.path ? ` (${i.path})` : ""}`);
  }
}

process.exit(0);
