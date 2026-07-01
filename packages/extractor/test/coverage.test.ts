import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { enumerateScreens, detectStack, coverage } from "../src/enumerate.js";
import { parseProjectMap } from "@sketchscreens/core-schema";

/** Build a throwaway Next.js App Router repo on disk. */
function makeNextRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "ss-cov-"));
  const app = join(root, "src", "app");
  mkdirSync(join(app, "(auth)", "login"), { recursive: true });
  mkdirSync(join(app, "dashboard"), { recursive: true });
  mkdirSync(join(app, "settings", "[id]"), { recursive: true });
  writeFileSync(join(app, "(auth)", "login", "page.tsx"), "export default () => null");
  writeFileSync(join(app, "dashboard", "page.tsx"), "export default () => null");
  writeFileSync(join(app, "settings", "[id]", "page.tsx"), "export default () => null");
  return root;
}

test("detects Next.js App Router and enumerates page routes", () => {
  const root = makeNextRepo();
  try {
    assert.equal(detectStack(root), "next-app");
    const { screens } = enumerateScreens(root);
    const routes = screens.map((s) => s.route).sort();
    // (auth) is stripped; [id] -> :id
    assert.deepEqual(routes, ["/dashboard", "/login", "/settings/:id"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("coverage flags a discovered screen that the map omitted", () => {
  const root = makeNextRepo();
  try {
    // A map that mapped dashboard + settings but SKIPPED login.
    const map = parseProjectMap({
      name: "Partial",
      surface: "web",
      screens: [
        { id: "dashboard", name: "Dashboard", route: "/dashboard", sourceFile: "src/app/dashboard/page.tsx", elements: [] },
        { id: "settings", name: "Settings", route: "/settings/:id", sourceFile: "src/app/settings/[id]/page.tsx", elements: [] },
      ],
      edges: [],
    });
    const cov = coverage(map, root);
    assert.equal(cov.stack, "next-app");
    assert.equal(cov.discovered, 3);
    assert.equal(cov.mapped, 2);
    assert.equal(cov.missing.length, 1);
    assert.equal(cov.missing[0]?.route, "/login");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
