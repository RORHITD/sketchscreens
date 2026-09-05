import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// This entry owns the whole page (the Vite dev app / the viewer's exported
// HTML), so it — and only it — imports xyflow's stylesheet and the
// html/body/#root reset. The embed entry (embed.tsx) injects its own scoped
// copies instead; see embed.tsx for why.
import "@xyflow/react/dist/style.css";
import "./styles.css";
import "./standalone.css";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
