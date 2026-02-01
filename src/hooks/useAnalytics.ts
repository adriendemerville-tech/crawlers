import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

interface TrackEventOptions {
  eventType: string;
  eventData?: Record<string, Json>;
  url?: string;
}

export function useAnalytics() {
  const { user } = useAuth();

  const trackEvent = useCallback(async ({ eventType, eventData = {}, url }: TrackEventOptions) => {
    try {
      // Get or create session ID
      let sessionId = sessionStorage.getItem('analytics_session_id');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem('analytics_session_id', sessionId);
      }

      await supabase.from('analytics_events').insert([{
        event_type: eventType,
        event_data: eventData,
        user_id: user?.id || null,
        session_id: sessionId,
        url: url || window.location.pathname,
      }]);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }, [user]);

  return { trackEvent };
}

// Predefined event types
export const AnalyticsEvents = {
  PAGE_VIEW: 'page_view',
  BUTTON_CLICK: 'button_click',
  SIGNUP_CLICK: 'signup_click',
  SIGNUP_COMPLETE: 'signup_complete',
  URL_TESTED: 'url_tested',
  FEATURE_USED: 'feature_used',
  CONVERSION: 'conversion',
} as const;
