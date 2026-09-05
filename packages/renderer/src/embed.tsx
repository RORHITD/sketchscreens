import { useLayoutEffect, useState, type MutableRefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReactFlowProvider } from "@xyflow/react";
import { validateProjectMap, type ProjectMapT, type ScreenSpecT } from "@sketchscreens/core-schema";
import { Canvas, type CanvasApi, type ScreenAction } from "./App";

// Raw-text CSS imports: no <link>, no separate CSS asset — the whole point of
// the embed build is ONE self-contained .js file that a plain-JS page can
// drop in behind a strict same-origin-scripts CSP. Both stylesheets are
// already fully scoped (xyflow's under `.react-flow*` classes; ours under
// `.ss-scope` — see styles.css), so they're safe to inject into the host
// document's <head> verbatim; nothing here can restyle the rest of the page.
import xyflowCss from "@xyflow/react/dist/style.css?raw";
import appCss from "./styles.css?raw";

/** One host-supplied action button, shown at the top of the DetailPanel. */
export type MountAction = ScreenAction;

export interface MountOpts {
  /** Hide the "SketchScreens" brand/logo and the map name from the top bar.
   * Search, section chips, screen count, and Export PNG stay. */
  chromeless?: boolean;
  /** 'light' (default, today's look) or a genuinely dark-readable 'dark'. */
  theme?: "light" | "dark";
  /** Fires on every selection change, including deselect (-> null). */
  onSelect?: (screen: ScreenSpecT | null) => void;
  /** Buttons rendered at the top of the DetailPanel for the selected screen,
   * replacing the vscode:// Source link (sourceFile still shows as text). */
  actions?: MountAction[];
}

export interface Handle {
  /** Unmounts React, disconnects observers, and removes the mount node. */
  destroy(): void;
  /** Programmatically select (or, with null, deselect) a screen by id. */
  select(id: string | null): void;
  /** Re-fit the view to the whole graph. */
  fit(): void;
  /** Swap in a new map (validated the same way mount() validates). */
  update(map: unknown): void;
}

function validate(raw: unknown): ProjectMapT {
  const result = validateProjectMap(raw);
  if (!result.ok || !result.map) {
    const detail = result.issues.map((i) => `  - ${i.message}`).join("\n");
    throw new Error(`SketchScreens: invalid ProjectMap:\n${detail}`);
  }
  return result.map;
}

// Injected once per page, shared by every mount() call — the CSS is static
// and scoped, so there is nothing to gain from re-injecting it per instance.
let cssInjected = false;
function ensureCss() {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-sketchscreens-embed", "");
  style.textContent = `${xyflowCss}\n${appCss}`;
  document.head.appendChild(style);
}

function EmbedRoot({
  initialMap,
  chromeless,
  theme,
  onSelect,
  actions,
  apiRef,
  setMapRef,
}: {
  initialMap: ProjectMapT;
  chromeless: boolean;
  theme: "light" | "dark";
  onSelect?: (screen: ScreenSpecT | null) => void;
  actions?: MountAction[];
  apiRef: MutableRefObject<CanvasApi | null>;
  setMapRef: MutableRefObject<((map: ProjectMapT) => void) | null>;
}) {
  const [map, setMap] = useState(initialMap);

  // Exposed synchronously (useLayoutEffect flushes as part of the initial
  // createRoot().render() call) so Handle.update() works the instant mount()
  // returns.
  useLayoutEffect(() => {
    setMapRef.current = setMap;
    return () => {
      setMapRef.current = null;
    };
  }, [setMapRef]);

  return (
    <div
      className="ss-scope"
      data-theme={theme}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
    >
      <ReactFlowProvider>
        <Canvas map={map} chromeless={chromeless} actions={actions} onSelect={onSelect} apiRef={apiRef} />
      </ReactFlowProvider>
    </div>
  );
}

/**
 * Mount an interactive SketchScreens canvas into `el`. Safe to call more than
 * once on a page — each mount gets its own React root and DOM subtree, and
 * `destroy()` tears down exactly (and only) that instance.
 */
function mount(el: HTMLElement, map: unknown, opts: MountOpts = {}): Handle {
  ensureCss();
  const validated = validate(map);
  const theme: "light" | "dark" = opts.theme === "dark" ? "dark" : "light";

  // This node is `el`'s only child; EmbedRoot's own `.ss-scope` div (with the
  // real background/color/theme) renders INSIDE it. It needs an explicit
  // height itself — `.ss-scope`'s `height: 100%` can't resolve against a
  // height:auto parent — so the percentage-height chain reaches all the way
  // down to `el` (which the host is expected to size).
  const wrapper = document.createElement("div");
  wrapper.style.width = "100%";
  wrapper.style.height = "100%";
  el.appendChild(wrapper);

  const apiRef: MutableRefObject<CanvasApi | null> = { current: null };
  const setMapRef: MutableRefObject<((m: ProjectMapT) => void) | null> = { current: null };

  const root: Root = createRoot(wrapper);
  root.render(
    <EmbedRoot
      initialMap={validated}
      chromeless={!!opts.chromeless}
      theme={theme}
      onSelect={opts.onSelect}
      actions={opts.actions}
      apiRef={apiRef}
      setMapRef={setMapRef}
    />,
  );

  return {
    destroy() {
      root.unmount(); // runs every effect cleanup: ResizeObservers, listeners.
      wrapper.remove();
    },
    select(id) {
      apiRef.current?.select(id);
    },
    fit() {
      apiRef.current?.fit();
    },
    update(nextMap) {
      const validatedNext = validate(nextMap);
      if (!setMapRef.current) {
        throw new Error("SketchScreens: update() called before mount() finished.");
      }
      setMapRef.current(validatedNext);
    },
  };
}

// `mount` is the module's only export; Vite's IIFE lib build assigns it onto
// `window.SketchScreens.mount` (see vite.embed.config.ts, build.lib.name).
export { mount };
