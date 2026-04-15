import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, ExternalLink, Search, Globe, Brain, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface CompetitorUrl {
  id: string;
  competitor_url: string;
  competitor_domain: string;
  label: string | null;
  crawl_status: string;
  last_crawl_at: string | null;
  seo_score: number | null;
  geo_score: number | null;
  serp_positions: any;
  semantic_relevance: any;
  crawl_data: any;
  audit_data: any;
}

interface Props {
  trackedSiteId: string;
  domain: string;
  userId: string;
  language: string;
}

const t3 = (lang: string, fr: string, en: string) => lang === 'fr' ? fr : en;

export function CompetitorTrackingTab({ trackedSiteId, domain, userId, language }: Props) {
  const navigate = useNavigate();
  const [competitors, setCompetitors] = useState<CompetitorUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const fetchCompetitors = useCallback(async () => {
    const { data } = await supabase
      .from('competitor_tracked_urls')
      .select('*')
      .eq('tracked_site_id', trackedSiteId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    setCompetitors((data as any[]) || []);
    setLoading(false);
  }, [trackedSiteId, userId]);

  useEffect(() => { fetchCompetitors(); }, [fetchCompetitors]);

  const normalizeUrl = (url: string): string => {
    let u = url.trim();
    if (!u.startsWith('http')) u = 'https://' + u;
    try { return new URL(u).href; } catch { return ''; }
  };

  const extractDomain = (url: string): string => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  };

  const handleAdd = async () => {
    const normalized = normalizeUrl(newUrl);
    if (!normalized) { toast.error(t3(language, 'URL invalide', 'Invalid URL')); return; }
    const compDomain = extractDomain(normalized);
    if (compDomain === domain.replace(/^www\./, '')) {
      toast.error(t3(language, 'Vous ne pouvez pas tracker votre propre domaine', 'You cannot track your own domain'));
      return;
    }
    if (competitors.length >= 3) {
      toast.error(t3(language, 'Maximum 3 concurrents par site', 'Maximum 3 competitors per site'));
      return;
    }
    if (competitors.some(c => c.competitor_url === normalized || c.competitor_domain === compDomain)) {
      toast.error(t3(language, 'Ce concurrent est déjà suivi', 'This competitor is already tracked'));
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from('competitor_tracked_urls').insert({
        user_id: userId,
        tracked_site_id: trackedSiteId,
        competitor_url: normalized,
        competitor_domain: compDomain,
        crawl_status: 'pending',
      } as any);
      if (error) throw error;

      toast.success(t3(language, 'Concurrent ajouté — crawl en cours…', 'Competitor added — crawling…'));
      setNewUrl('');
      setShowAddModal(false);
      await fetchCompetitors();

      // Trigger background crawl + audit
      supabase.functions.invoke('audit-competitor-url', {
        body: { competitorUrl: normalized, competitorDomain: compDomain, trackedSiteId, referenceDomain: domain },
      }).catch(e => console.warn('Competitor audit trigger failed:', e));

    } catch (e: any) {
      toast.error(e.message || 'Error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('competitor_tracked_urls').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(t3(language, 'Concurrent retiré', 'Competitor removed'));
    setCompetitors(prev => prev.filter(c => c.id !== id));
  };

  const handleRefresh = async (comp: CompetitorUrl) => {
    setRefreshingId(comp.id);
    try {
      await supabase.from('competitor_tracked_urls').update({ crawl_status: 'pending' } as any).eq('id', comp.id);
      await supabase.functions.invoke('audit-competitor-url', {
        body: { competitorUrl: comp.competitor_url, competitorDomain: comp.competitor_domain, trackedSiteId, referenceDomain: domain },
      });
      toast.success(t3(language, 'Mise à jour lancée', 'Refresh started'));
      await fetchCompetitors();
    } catch {
      toast.error(t3(language, 'Erreur lors de la mise à jour', 'Refresh error'));
    } finally {
      setRefreshingId(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: t3(language, 'En attente', 'Pending'), variant: 'outline' },
      crawling: { label: t3(language, 'Crawl…', 'Crawling…'), variant: 'secondary' },
      done: { label: t3(language, 'Terminé', 'Done'), variant: 'default' },
      error: { label: t3(language, 'Erreur', 'Error'), variant: 'destructive' },
    };
    const s = map[status] || map.pending;
    return <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>;
  };

  const scoreColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t3(language,
            `Suivez jusqu'à 3 URLs concurrentes : positions SERP, pertinence sémantique, scores SEO & GEO.`,
            `Track up to 3 competitor URLs: SERP positions, semantic relevance, SEO & GEO scores.`
          )}
        </p>
        {competitors.length < 3 && (
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setShowAddModal(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t3(language, 'Ajouter', 'Add')}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {competitors.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t3(language, 'Aucun concurrent suivi', 'No competitors tracked')}</p>
          <Button variant="outline" className="mt-3 gap-2" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            {t3(language, 'Ajouter un concurrent', 'Add a competitor')}
          </Button>
        </div>
      )}

      {/* Competitor cards */}
      {competitors.map(comp => {
        const serpPositions = Array.isArray(comp.serp_positions) ? comp.serp_positions : [];
        const semRelevance = comp.semantic_relevance || {};
        const isRefreshing = refreshingId === comp.id || comp.crawl_status === 'crawling';

        return (
          <Card key={comp.id} className="border">
            <CardContent className="p-4 space-y-3">
              {/* Row 1: URL + actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <a href={comp.competitor_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:underline truncate">
                    {comp.competitor_domain}
                  </a>
                  <a href={comp.competitor_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {statusBadge(comp.crawl_status)}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Audit button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                    onClick={() => navigate(`/audit-expert?url=${encodeURIComponent(comp.competitor_url)}`)}
                  >
                    {t3(language, 'Auditer', 'Audit')}
                  </Button>
                  {/* UX button */}
                  {comp.crawl_status === 'done' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => navigate(`/app/conversion-optimizer?url=${encodeURIComponent(comp.competitor_url)}`)}
                    >
                      UX
                    </Button>
                  )}
                  {/* Refresh */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={isRefreshing}
                    onClick={() => handleRefresh(comp)}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                  </Button>
                  {/* Remove */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(comp.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Row 2: Scores */}
              {comp.crawl_status === 'done' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <Search className="h-3 w-3" />
                      <span>Score SEO</span>
                    </div>
                    <p className={cn("text-sm font-semibold", scoreColor(comp.seo_score))}>
                      {comp.seo_score != null ? `${comp.seo_score}%` : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <Globe className="h-3 w-3" />
                      <span>Score GEO</span>
                    </div>
                    <p className={cn("text-sm font-semibold", scoreColor(comp.geo_score))}>
                      {comp.geo_score != null ? `${comp.geo_score}%` : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <Brain className="h-3 w-3" />
                      <span>{t3(language, 'Pertinence', 'Relevance')}</span>
                    </div>
                    <p className={cn("text-sm font-semibold", scoreColor(semRelevance?.score ?? null))}>
                      {semRelevance?.score != null ? `${Math.round(semRelevance.score)}%` : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <Search className="h-3 w-3" />
                      <span>{t3(language, 'Positions SERP', 'SERP Positions')}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {serpPositions.length > 0
                        ? `${serpPositions.filter((p: any) => p.position <= 10).length} top 10`
                        : '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Row 3: SERP details */}
              {comp.crawl_status === 'done' && serpPositions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t3(language, 'Mots-clés surveillés', 'Tracked keywords')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {serpPositions.slice(0, 10).map((kw: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] gap-1">
                        <span className="truncate max-w-[120px]">{kw.keyword}</span>
                        <span className={cn(
                          "font-bold",
                          kw.position <= 3 ? 'text-green-600' : kw.position <= 10 ? 'text-amber-600' : 'text-red-500'
                        )}>
                          #{kw.position}
                        </span>
                      </Badge>
                    ))}
                    {serpPositions.length > 10 && (
                      <Badge variant="outline" className="text-[10px]">+{serpPositions.length - 10}</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Crawling state */}
              {(comp.crawl_status === 'pending' || comp.crawl_status === 'crawling') && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t3(language, 'Analyse en cours — les résultats apparaîtront ici automatiquement.', 'Analysis in progress — results will appear here automatically.')}
                </div>
              )}

              {/* Error state */}
              {comp.crawl_status === 'error' && (
                <div className="flex items-center gap-2 text-xs text-destructive py-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t3(language, 'Erreur lors de l\'analyse. Relancez avec le bouton de rafraîchissement.', 'Analysis error. Retry with the refresh button.')}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Add modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t3(language, 'Ajouter un concurrent', 'Add a competitor')}</DialogTitle>
            <DialogDescription>
              {t3(language,
                'Entrez l\'URL d\'un concurrent. Un crawl et un audit SEO/GEO seront lancés automatiquement.',
                'Enter a competitor URL. A crawl and SEO/GEO audit will start automatically.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://concurrent.com"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={adding || !newUrl.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : t3(language, 'Ajouter', 'Add')}
            </Button>
          </div>
          <DialogClose />
        </DialogContent>
      </Dialog>
    </div>
  );
}
