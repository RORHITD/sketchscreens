import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { auditSourceFiles } from "../src/audit.js";
import { parseProjectMap } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../.."); // the sketchscreens repo root

test("audit resolves real sourceFiles and flags fake ones", () => {
  const map = parseProjectMap({
    name: "Audit",
    surface: "web",
    screens: [
      // A file that really exists in this repo.
      { id: "real", name: "Real", sourceFile: "package.json", elements: [] },
      // A file that does not.
      { id: "fake", name: "Fake", sourceFile: "src/does/not/exist.tsx", elements: [] },
      // No sourceFile — not counted.
      { id: "none", name: "None", elements: [] },
    ],
    edges: [],
  });

  const audit = auditSourceFiles(map, repoRoot);
  assert.equal(audit.withSourceFile, 2);
  assert.equal(audit.resolved, 1);
  assert.deepEqual(audit.missing, ["src/does/not/exist.tsx"]);
  assert.equal(audit.issues.length, 1);
  assert.equal(audit.issues[0]?.code, "sourcefile_missing");
  assert.equal(audit.issues[0]?.severity, "warning");
});
