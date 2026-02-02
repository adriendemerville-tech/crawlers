import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Generate a unique session ID for anonymous tracking
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

export type AnalyticsEventType =
  | 'page_view'
  | 'signup_click'
  | 'signup_complete'
  | 'login_complete'
  | 'report_button_click'
  | 'free_analysis_crawlers'
  | 'free_analysis_geo'
  | 'free_analysis_llm'
  | 'free_analysis_pagespeed'
  | 'expert_audit_launched'
  | 'expert_audit_step_1'
  | 'expert_audit_step_2'
  | 'expert_audit_step_3'
  | 'error';

interface TrackEventOptions {
  targetUrl?: string;
  eventData?: Record<string, unknown>;
}

// Track event via edge function to capture IP
async function trackEventViaEdge(
  eventType: AnalyticsEventType,
  userId: string | null,
  options?: TrackEventOptions
) {
  try {
    const sessionId = getSessionId();
    const currentUrl = window.location.pathname;

    await supabase.functions.invoke('track-analytics', {
      body: {
        event_type: eventType,
        session_id: sessionId,
        url: currentUrl,
        user_id: userId,
        event_data: options?.eventData || {},
        target_url: options?.targetUrl || null,
      },
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

export function useAnalytics() {
  const { user } = useAuth();
  const hasTrackedPageView = useRef(false);

  const trackEvent = useCallback(
    async (eventType: AnalyticsEventType, options?: TrackEventOptions) => {
      await trackEventViaEdge(eventType, user?.id || null, options);
    },
    [user]
  );

  // Track page view on mount
  const trackPageView = useCallback(() => {
    if (!hasTrackedPageView.current) {
      hasTrackedPageView.current = true;
      trackEvent('page_view');
    }
  }, [trackEvent]);

  // Reset page view flag when URL changes
  useEffect(() => {
    hasTrackedPageView.current = false;
  }, []);

  return { trackEvent, trackPageView };
}

// Global tracking function for use outside React components
export async function trackAnalyticsEvent(
  eventType: AnalyticsEventType,
  options?: TrackEventOptions
) {
  const { data: { user } } = await supabase.auth.getUser();
  await trackEventViaEdge(eventType, user?.id || null, options);
}

// Store analyzed URL if new
export async function storeAnalyzedUrl(url: string) {
  try {
    const domain = new URL(url).hostname;
    
    // Upsert - if exists, update last_analyzed_at
    await (supabase.from('analyzed_urls') as any).upsert(
      {
        url,
        domain,
        last_analyzed_at: new Date().toISOString(),
      },
      {
        onConflict: 'url',
        ignoreDuplicates: false,
      }
    );
  } catch (error) {
    console.error('Failed to store analyzed URL:', error);
  }
}
