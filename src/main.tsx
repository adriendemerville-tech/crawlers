import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorListener } from "./lib/globalErrorListener";

// Start capturing JS errors before React mounts
initGlobalErrorListener();

createRoot(document.getElementById("root")!).render(<App />);

// Load non-critical display fonts after first paint (via <link> to avoid Vite render-blocking CSS chunk)
const loadDeferredFonts = () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/fonts-deferred.css';
  link.media = 'print';
  link.onload = () => { link.media = 'all'; };
  document.head.appendChild(link);
};
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(loadDeferredFonts, { timeout: 2000 });
} else {
  setTimeout(loadDeferredFonts, 100);
}

// Signal to the critical CSS that React has mounted — reveal body
if (typeof window.__markReady === 'function') {
  window.__markReady();
}

declare global {
  interface Window {
    __markReady?: () => void;
  }
}
