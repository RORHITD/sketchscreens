# @sketchscreens/renderer

The **drawing half** of [SketchScreens](https://sketchscreens.com): a React Flow app that renders a ProjectMap as hand-drawn sketch wireframes — every screen a rough.js-sketched node with its real fields and buttons, flow edges as arrows.

This package ships the **built viewer bundle** (`dist/`). It's served by [`@sketchscreens/viewer`](https://www.npmjs.com/package/@sketchscreens/viewer) and consumed through the [`sketchscreens` CLI](https://www.npmjs.com/package/sketchscreens) — you normally don't use it directly.

The map to render is resolved in priority order: `window.__SKETCHSCREENS_MAP__` (injected by the local viewer), a `?map=<url>` query param (http/https only), then a bundled sample.

Part of the [SketchScreens monorepo](https://github.com/RORHITD/sketchscreens).

[MIT](./LICENSE) © [Houston IT Developers](https://houstonitdevelopers.com)
