import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

import { validateProjectMap } from "../src/index.js";

// Every committed example must stay a valid ProjectMap. The renderer bundles
// the journey map as its dev fallback and CI smoke-tests all of them through
// the CLI gate — if one drifts from the schema, this catches it in unit tests
// before it breaks `pnpm dev` or the smoke step.
const examplesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../examples");
const exampleFiles = readdirSync(examplesDir).filter((f) => f.endsWith(".map.json"));

test("there are committed example maps", () => {
  assert.ok(exampleFiles.length >= 3, `expected >=3 examples, found ${exampleFiles.length}`);
});

for (const file of exampleFiles) {
  test(`examples/${file} is a valid ProjectMap`, () => {
    const raw = JSON.parse(readFileSync(join(examplesDir, file), "utf8"));
    const result = validateProjectMap(raw);
    assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
    assert.ok(result.map);
    assert.ok(result.map.screens.length > 0, "example should not be empty");
  });
}
