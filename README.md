<div align="center">

# SketchScreens

**Auto-generate hand-drawn sketch wireframes of every screen in an app — straight from its source code.**

Point it at a repo. It finds the screens, the fields and buttons on each, and the flow between them — and draws it all as a hand-sketched wireframe map. Review a whole app without ever opening the running app.

[![npm](https://img.shields.io/npm/v/sketchscreens?color=2f6f8f&label=npm)](https://www.npmjs.com/package/sketchscreens)
[![license](https://img.shields.io/badge/license-MIT-2f6f8f)](./LICENSE)
[![local-first](https://img.shields.io/badge/local--first-%E2%9C%93-2f6f8f)](#safe-by-design)

[sketchscreens.com](https://sketchscreens.com) · MIT · local-first · agent-driven

```bash
npx sketchscreens --help
```

</div>

---

## Why

Reviewing an app's screens and flows usually means either **running the app** and clicking through it, or **drawing the diagram by hand** in Excalidraw / Figma — which nobody keeps up to date.

Every existing tool is either *plan-first* (you write the plan, it visualizes it), *manual* (you draw it), or a *closed SaaS* that goes the other direction (screenshot → code). **Nothing reads your actual source and draws the actual screens.**

SketchScreens does exactly that:

- **Connect your code** → it detects the screens that are actually wired together.
- **For each screen** → it reads the real fields, buttons, headings, and lists.
- **Renders a sketch** → a low-fidelity, hand-drawn wireframe of each screen (elements roughly where they are — a sketch, not a pixel-perfect mock) plus arrows showing the flow between screens.

The point isn't a pretty design file. It's a fast, honest, always-current picture of *what screens exist, what's on them, and how you move between them* — for reviewing your own apps, onboarding a new dev, or sanity-checking an AI-generated app.

## Safe by design

- **Local-first.** Runs on your machine. The viewer binds to localhost.
- **No phone-home.** Nothing about your code leaves your machine by default.
- **Self-hostable & MIT.** Your tool, your infra. Fork it, extend it, ship it.

## How it works

Everything pivots on one small, stack-agnostic JSON contract — the **ProjectMap** (screens + elements + flow edges). A screen from a Next.js app and a screen from a Flutter app both reduce to the same shape, so the renderer draws them identically.

```
your repo ──▶  extractor  ──▶  map.json (ProjectMap)  ──▶  renderer  ──▶  sketch wireframe map
              (reads code)      (the contract)             (React Flow + hand-drawn widgets)
```

Extraction is **agent-first**: a coding agent (Claude) reads each screen's component and emits the spec. That's what lets it work on *any* stack — Next.js, Flutter, Express, Vue, SwiftUI — with no per-framework parser to maintain. (An optional static-parse pre-pass can accelerate the common stacks later.)

## Two ways to use it

1. **Claude Code skill** — run `/visual-map` in any repo. It reads the code, produces the map, and auto-opens the sketch map in your browser. *(the fast path)*
2. **The `sketchscreens` CLI** — one command for the mechanics:

   ```bash
   sketchscreens prompt                  # the extraction guide the agent follows
   sketchscreens map map.candidate.json  # validate + coverage-check + open
   sketchscreens open sketchscreens.map.json   # re-open a saved map
   sketchscreens doctor                  # check the install
   ```

Every `map`/`open` run prints a **provenance + coverage report** — how many `sourceFile`s resolve on disk and which discovered routes weren't mapped — so a silently-omitted surface (a missing auth flow) can't hide.

## Project layout

```
sketchscreens/
  packages/
    core-schema/   the ProjectMap / ScreenSpec contract (TS types + zod + validator)
    extractor/     agent-first extraction prompt + the write-map gate + static
                   screen enumeration (for coverage)
    renderer/      React Flow app — each node is a hand-drawn screen wireframe
    cli/           the `sketchscreens` command (doctor/prompt/open/map)
  apps/
    viewer/        thin localhost server: serve the renderer + a map.json
    platform/      (later) full self-hostable web app
  skill/           the /visual-map Claude Code skill
  examples/        sample map.json files (used by the renderer + tests)
```

## Status

🚧 Early. Building in the open. See [ROADMAP](#roadmap).

### Roadmap

- [x] **Phase 0** — monorepo + the `ProjectMap` contract + a sample map
- [x] **Phase 1** — the renderer (hand-drawn wireframes + flow arrows)
- [x] **Phase 2** — the extractor + the `/visual-map` skill (the headline)
- [ ] **Phase 3** — the self-hostable platform + static-parse accelerators

## Built with

[React Flow](https://reactflow.dev) · [wired-elements](https://wiredjs.com) · [rough.js](https://roughjs.com) · [dagre](https://github.com/dagrejs/dagre) — all MIT.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Teaching it a new stack means writing an extraction *profile*, not editing the engine.

## License

[MIT](./LICENSE) © Houston IT Developers
