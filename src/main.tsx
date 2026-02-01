import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Extra diagnostics to avoid silent white screens on boot.
// eslint-disable-next-line no-console
window.addEventListener("error", (e) => console.error("[window.error]", e.error ?? e));
// eslint-disable-next-line no-console
window.addEventListener("unhandledrejection", (e) => console.error("[unhandledrejection]", e.reason));

createRoot(document.getElementById("root")!).render(<App />);
