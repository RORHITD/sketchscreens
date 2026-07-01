---
name: visual-map
description: Auto-generate a hand-drawn sketch wireframe map of an app's screens + flows, straight from its source code, and open it in a local viewer. Use when the user wants to see/review/visualize an app's screens, its navigation flow, or "what screens exist and how they connect" without running the live app. Triggers on "map this app", "sketch the screens", "visualize the flow", "wireframe the app", "/visual-map".
---

# /visual-map — sketch an app's screens from its code

Turn the current repository (or a chosen surface of it) into an interactive, hand-drawn **sketch wireframe map**: each screen drawn as a low-fidelity wireframe (its real fields/buttons/headings, roughly in place), organized as the user journey (entry → auth → main screen → sections), and opened in a local, localhost-only viewer.

This is **agent-first extraction**: *you* read the code and produce the map — that's what lets it work on any stack. The `sketchscreens` CLI handles the mechanics (validating, serving, opening the browser); you do the reading.

## Safety & scope

- **Local-first.** Everything runs on the user's machine. The viewer binds to `127.0.0.1`. Nothing about their code leaves the machine.
- **One map = one surface.** If the repo has multiple surfaces (web + mobile + backend), ask which one, or default to the primary UI surface.

## Procedure

### 1. Read the extraction contract
It defines the output shape (`ProjectMap`), the closed element enum, the journey model (`parent`/`isEntry`/`group`), the layout hints (`region`/`align`), and per-stack parse signals. Follow it exactly:

```bash
sketchscreens prompt
```

(If `sketchscreens` isn't on PATH, it's the `sketchscreens` package's bin — `npx sketchscreens prompt`, or find the SketchScreens repo and run `node <repo>/packages/cli/bin/sketchscreens.js prompt`.)

### 2. Extract the map
Following the prompt:
- **Identify the surface + enumerate its screens** (aim for the whole route set — don't drop auth/onboarding). Remember the **thin-page rule**: a route file that just renders `<SomeComponent />` — follow the import and read *that* component for the elements.
- **For each screen**, list its elements top-to-bottom in source order using only the closed enum types; set `region`/`align` so the sketch mirrors the real layout; give lists/tables descriptive column labels (never fabricate rows).
- **Build the journey**: mark the one `isEntry` screen, set each `parent` (entry → auth → dashboard → sections), set `group` labels, and infer `edges` (verbatim triggers, or empty).

Write your `ProjectMap` JSON to a file (e.g. `sketchscreens.candidate.json`) with your file tools.

### 3. Validate + open — one command
```bash
sketchscreens map sketchscreens.candidate.json sketchscreens.map.json
```

This validates the candidate, writes `sketchscreens.map.json`, prints a **provenance + coverage report** (how many sourceFiles resolved on disk, and which discovered routes weren't mapped — check this for omissions), then opens the sketch map in the browser.

If it prints **errors**, fix them and retry (every `edge.from`/`edge.to` must reference a real `screen.id`; ids unique; no self-edges). If it prints **coverage warnings** naming routes you meant to include (e.g. an auth flow), extract those too and re-run. Warnings don't block — but a "34/83 mapped" with the login screen in the miss list is a signal you dropped something.

### 4. Report
Tell the user it's open, summarize what you mapped (surface, screen count, the main flow), mention the coverage number honestly (what's mapped vs deliberately scoped out), and note that `sketchscreens.map.json` is portable — re-open anytime with `sketchscreens open sketchscreens.map.json`.

## Tips
- To re-open an existing map: `sketchscreens open sketchscreens.map.json`.
- `sketchscreens doctor` checks the install and builds the renderer if needed.
- If the user names a surface ("map the mobile app"), scope to that surface's directory.
- Prefer accuracy over padding — a smaller true map (with an honest coverage number) beats a guessed one.
