import { useEffect, useRef, useState, useCallback } from 'react';

const TURNSTILE_SITE_KEY = '0x4AAAAAACpqdiBZvkfSquRp';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptLoaded = false;
let scriptLoading = false;

function loadTurnstileScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (scriptLoaded) { clearInterval(check); resolve(); }
      }, 100);
    });
  }
  scriptLoading = true;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => { scriptLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Turnstile'));
    document.head.appendChild(script);
  });
}

export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetIdRef.current && window.turnstile) {
      try { window.turnstile.reset(widgetIdRef.current); } catch {}
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    loadTurnstileScript().then(() => {
      if (!mounted || !containerRef.current || !window.turnstile) return;
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (!mounted || !containerRef.current || !window.turnstile) return;
        
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t: string) => { if (mounted) setToken(t); },
          'expired-callback': () => { if (mounted) setToken(null); },
          'error-callback': () => { if (mounted) setToken(null); },
          theme: 'auto',
          size: 'flexible',
        });
        setIsReady(true);
      }, 100);
    }).catch(() => {
      // Fail open: if Turnstile can't load, allow form submission
      if (mounted) {
        setToken('TURNSTILE_UNAVAILABLE');
        setIsReady(true);
      }
    });

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
  }, []);

  return { containerRef, token, isReady, reset };
}
