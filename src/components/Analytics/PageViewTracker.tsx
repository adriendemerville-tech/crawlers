import { useEffect, useRef } from 'react';
import { useLocation } from '@/lib/router-compat';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * Component that tracks page views on route changes.
 * Should be placed inside the Router component.
 * Defers tracking to avoid blocking initial render.
 */
export function PageViewTracker() {
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Defer tracking to avoid blocking LCP
    timeoutRef.current = setTimeout(() => {
      trackEvent('page_view');
      // GA4 (via GTM) : le SPA ne déclenche pas de page_view natif, on le pousse explicitement
      try {
        const w = window as unknown as { dataLayer?: unknown[] };
        w.dataLayer = w.dataLayer || [];
        w.dataLayer.push({
          event: 'spa_page_view',
          page_path: location.pathname + location.search,
          page_location: window.location.href,
          page_title: document.title,
        });
        // Secours : si GTM est absent (bloqueur, tag GA4 défaillant), on envoie
        // la page vue SPA directement à GA4 via gtag.js (chargé par le fallback).
        const gtmLoaded = !!(window as unknown as { google_tag_manager?: Record<string, unknown> })
          .google_tag_manager?.['GTM-TDGHZZ49'];
        const directGtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
        if (!gtmLoaded && typeof directGtag === 'function') {
          directGtag('event', 'page_view', {
            page_path: location.pathname + location.search,
            page_location: window.location.href,
            page_title: document.title,
            send_to: 'G-0S0D56VSWQ',
          });
        }
      } catch {
        /* noop */
      }
    }, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location.pathname, location.search, trackEvent]);

  return null;
}
