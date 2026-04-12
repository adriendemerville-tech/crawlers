import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorListener } from "./lib/globalErrorListener";

// Start capturing JS errors before React mounts
initGlobalErrorListener();

createRoot(document.getElementById("root")!).render(<App />);

// Load non-critical display fonts after first paint
requestIdleCallback(() => {
  import('./fonts-deferred.css');
}, { timeout: 2000 });

// Signal to the critical CSS that React has mounted — reveal body
if (typeof window.__markReady === 'function') {
  window.__markReady();
}

declare global {
  interface Window {
    __markReady?: () => void;
  }
}
