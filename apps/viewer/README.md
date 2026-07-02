# @sketchscreens/viewer

The **local viewer** for [SketchScreens](https://sketchscreens.com): a thin localhost server that validates a `map.json` and serves the sketch-wireframe renderer with the map injected.

```bash
sketchscreens-view <path-to-map.json> [--port 4318] [--no-open] [--export-html [file]]
```

- Binds to `127.0.0.1` only — local-first, nothing about your code leaves your machine.
- `--export-html` emits ONE self-contained `.html` (renderer JS+CSS + map inlined) you can email or host anywhere.

Normally invoked through the [`sketchscreens` CLI](https://www.npmjs.com/package/sketchscreens) (`sketchscreens open <map.json>`).

Part of the [SketchScreens monorepo](https://github.com/RORHITD/sketchscreens).

[MIT](./LICENSE) © [Houston IT Developers](https://houstonitdevelopers.com)
