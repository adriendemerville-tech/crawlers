import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scroll to top on route change (except for hash links)
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Don't scroll if there's a hash (anchor link)
    if (hash) {
      // Guard: ignore OAuth/auth tokens or anything that's not a plain anchor selector
      const isValidAnchor = /^#[A-Za-z][\w-]*$/.test(hash);
      if (isValidAnchor) {
        try {
          const element = document.querySelector(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        } catch {
          // Invalid selector — ignore
        }
      }
      return;
    }

    
    // Scroll to top on route change
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}
