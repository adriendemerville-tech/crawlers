import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * Component that tracks page views on route changes.
 * Should be placed inside the Router component.
 */
export function PageViewTracker() {
  const location = useLocation();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    // Track page view on every route change
    trackEvent('page_view');
  }, [location.pathname, trackEvent]);

  return null;
}
