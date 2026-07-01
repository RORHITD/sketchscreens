import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { validateProjectMap, parseProjectMap, ProjectMap } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const examplePath = resolve(here, "../../../examples/shopwave-web.map.json");

test("the committed Shopwave sample is a valid ProjectMap", () => {
  const raw = JSON.parse(readFileSync(examplePath, "utf8"));
  const result = validateProjectMap(raw);
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
  assert.ok(result.map);
  assert.equal(result.map.surface, "web");
  assert.ok(result.map.screens.length >= 5);
});

test("parseProjectMap returns a typed map with defaults applied", () => {
  const map = parseProjectMap({
    name: "Tiny",
    surface: "web",
    screens: [{ id: "a", name: "A" }],
    edges: [],
  });
  assert.equal(map.version, 1);
  // elements defaults to [] when omitted
  assert.deepEqual(map.screens[0]?.elements, []);
});

test("rejects an edge that points at a missing screen", () => {
  const result = validateProjectMap({
    name: "Broken",
    surface: "web",
    screens: [{ id: "a", name: "A", elements: [] }],
    edges: [{ from: "a", to: "ghost" }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "edge_unknown_to"));
});

test("rejects duplicate screen ids", () => {
  const result = validateProjectMap({
    name: "Dupes",
    surface: "web",
    screens: [
      { id: "a", name: "A", elements: [] },
      { id: "a", name: "A2", elements: [] },
    ],
    edges: [],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "duplicate_screen_id"));
});

test("rejects an unknown element type", () => {
  const result = ProjectMap.safeParse({
    name: "BadElement",
    surface: "web",
    screens: [
      {
        id: "a",
        name: "A",
        elements: [{ type: "hologram", label: "nope" }],
      },
    ],
    edges: [],
  });
  assert.equal(result.success, false);
});

test("rejects a self-referential edge", () => {
  const result = validateProjectMap({
    name: "SelfLoop",
    surface: "web",
    screens: [{ id: "a", name: "A", elements: [] }],
    edges: [{ from: "a", to: "a" }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "self_edge"));
});

test("accepts a valid journey with parent + isEntry", () => {
  const result = validateProjectMap({
    name: "Journey",
    surface: "web",
    screens: [
      { id: "launch", name: "Launch", isEntry: true, elements: [] },
      { id: "auth", name: "Auth", parent: "launch", elements: [] },
      { id: "home", name: "Home", parent: "auth", elements: [] },
    ],
    edges: [],
  });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("rejects a parent that doesn't exist", () => {
  const result = validateProjectMap({
    name: "BadParent",
    surface: "web",
    screens: [{ id: "a", name: "A", parent: "ghost", elements: [] }],
    edges: [],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "parent_unknown"));
});

test("rejects a parent cycle", () => {
  const result = validateProjectMap({
    name: "Cycle",
    surface: "web",
    screens: [
      { id: "a", name: "A", parent: "b", elements: [] },
      { id: "b", name: "B", parent: "a", elements: [] },
    ],
    edges: [],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "parent_cycle"));
});

test("every issue carries a severity; errors fail the gate, warnings don't", () => {
  const bad = validateProjectMap({
    name: "X",
    surface: "web",
    screens: [{ id: "a", name: "A", elements: [] }],
    edges: [{ from: "a", to: "ghost" }],
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.issues.every((i) => i.severity === "error" || i.severity === "warning"));
  assert.ok(bad.issues.some((i) => i.severity === "error"));
});

test("an empty map is a WARNING, not an error (still ok)", () => {
  const result = validateProjectMap({ name: "Empty", surface: "web", screens: [], edges: [] });
  assert.equal(result.ok, true);
  const w = result.issues.find((i) => i.code === "no_screens");
  assert.ok(w && w.severity === "warning");
});

test("more than one isEntry is a warning, not an error", () => {
  const result = validateProjectMap({
    name: "TwoEntries",
    surface: "web",
    screens: [
      { id: "a", name: "A", isEntry: true, elements: [] },
      { id: "b", name: "B", isEntry: true, elements: [] },
    ],
    edges: [],
  });
  assert.equal(result.ok, true);
  const w = result.issues.find((i) => i.code === "entry_count");
  assert.ok(w && w.severity === "warning");
});

test("a duplicate edge is a warning", () => {
  const result = validateProjectMap({
    name: "DupEdge",
    surface: "web",
    screens: [
      { id: "a", name: "A", elements: [] },
      { id: "b", name: "B", elements: [] },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "a", to: "b" },
    ],
  });
  assert.equal(result.ok, true);
  assert.ok(result.issues.some((i) => i.code === "duplicate_edge" && i.severity === "warning"));
});
