#!/usr/bin/env node
/**
 * sketchscreens-write-map — validate an agent-produced ProjectMap and write it.
 *
 * Usage:
 *   sketchscreens-write-map <candidate.json> <out.json>
 *
 * Exit 0 + writes <out.json> when the map is valid.
 * Exit 1 + prints precise issues (for the agent to fix) when it isn't.
 *
 * This is the gate between the agent's extraction and the renderer: the viewer
 * only ever sees a map that passed here.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { writeMapIfValid } from "../dist/index.js";

const [, , candidatePath, outPath] = process.argv;

if (!candidatePath || !outPath) {
  console.error("Usage: sketchscreens-write-map <candidate.json> <out.json>");
  process.exit(1);
}

const abs = resolve(process.cwd(), candidatePath);
if (!existsSync(abs)) {
  console.error(`Candidate map not found: ${abs}`);
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(await readFile(abs, "utf8"));
} catch (e) {
  console.error(`Candidate is not valid JSON: ${e.message}`);
  process.exit(1);
}

const result = await writeMapIfValid(raw, resolve(process.cwd(), outPath));

if (result.ok) {
  const m = result.map;
  console.log(`OK — ${m.screens.length} screens, ${m.edges.length} edges → ${outPath}`);
  process.exit(0);
}

console.error("Map is INVALID. Fix these and retry:");
for (const issue of result.issues) {
  console.error(`  - [${issue.code}] ${issue.message}${issue.path ? ` (${issue.path})` : ""}`);
}
process.exit(1);
