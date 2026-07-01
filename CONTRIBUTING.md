# Contributing to SketchScreens

Thanks for helping build this. SketchScreens is MIT and community-driven — the whole point is that anyone can extend it.

## Ground rules

- **Local-first stays local-first.** No feature may send a user's source code off their machine by default. The LLM extraction call the user already runs is the only outbound path, and it must stay opt-in and obvious.
- **Permissive deps only.** Prefer MIT / Apache-2.0 / ISC / BSD. Anything copyleft (e.g. EPL-2.0) must be optional and clearly flagged — never on the default path.
- **The contract is sacred.** `packages/core-schema` (the `ProjectMap` / `ScreenSpec` shape) is what every other package depends on. Changes there are versioned and reviewed carefully.

## Getting started

```bash
git clone <your-fork>
cd sketchscreens
pnpm install
pnpm typecheck
pnpm test
```

## The architecture in one breath

```
extractor (reads code) ──▶ ProjectMap (core-schema) ──▶ renderer (draws it)
```

Everything plugs into the **ProjectMap** seam. If your change doesn't touch that shape, it's isolated to one package.

## Teaching it a new stack

You do **not** edit the engine to support a new framework. Because extraction is agent-first, a "profile" is just **prompt text** — a stack section in `packages/extractor/prompts/extract.md` that tells the agent how screens, navigation, and UI elements are expressed in that stack. Add a section under "Stack profiles" there. (Optionally, add a static screen-enumerator to `packages/extractor/src/enumerate.ts` so coverage reporting works for the stack — enumeration only; element reading stays with the agent.)

A good stack section answers three questions:

1. **How do I enumerate screens?** (filesystem convention? a route table? a class-name pattern?)
2. **How do I find navigation edges?** (which calls/props point from one screen to another?)
3. **How do I read a screen's elements?** (what does a field / button / heading literally look like in the source?)

## Adding a wireframe element type

Element types are a **closed enum** in `core-schema` that maps 1:1 onto renderable primitives (mostly [wired-elements](https://wiredjs.com)). To add one:

1. Add it to the `ElementType` enum in `packages/core-schema`.
2. Handle it in the renderer's screen-node component.
3. Update the extractor prompt so the agent knows when to emit it.

## PRs

- Keep them focused. One concern per PR.
- Run `pnpm typecheck` and `pnpm test` before opening.
- Describe *what* and *why*. Screenshots of the resulting map are hugely welcome.

## License

By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE).
