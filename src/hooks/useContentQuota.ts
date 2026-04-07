import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';

export interface ContentQuotaData {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  planLabel: string;
}

export interface TeamContentQuota {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  used: number;
  limit: number;
}

const CONTENT_LIMITS: Record<string, number> = {
  free: 5,
  agency_pro: 80,
  agency_premium: 150,
};

export function useContentQuota() {
  const { user } = useAuth();
  const { isAgencyPro, planType } = useCredits();
  const { isAdmin } = useAdmin();
  const [quota, setQuota] = useState<ContentQuotaData | null>(null);
  const [teamQuotas, setTeamQuotas] = useState<TeamContentQuota[]>([]);
  const [loading, setLoading] = useState(true);

  const effectivePlan = isAdmin ? 'agency_premium' : (planType || 'free');
  const fairUseLimit = CONTENT_LIMITS[effectivePlan] || CONTENT_LIMITS.free;

  useEffect(() => {
    if (!user) return;

    async function fetchQuota() {
      setLoading(true);
      try {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(5, 0, 0, 0);
        if (new Date() < monthStart) {
          monthStart.setMonth(monthStart.getMonth() - 1);
        }

        // Count own content creation events this month
        const { count: ownCount } = await supabase
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .eq('event_type', 'fair_use:content_creation')
          .gte('created_at', monthStart.toISOString());

        const used = ownCount || 0;
        const remaining = Math.max(0, fairUseLimit - used);
        const percentUsed = fairUseLimit > 0 ? Math.min(100, (used / fairUseLimit) * 100) : 0;
        const isPlus = isAdmin || planType === 'agency_premium';
        const planLabel = isPlus ? 'Pro Agency+' : isAgencyPro ? 'Pro Agency' : 'Free';

        setQuota({ used, limit: fairUseLimit, remaining, percentUsed, planLabel });

        // Team members
        const { data: teamMembers } = await supabase
          .from('agency_team_members')
          .select('member_user_id')
          .eq('owner_user_id', user!.id);

        const allIds = teamMembers && teamMembers.length > 0
          ? [user!.id, ...teamMembers.map(m => m.member_user_id)]
          : [user!.id];

        // Fetch profiles for names
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, first_name, last_name, plan_type')
          .in('user_id', allIds);

        // Count per user
        const teamData: TeamContentQuota[] = [];
        for (const p of (profiles || [])) {
          const memberPlan = p.plan_type || 'free';
          const memberLimit = CONTENT_LIMITS[memberPlan] || CONTENT_LIMITS.free;

          const { count } = await supabase
            .from('analytics_events')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', p.user_id)
            .eq('event_type', 'fair_use:content_creation')
            .gte('created_at', monthStart.toISOString());

          teamData.push({
            userId: p.user_id,
            email: p.email || '',
            firstName: p.first_name || (p.user_id === user!.id ? 'Moi' : ''),
            lastName: p.last_name || '',
            used: count || 0,
            limit: memberLimit,
          });
        }

        setTeamQuotas(teamData);
      } catch (err) {
        console.error('useContentQuota error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchQuota();
  }, [user, isAgencyPro, effectivePlan, fairUseLimit]);

  const totalTeamUsed = teamQuotas.reduce((sum, t) => sum + t.used, 0);

  return { quota, teamQuotas, totalTeamUsed, loading };
}
