import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const HEARTBEAT_INTERVAL = 4 * 60 * 1000; // 4 minutes
const SESSION_TOKEN_KEY = 'crawlers_session_token';

function getOrCreateSessionToken(): string {
  let token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

interface AutosaveState {
  workspace_type: string;
  workspace_key: string;
  tracked_site_id?: string;
  state_data: Record<string, unknown>;
}

/**
 * Hook that sends a heartbeat every 4 minutes to enforce fair-use IP limits.
 * If kicked by a new session, shows a toast and signs the user out.
 * Supports auto-saving workspace state on each heartbeat.
 */
export function useSessionHeartbeat() {
  const { user, session, signOut } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveRef = useRef<AutosaveState | null>(null);
  const isKickedRef = useRef(false);

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

      const { data, error } = await supabase.functions.invoke('session-heartbeat', {
        body: payload,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        console.warn('[Heartbeat] Error:', error.message);
        return;
      }

      // Check if this session was kicked
      if (data && data.active === false) {
        return;
      }
    } catch (err) {
      console.warn('[Heartbeat] Network error:', err);
    }
  }, [session]);

  // Check if we've been kicked (poll our own session status)
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
      isKickedRef.current = true;
      toast.error('Session déconnectée', {
        description: 'Une connexion depuis un autre appareil a pris le relais. Votre travail a été sauvegardé.',
        duration: 10000,
      });
      // Give time for the toast to show
      setTimeout(() => signOut(), 3000);
    }
  }, [user, signOut]);

  useEffect(() => {
    if (!user || !session) return;

    // Initial heartbeat
    sendHeartbeat();

    // Set up interval
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

  return { setAutosaveState };
}
