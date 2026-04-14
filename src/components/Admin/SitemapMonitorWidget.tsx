import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Globe, CheckCircle2, AlertCircle, Clock, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SitemapStats {
  totalUrls: number;
  activeUrls: number;
  inactiveUrls: number;
  lastRegenerated: string | null;
  lastSubmittedGsc: string | null;
  pageTypes: Record<string, number>;
  maxLastmod: string | null;
}

export function SitemapMonitorWidget() {
  const [stats, setStats] = useState<SitemapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch sitemap entries stats
      const { data: entries, error } = await supabase
        .from('sitemap_entries')
        .select('is_active, page_type, lastmod')
        .eq('domain', 'crawlers.fr');

      if (error) throw error;

      const active = entries?.filter(e => e.is_active) || [];
      const inactive = entries?.filter(e => !e.is_active) || [];

      // Count by page_type
      const pageTypes: Record<string, number> = {};
      active.forEach(e => {
        const type = (e as any).page_type || 'unknown';
        pageTypes[type] = (pageTypes[type] || 0) + 1;
      });

      const maxLastmod = active.reduce((max, e) => {
        const lm = (e as any).lastmod || '';
        return lm > max ? lm : max;
      }, '');

      // Fetch last regeneration event
      const { data: regenEvent } = await supabase
        .from('analytics_events')
        .select('created_at')
        .eq('event_type', 'sitemap_regenerated')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch last GSC submission event
      const { data: gscEvent } = await supabase
        .from('analytics_events')
        .select('created_at')
        .eq('event_type', 'sitemap_submitted_gsc')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setStats({
        totalUrls: entries?.length || 0,
        activeUrls: active.length,
        inactiveUrls: inactive.length,
        lastRegenerated: regenEvent?.created_at || null,
        lastSubmittedGsc: gscEvent?.created_at || null,
        pageTypes,
        maxLastmod: maxLastmod || null,
      });
    } catch (err) {
      console.error('[SitemapMonitor] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-sitemap', {
        body: { domain: 'crawlers.fr', trigger: 'admin_manual' },
      });
      if (error) throw error;
      toast.success(`Sitemap régénéré : ${data?.urls_count || '?'} URLs`);
      await fetchStats();
    } catch (err) {
      toast.error('Erreur lors de la régénération');
      console.error(err);
    } finally {
      setRegenerating(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Sitemap Monitor
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="h-7 text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${regenerating ? 'animate-spin' : ''}`} />
            Régénérer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL counts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats?.activeUrls || 0}</div>
            <div className="text-[10px] text-muted-foreground">URLs actives</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats?.inactiveUrls || 0}</div>
            <div className="text-[10px] text-muted-foreground">Désactivées</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{stats?.totalUrls || 0}</div>
            <div className="text-[10px] text-muted-foreground">Total</div>
          </div>
        </div>

        {/* Page type breakdown */}
        {stats?.pageTypes && Object.keys(stats.pageTypes).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.pageTypes)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-[10px]">
                  {type}: {count}
                </Badge>
              ))}
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Dernier lastmod :</span>
            <span className="font-mono">{stats?.maxLastmod || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            {stats?.lastRegenerated ? (
              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <AlertCircle className="h-3 w-3 text-orange-500 shrink-0" />
            )}
            <span className="text-muted-foreground">Dernière régénération :</span>
            <span className="font-mono">{formatDate(stats?.lastRegenerated ?? null)}</span>
          </div>
          <div className="flex items-center gap-2">
            {stats?.lastSubmittedGsc ? (
              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-muted-foreground">Soumis à GSC :</span>
            <span className="font-mono">{formatDate(stats?.lastSubmittedGsc ?? null)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
