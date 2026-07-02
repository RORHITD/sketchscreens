# @sketchscreens/extractor

The **extraction half** of [SketchScreens](https://sketchscreens.com): the agent-first extraction prompt, the `write-map` validation gate, and static screen enumeration for coverage checks.

- `prompts/extract.md` — the guide a coding agent follows to produce a ProjectMap from source code (`sketchscreens prompt` prints it).
- `bin/write-map.js` — validates a candidate map, prints a provenance + coverage report (which discovered routes weren't mapped), and writes it.
- `coverage(map, repoRoot)` / `auditSourceFiles(map, repoRoot)` — compare a map against statically-discovered screens (Next.js App/Pages Router, and more), so a silently-omitted screen can't hide.

Part of the [SketchScreens monorepo](https://github.com/RORHITD/sketchscreens). Most users want the [`sketchscreens` CLI](https://www.npmjs.com/package/sketchscreens) instead.

[MIT](./LICENSE) © [Houston IT Developers](https://houstonitdevelopers.com)
