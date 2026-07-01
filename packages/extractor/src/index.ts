/**
 * @sketchscreens/extractor
 *
 * The extraction contract is agent-first: an agent reads the codebase and emits
 * a ProjectMap, guided by `prompts/extract.md`. This package provides the
 * programmatic glue around that — reading the prompt and validating/writing the
 * agent's output.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  validateProjectMap,
  type ProjectMapT,
  type ValidationResult,
} from "@sketchscreens/core-schema";

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the extraction prompt the agent should follow. */
export const EXTRACTION_PROMPT_PATH = resolve(here, "../prompts/extract.md");

/** Read the extraction prompt text. */
export async function readExtractionPrompt(): Promise<string> {
  return readFile(EXTRACTION_PROMPT_PATH, "utf8");
}

/**
 * Validate a map object (as produced by the agent) and, if valid, write it to
 * `outPath` as pretty JSON. Returns the validation result so callers can report
 * precise errors back to the agent for a retry.
 */
export async function writeMapIfValid(
  map: unknown,
  outPath: string,
): Promise<ValidationResult> {
  const result = validateProjectMap(map);
  if (result.ok && result.map) {
    await writeFile(outPath, JSON.stringify(result.map, null, 2) + "\n", "utf8");
  }
  return result;
}

export type { ProjectMapT };
export { validateProjectMap };
export { auditSourceFiles, type AuditResult } from "@sketchscreens/core-schema/audit";
export {
  enumerateScreens,
  detectStack,
  coverage,
  type DiscoveredScreen,
  type CoverageReport,
  type Stack,
} from "./enumerate.js";
