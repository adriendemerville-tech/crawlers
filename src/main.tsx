import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorListener } from "./lib/globalErrorListener";

// Start capturing JS errors before React mounts
initGlobalErrorListener();

// Apply persisted text-size preference before render to avoid flash
try {
  const ts = localStorage.getItem('ui.textSize');
  if (ts === 'small' || ts === 'large') {
    document.documentElement.setAttribute('data-text-size', ts);
  }
} catch { /* ignore */ }

createRoot(document.getElementById("root")!).render(<App />);

// Remove static head tags from index.html that duplicate per-route Helmet tags.
// react-helmet-async marks its injected tags with data-rh; static tags don't have it.
// Duplicate meta description/og:* across every route was flagged as a P0 SEO issue.
const dedupeStaticHead = () => {
  try {
    const selectors = [
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:url"]',
      'meta[property="og:image"]',
      'meta[property="og:type"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:card"]',
    ];
    for (const sel of selectors) {
      const nodes = document.head.querySelectorAll(sel);
      if (nodes.length < 2) continue;
      const helmetOwned = Array.from(nodes).find((n) => n.hasAttribute('data-rh'));
      if (!helmetOwned) continue;
      nodes.forEach((n) => {
        if (!n.hasAttribute('data-rh')) n.remove();
      });
    }
  } catch { /* ignore */ }
};
// Run repeatedly during first seconds (Helmet may mount after lazy Suspense).
const observer = new MutationObserver(dedupeStaticHead);
observer.observe(document.head, { childList: true, subtree: true, attributes: true });
setTimeout(() => observer.disconnect(), 10000);
setTimeout(dedupeStaticHead, 50);

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
