# SketchScreens

**Auto-generate hand-drawn sketch wireframes of an app's screens + user-journey flow — straight from its source code.**

Point it at a repo. It finds the screens, the fields and buttons on each, and how you navigate between them — and draws it all as a hand-sketched wireframe map you can review without ever opening the running app.

Local-first · agent-driven · MIT · [sketchscreens.com](https://sketchscreens.com)

## Install / run

```bash
npx sketchscreens --help
```

or install globally:

```bash
npm install -g sketchscreens
```

## Commands

```bash
sketchscreens prompt              # the extraction guide (what the agent follows)
sketchscreens map <candidate>     # validate a map + coverage-check + open it
sketchscreens open <map.json>     # re-open a saved map in the local viewer
sketchscreens doctor              # check the install
```

## How it works

Extraction is **agent-first**: a coding agent (e.g. Claude Code, via the `/visual-map` skill) reads each screen's component and emits a small stack-agnostic JSON — the **ProjectMap** — which the renderer draws as hand-drawn wireframes. That's what lets it work on any stack (Next.js, Flutter, Express, …) with no per-framework parser.

Every `map`/`open` run prints a **provenance + coverage report** — how many source files resolve on disk and which discovered routes weren't mapped — so a silently-omitted surface (like a missing auth flow) can't hide.

## Safe by design

Runs entirely on your machine. The viewer binds to `localhost`. Nothing about your code leaves your machine.

## License

[MIT](https://github.com/houstonitd/sketchscreens) © Houston IT Developers
