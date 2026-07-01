---
name: visual-map
description: Auto-generate a hand-drawn sketch wireframe map of an app's screens + flows, straight from its source code, and open it in a local viewer. Use when the user wants to see/review/visualize an app's screens, its navigation flow, or "what screens exist and how they connect" without running the live app. Triggers on "map this app", "sketch the screens", "visualize the flow", "wireframe the app", "/visual-map".
---

# /visual-map — sketch an app's screens from its code

Turn the current repository (or a chosen surface of it) into an interactive, hand-drawn **sketch wireframe map**: each screen drawn as a low-fidelity wireframe (its real fields/buttons/headings, roughly in order), connected by flow arrows. Then open it in a local, localhost-only viewer.

This is **agent-first extraction**: *you* read the code and produce the map — that's what lets it work on any stack. Follow this procedure.

## Safety & scope

- **Local-first.** Everything runs on the user's machine. The viewer binds to `127.0.0.1`. Nothing about their code leaves the machine.
- **One map = one surface.** If the repo has multiple surfaces (web + mobile + backend), ask which one, or default to the primary UI surface.

## Procedure

### 1. Locate the tool
Find the SketchScreens repo root (it contains `packages/renderer`, `packages/extractor`, `apps/viewer`). It is typically at `~/C/sketchscreens`. Confirm the renderer is built:

```bash
ls <sketchscreens>/packages/renderer/dist/index.html 2>/dev/null \
  || pnpm --dir <sketchscreens> --filter @sketchscreens/renderer build
pnpm --dir <sketchscreens> --filter @sketchscreens/extractor build  # if dist/ missing
```

### 2. Read the extraction contract
Read the extraction prompt and follow it exactly — it defines the output shape (`ProjectMap`), the closed element enum, and per-stack parse signals:

```bash
cat <sketchscreens>/packages/extractor/prompts/extract.md
```

### 3. Identify the surface + enumerate screens
- Detect the stack (Next.js App/Pages Router, Flutter, Express, or read a few files to learn an unknown one).
- Enumerate screens per the profile. **Remember the thin-page rule:** a route file that just renders `<SomeComponent />` — follow the import and read *that* component for the elements.
- Scope sensibly: for a large app, map the primary flow (auth → home → key sections) and note the scope rather than padding.

### 4. Extract elements + edges per screen
For each screen, read its component and list its elements **top-to-bottom in source order** using only the closed enum types. Infer edges from navigation calls; the `trigger` is the button/link label.

### 5. Write the map + validate
Write your ProjectMap JSON to a temp file, then validate + persist it with the CLI (this is the gate — the viewer only sees a valid map):

```bash
# write your JSON to /tmp/ss-candidate.json (via your file tools), then:
node <sketchscreens>/packages/extractor/bin/write-map.js /tmp/ss-candidate.json ./sketchscreens.map.json
```

If it prints validation errors, **fix them and retry** — every `edge.from`/`edge.to` must reference a real `screen.id`, ids must be unique, no self-edges.

### 6. Open the viewer
Launch the local viewer (opens the browser automatically):

```bash
node <sketchscreens>/apps/viewer/bin/view.js ./sketchscreens.map.json
```

This serves the sketch map at `http://127.0.0.1:4318/` and opens it. Tell the user it's open, summarize what you mapped (surface, screen count, the main flow), and note where `sketchscreens.map.json` was written (they can re-open it anytime, or hand it to the platform).

## Tips
- If the user names a surface ("map the mobile app"), scope to that surface's directory.
- Prefer accuracy over completeness — a smaller true map beats a padded guessed one.
- The output `sketchscreens.map.json` is portable: it can be re-opened with the viewer or loaded into the SketchScreens platform later.
