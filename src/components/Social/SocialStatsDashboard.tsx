/**
 * Social Stats Dashboard — Aggregated engagement metrics per post and period.
 */
import { memo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Eye, Heart, MessageCircle, Share2, MousePointerClick, RefreshCw, Loader2 } from 'lucide-react';
import { refreshStats } from '@/lib/api/socialHub';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { SIMULATED_SOCIAL_STATS, SIMULATED_PLATFORM_STATS } from '@/data/socialSimulatedData';

interface StatsAgg {
  impressions: number;
  clicks: number;
  likes: number;
  shares: number;
  comments: number;
  posts: number;
}

interface SocialStatsDashboardProps {
  trackedSiteId?: string;
}

export const SocialStatsDashboard = memo(function SocialStatsDashboard({ trackedSiteId }: SocialStatsDashboardProps) {
  const { isDemoMode } = useDemoMode();
  const [stats, setStats] = useState<StatsAgg>({ impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0, posts: 0 });
  const [platformStats, setPlatformStats] = useState<Record<string, StatsAgg>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    if (isDemoMode) {
      setStats(SIMULATED_SOCIAL_STATS);
      setPlatformStats(SIMULATED_PLATFORM_STATS);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase.from('social_posts' as any).select('id').eq('status', 'published');
      if (trackedSiteId) query = query.eq('tracked_site_id', trackedSiteId);
      const { data: posts } = await query;
      const postIds = (posts || []).map((p: any) => p.id);

      if (!postIds.length) { setLoading(false); return; }

      const { data: metrics } = await supabase
        .from('social_post_metrics' as any)
        .select('*')
        .in('post_id', postIds)
        .order('measured_at', { ascending: false });

      const latest = new Map<string, any>();
      for (const m of (metrics || []) as any[]) {
        const key = `${m.post_id}_${m.platform}`;
        if (!latest.has(key)) latest.set(key, m);
      }

      const agg: StatsAgg = { impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0, posts: postIds.length };
      const byPlatform: Record<string, StatsAgg> = {};

      for (const m of latest.values()) {
        agg.impressions += m.impressions || 0;
        agg.clicks += m.clicks || 0;
        agg.likes += m.likes || 0;
        agg.shares += m.shares || 0;
        agg.comments += m.comments || 0;

        if (!byPlatform[m.platform]) byPlatform[m.platform] = { impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0, posts: 0 };
        byPlatform[m.platform].impressions += m.impressions || 0;
        byPlatform[m.platform].clicks += m.clicks || 0;
        byPlatform[m.platform].likes += m.likes || 0;
        byPlatform[m.platform].shares += m.shares || 0;
        byPlatform[m.platform].comments += m.comments || 0;
        byPlatform[m.platform].posts++;
      }

      setStats(agg);
      setPlatformStats(byPlatform);
    } catch (e) { console.error('Stats error:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStats(); }, [trackedSiteId, isDemoMode]);

  const handleRefresh = async () => {
    if (isDemoMode) return;
    setRefreshing(true);
    try {
      await refreshStats();
      await loadStats();
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  const statCards = [
    { label: 'Impressions', value: stats.impressions, icon: Eye, color: 'text-blue-500' },
    { label: 'Clics', value: stats.clicks, icon: MousePointerClick, color: 'text-green-500' },
    { label: 'Likes', value: stats.likes, icon: Heart, color: 'text-pink-500' },
    { label: 'Commentaires', value: stats.comments, icon: MessageCircle, color: 'text-orange-500' },
    { label: 'Partages', value: stats.shares, icon: Share2, color: 'text-purple-500' },
  ];

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Statistiques</CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || isDemoMode}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {statCards.map(s => (
                <div key={s.label} className="text-center p-3 bg-muted/50 rounded-lg">
                  <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                  <p className="text-xl font-bold text-foreground">{s.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {stats.posts} posts publiés
              {Object.keys(platformStats).length > 0 && (
                <span> — {Object.entries(platformStats).map(([p, s]) => `${p}: ${s.impressions} imp.`).join(' · ')}</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});
