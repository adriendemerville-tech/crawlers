/**
 * Global JS error listener — captures unhandled errors and promise rejections
 * that occur OUTSIDE React's component tree (e.g. async callbacks, third-party scripts).
 * Logs to analytics_events as 'frontend_crash' for CTO visibility.
 */
import { supabase } from '@/integrations/supabase/client';

let isInitialized = false;

export function initGlobalErrorListener() {
  if (isInitialized) return;
  isInitialized = true;

  const logError = async (errorMessage: string, source: string, stack?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('analytics_events').insert({
        event_type: 'frontend_crash',
        user_id: user?.id || null,
        url: window.location.pathname,
        event_data: {
          error_message: errorMessage,
          source,
          stack: stack?.substring(0, 2000),
          route: window.location.pathname,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Silent — never let logging crash the app
    }
  };

  window.addEventListener('error', (event) => {
    // Skip resource loading errors (images, scripts, etc.)
    if (event.target !== window) return;
    logError(event.message, 'window.onerror', event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logError(message, 'unhandledrejection', stack);
  });
}
