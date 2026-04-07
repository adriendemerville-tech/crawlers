import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';

export interface CrawlQuotaData {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  planLabel: string;
}

export interface TeamCrawlQuota {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  used: number;
  limit: number;
}

export function useCrawlQuota() {
  const { user } = useAuth();
  const { isAgencyPro, planType } = useCredits();
  const { isAdmin } = useAdmin();
  const [quota, setQuota] = useState<CrawlQuotaData | null>(null);
  const [teamQuotas, setTeamQuotas] = useState<TeamCrawlQuota[]>([]);
  const [loading, setLoading] = useState(true);

  const isAgencyPlus = isAdmin || planType === 'agency_premium';
  const fairUseLimit = isAgencyPlus ? 50000 : 5000;

  useEffect(() => {
    if (!user) return;

    async function fetchQuota() {
      setLoading(true);
      try {
        // Fetch own crawl usage
        const { data: profile } = await supabase
          .from('profiles')
          .select('crawl_pages_this_month')
          .eq('user_id', user!.id)
          .single();

        const used = profile?.crawl_pages_this_month || 0;
        const remaining = Math.max(0, fairUseLimit - used);
        const percentUsed = fairUseLimit > 0 ? Math.min(100, (used / fairUseLimit) * 100) : 0;
        const planLabel = isAgencyPlus ? 'Pro Agency+' : isAgencyPro ? 'Pro Agency' : 'Free';

        setQuota({ used, limit: fairUseLimit, remaining, percentUsed, planLabel });

        // Fetch team members' quotas (for owners)
        const { data: teamMembers } = await supabase
          .from('agency_team_members')
          .select('member_user_id')
          .eq('owner_user_id', user!.id);

        if (teamMembers && teamMembers.length > 0) {
          const memberIds = teamMembers.map(m => m.member_user_id);
          const allIds = [user!.id, ...memberIds];

          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, email, first_name, last_name, crawl_pages_this_month, plan_type')
            .in('user_id', allIds);

          if (profiles) {
            const teamData: TeamCrawlQuota[] = profiles.map(p => ({
              userId: p.user_id,
              email: p.email || '',
              firstName: p.first_name || '',
              lastName: p.last_name || '',
              used: p.crawl_pages_this_month || 0,
              limit: (p.plan_type === 'agency_premium') ? 50000 : 5000,
            }));
            setTeamQuotas(teamData);
          }
        } else {
          // Solo user — just show own data
          setTeamQuotas([{
            userId: user!.id,
            email: '',
            firstName: 'Moi',
            lastName: '',
            used,
            limit: fairUseLimit,
          }]);
        }
      } catch (err) {
        console.error('useCrawlQuota error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchQuota();
  }, [user, isAgencyPro, isAgencyPlus, fairUseLimit]);

  const totalTeamUsed = teamQuotas.reduce((sum, t) => sum + t.used, 0);

  return { quota, teamQuotas, totalTeamUsed, loading };
}
