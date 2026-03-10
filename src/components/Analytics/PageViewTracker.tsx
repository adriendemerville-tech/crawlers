import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * Component that tracks page views on route changes.
 * Should be placed inside the Router component.
 * Defers tracking to avoid blocking initial render.
 */
export function PageViewTracker() {
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Defer tracking to avoid blocking LCP
    timeoutRef.current = setTimeout(() => {
      trackEvent('page_view');
    }, 100);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location.pathname, trackEvent]);

  return null;
}
