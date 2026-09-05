# @sketchscreens/renderer

The **drawing half** of [SketchScreens](https://sketchscreens.com): a React Flow app that renders a ProjectMap as hand-drawn sketch wireframes — every screen a rough.js-sketched node with its real fields and buttons, flow edges as arrows.

This package ships the **built viewer bundle** (`dist/`). It's served by [`@sketchscreens/viewer`](https://www.npmjs.com/package/@sketchscreens/viewer) and consumed through the [`sketchscreens` CLI](https://www.npmjs.com/package/sketchscreens) — you normally don't use it directly.

The map to render is resolved in priority order: `window.__SKETCHSCREENS_MAP__` (injected by the local viewer), a `?map=<url>` query param (http/https only), then a bundled sample.

## Embedding

This package also ships a second, separate build — the **embed bundle**
(`dist-embed/sketchscreens-embed.js`) — for dropping an interactive
SketchScreens canvas into a plain-JS host page, no React and no build step
required. It's one self-contained, minified file (React, ReactDOM,
`@xyflow/react`, dagre, and rough.js all bundled in) that exposes
`window.SketchScreens.mount`, so it works behind a strict same-origin-scripts
CSP: a single `<script src>`, no CDN, no external chunks.

```html
<div id="host" style="width: 100%; height: 600px;"></div>
<script src="/vendor/sketchscreens-embed.js"></script>
<script>
  var handle = window.SketchScreens.mount(document.getElementById("host"), MAP, {
    chromeless: true,          // hide the brand/logo + map name; search,
                                // section chips, count, and Export PNG stay
    theme: "dark",             // "light" (default) or "dark"
    actions: [
      {
        label: "Open in preview",
        kind: "primary",       // "primary" (default) or "ghost"
        onClick: function (screen) { /* screen: ScreenSpec */ },
      },
    ],
    onSelect: function (screen) {
      // fires on every selection change, including deselect (-> null)
    },
  });

  handle.select("some-screen-id"); // or null to deselect
  handle.fit();                    // re-fit the view to the whole graph
  handle.update(NEXT_MAP);         // swap in a new map (re-validated)
  handle.destroy();                // unmount, disconnect observers, remove the DOM node
</script>
```

`mount(el, map, opts?)` validates `map` the same way the CLI does (via
`@sketchscreens/core-schema`'s `validateProjectMap`) and throws with the
validation issues if it doesn't pass. `el` needs an explicit height from the
host page — the canvas fills `100%` of it. Safe to call `mount()` more than
once on a page; each call gets its own React root and DOM subtree, and that
instance's `destroy()` tears down exactly (and only) that subtree.

Build it yourself with `pnpm --filter @sketchscreens/renderer build:embed`
(a separate Vite config, `vite.embed.config.ts`, from the normal `build`).

Part of the [SketchScreens monorepo](https://github.com/RORHITD/sketchscreens).

[MIT](./LICENSE) © [Houston IT Developers](https://houstonitdevelopers.com)
