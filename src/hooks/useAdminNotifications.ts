import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminNotifications {
  intelligence: number;
  silentErrors: number;
  injectionErrors: number;
  support: number;
  apiBilling: number;
  frontendCrashes: number;
}

const EMPTY: AdminNotifications = { intelligence: 0, silentErrors: 0, injectionErrors: 0, support: 0, apiBilling: 0, frontendCrashes: 0 };

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotifications>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [supervisorRes, silentRes, injectionRes, supportRes, billingRes, frontendRes] = await Promise.all([
          supabase
            .from('cto_agent_logs')
            .select('id, created_at')
            .neq('decision', 'no_change')
            .gte('created_at', sevenDaysAgo),
          supabase
            .from('analytics_events')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'silent_error')
            .gte('created_at', sevenDaysAgo),
          supabase
            .from('analytics_events')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'injection_error')
            .gte('created_at', sevenDaysAgo),
          supabase
            .from('analytics_events')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'support_ticket')
            .gte('created_at', thirtyDaysAgo),
          // API billing alerts (last 7 days)
          supabase
            .from('analytics_events')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'api_billing_alert')
            .gte('created_at', sevenDaysAgo),
          // Frontend crashes (last 7 days)
          supabase
            .from('analytics_events')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'frontend_crash')
            .gte('created_at', sevenDaysAgo),
        ]);

        if (cancelled) return;

        // For supervisor, cross-reference with errors
        let supervisorCount = 0;
        const changes = supervisorRes.data || [];
        if (changes.length > 0) {
          const errorsRes = await supabase
            .from('analytics_events')
            .select('id, created_at')
            .in('event_type', ['edge_function_error', 'injection_error'])
            .gte('created_at', sevenDaysAgo);
          
          const errors = errorsRes.data || [];
          for (const change of changes) {
            const changeTime = new Date(change.created_at).getTime();
            const windowEnd = changeTime + 48 * 60 * 60 * 1000;
            const hasRelated = errors.some(e => {
              const t = new Date(e.created_at).getTime();
              return t >= changeTime && t <= windowEnd;
            });
            if (hasRelated) supervisorCount++;
          }
        }

        if (cancelled) return;

        setNotifications({
          intelligence: supervisorCount,
          silentErrors: silentRes.count || 0,
          injectionErrors: injectionRes.count || 0,
          support: supportRes.count || 0,
          apiBilling: billingRes.count || 0,
          frontendCrashes: frontendRes.count || 0,
        });
      } catch (err) {
        console.error('Admin notifications fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    // Refresh every 5 minutes
    const interval = setInterval(fetch, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { notifications, loading };
}
