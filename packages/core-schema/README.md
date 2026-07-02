# @sketchscreens/core-schema

The **ProjectMap contract** for [SketchScreens](https://sketchscreens.com) — TypeScript types, zod schema, and validator for the stack-agnostic JSON that describes an app's screens, elements, and flow edges.

Everything in SketchScreens pivots on this one shape: extractors produce it, the renderer draws it.

```ts
import { validateProjectMap, parseProjectMap } from "@sketchscreens/core-schema";

const result = validateProjectMap(candidate);
if (result.ok) console.log(result.map.screens.length, "screens");
else result.issues.forEach((i) => console.error(i.message));
```

- `validateProjectMap(raw)` — validate + normalize; returns `{ ok, map, issues }` with error/warning severities.
- `parseProjectMap(raw)` — throwing variant with defaults applied.
- `./audit` subpath — `auditSourceFiles` provenance checks.

Part of the [SketchScreens monorepo](https://github.com/RORHITD/sketchscreens). Most users want the [`sketchscreens` CLI](https://www.npmjs.com/package/sketchscreens) instead.

[MIT](./LICENSE) © [Houston IT Developers](https://houstonitdevelopers.com)
