import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Signal to the critical CSS that React has mounted — reveal body
if (typeof window.__markReady === 'function') {
  window.__markReady();
}

declare global {
  interface Window {
    __markReady?: () => void;
  }
}
