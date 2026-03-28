import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL = 4 * 60 * 1000; // 4 minutes
const KICK_DELAY = 30_000; // 30 seconds before disconnect
const SESSION_TOKEN_KEY = 'crawlers_session_token';

function getOrCreateSessionToken(): string {
  let token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

export interface AutosaveState {
  workspace_type: string;
  workspace_key: string;
  tracked_site_id?: string;
  state_data: Record<string, unknown>;
}

/**
 * Hook that sends a heartbeat every 4 minutes to enforce fair-use IP limits.
 * If kicked, exposes `isKicked` + `countdown` for the UI overlay.
 */
export function useSessionHeartbeat() {
  const { user, session, signOut } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveRef = useRef<AutosaveState | null>(null);
  const isKickedRef = useRef(false);
  const [isKicked, setIsKicked] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const setAutosaveState = useCallback((state: AutosaveState | null) => {
    autosaveRef.current = state;
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!session?.access_token || isKickedRef.current) return;

    const sessionToken = getOrCreateSessionToken();
    
    try {
      const payload: Record<string, unknown> = { session_token: sessionToken };
      if (autosaveRef.current) {
        payload.autosave = autosaveRef.current;
      }

      await supabase.functions.invoke('session-heartbeat', {
        body: payload,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch (err) {
      console.warn('[Heartbeat] Network error:', err);
    }
  }, [session]);

  const handleKicked = useCallback(() => {
    if (isKickedRef.current) return;
    isKickedRef.current = true;
    setIsKicked(true);
    setCountdown(30);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          signOut().then(() => {
            window.location.href = '/';
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [signOut]);

  const checkKicked = useCallback(async () => {
    if (!user || isKickedRef.current) return;
    
    const sessionToken = getOrCreateSessionToken();
    
    const { data } = await supabase
      .from('user_sessions')
      .select('is_active, kicked_reason')
      .eq('user_id', user.id)
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (data && !data.is_active && data.kicked_reason === 'new_ip_connected') {
      handleKicked();
    }
  }, [user, handleKicked]);

  useEffect(() => {
    if (!user || !session) return;

    sendHeartbeat();

    intervalRef.current = setInterval(() => {
      sendHeartbeat();
      checkKicked();
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, session, sendHeartbeat, checkKicked]);

  return { setAutosaveState, isKicked, countdown };
}
