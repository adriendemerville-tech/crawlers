import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BarChart3, Users, Tag, FileText, Clock, FileWarning, ImageOff, AlertTriangle, Type, RefreshCw, Plug, Globe, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { CmsConnectionDialog } from './CmsConnectionDialog';

interface EditorialStats {
  total_articles: number;
  authors_count: number;
  topics_count: number;
  avg_words: number;
  publishing_frequency_days: number | null;
  short_articles: number;
  long_articles: number;
  missing_image: number;
  missing_meta_desc: number;
  missing_subtitle: number;
  top_topics: { name: string; count: number }[];
  seo_alerts: number;
}

interface ArticleListItem {
  title: string;
  slug: string | null;
  status: string;
  type: 'post' | 'page';
  published_at: string | null;
  url: string | null;
}

interface TrackedSite {
  id: string;
  domain: string;
}

const statCards = (stats: EditorialStats) => [
  { label: 'Articles publiés', value: stats.total_articles, icon: FileText, color: 'text-blue-400' },
  { label: 'Auteurs', value: stats.authors_count, icon: Users, color: 'text-green-400' },
  { label: 'Sujets couverts', value: stats.topics_count, icon: Tag, color: 'text-pink-400' },
  { label: 'Mots / article', value: stats.avg_words, icon: Type, color: 'text-red-400' },
  { label: 'Fréquence entre articles', value: stats.publishing_frequency_days ? `${stats.publishing_frequency_days}j` : '—', icon: Clock, color: 'text-cyan-400' },
  { label: 'Courts (<500 mots)', value: stats.short_articles, icon: FileWarning, color: 'text-blue-400' },
  { label: 'Longs (>1500 mots)', value: stats.long_articles, icon: FileText, color: 'text-blue-400' },
  { label: 'Sans image', value: stats.missing_image, icon: ImageOff, color: 'text-orange-400' },
  { label: 'Sans méta desc.', value: stats.missing_meta_desc, icon: AlertTriangle, color: 'text-yellow-400' },
  { label: 'Sans sous-titre', value: stats.missing_subtitle, icon: AlertTriangle, color: 'text-orange-400' },
];

export function EditorialDashboard({ externalDomain }: { externalDomain?: string | null }) {
  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [stats, setStats] = useState<EditorialStats | null>(null);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cmsDialogOpen, setCmsDialogOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('tracked_sites')
        .select('id, domain')
        .eq('user_id', user.id)
        .order('domain');
      if (data && data.length > 0) {
        setSites(data);
        // If external domain matches a site, select it; otherwise first
        const match = externalDomain ? data.find(s => s.domain === externalDomain) : null;
        setSelectedSiteId(match ? match.id : data[0].id);
      }
    })();
  }, []);

  // Sync with external domain changes
  useEffect(() => {
    if (externalDomain && sites.length > 0) {
      const match = sites.find(s => s.domain === externalDomain);
      if (match) setSelectedSiteId(match.id);
    }
  }, [externalDomain, sites]);

  useEffect(() => {
    if (!selectedSiteId) return;
    fetchStats(selectedSiteId);
  }, [selectedSiteId]);

  const fetchStats = async (siteId: string) => {
    setLoading(true);
    setError(null);
    setStats(null);
    setArticles([]);
    setShowAll(false);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cms-content-stats', {
        body: { tracked_site_id: siteId },
      });

      if (fnErr) throw new Error(fnErr.message);

      if (data?.error === 'no_cms_connection') {
        setError(data.message);
      } else if (data?.stats) {
        setStats(data.stats);
      } else {
        setError('Impossible de récupérer les statistiques.');
      }
    } catch (err: any) {
      console.error('[EditorialDashboard]', err);
      setError(err.message || 'Erreur lors du chargement');
      toast.error('Erreur lors du chargement des stats éditoriales');
    } finally {
      setLoading(false);
    }
  };

  const selectedDomain = sites.find(s => s.id === selectedSiteId)?.domain;

  return (
    <div className="space-y-4">

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Tableau de bord éditorial</CardTitle>
              {selectedDomain && (
                <Badge variant="outline" className="text-[10px]">{selectedDomain}</Badge>
              )}
            </div>
            {selectedSiteId && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => fetchStats(selectedSiteId)}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Analyse du CMS de {selectedDomain}…</span>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500/60" />
              {error}
            </div>
          )}

          {stats && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {statCards(stats).map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-border/40 bg-background/60 p-3 flex items-start gap-2"
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${card.color}`} />
                      <div className="min-w-0">
                        <div className="text-lg font-bold leading-tight">{card.value}</div>
                        <div className="text-[11px] text-muted-foreground leading-tight">{card.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Top sujets :</span>
                  {stats.top_topics.length > 0 ? stats.top_topics.map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-2 py-0.5">
                      {t.name} ({t.count})
                    </Badge>
                  )) : (
                    <span className="text-xs text-muted-foreground/60">Aucun sujet détecté</span>
                  )}
                </div>
                {stats.seo_alerts > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {stats.seo_alerts} alertes SEO
                  </Badge>
                )}
              </div>
            </div>
          )}

          {!loading && !error && !stats && sites.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Ajoutez un site tracké pour voir les statistiques éditoriales.
            </div>
          )}
        </CardContent>
      </Card>

      {/* CMS Connection Dialog */}
      <CmsConnectionDialog open={cmsDialogOpen} onOpenChange={setCmsDialogOpen} cmsType="wordpress" />
    </div>
  );
}
