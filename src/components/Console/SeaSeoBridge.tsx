import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, Search, Target, Send, Unplug, Link as LinkIcon, Info, BarChart3, TrendingUp, Globe, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { SIMULATED_OPPORTUNITIES, SIMULATED_SUMMARY, type SimulatedOpportunity } from '@/data/seaSeoSimulatedData';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Opportunity {
  keyword: string;
  sea_clicks: number;
  sea_cpc: number;
  sea_conversions: number;
  sea_cost: number;
  sea_campaign: string;
  organic_position: number | null;
  organic_clicks: number;
  organic_impressions: number;
  has_cocoon_gap: boolean;
  cocoon_gap_id: string | null;
  opportunity_score: number;
  opportunity_type: 'no_organic' | 'low_organic' | 'high_potential' | 'cannibalisation_risk';
  monthly_savings_potential: number;
  serp_volume?: number;
  serp_difficulty?: number;
  serp_competition?: number;
  serp_cpc_market?: number;
}

interface Summary {
  total_keywords: number;
  total_sea_cost_eur: number;
  potential_monthly_savings_eur: number;
  no_organic_count: number;
  cannibalisation_count: number;
  cocoon_aligned_count: number;
  data_source: 'live' | 'simulated';
}

interface SeaSeoBridgeProps {
  domain: string;
  trackedSiteId: string;
}

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'es' ? es : lang === 'en' ? en : fr;

const typeLabels: Record<string, { label: string; description: string }> = {
  no_organic: {
    label: 'Sans présence SEO',
    description: 'Ce mot-clé génère du trafic payant mais n\'a aucune position organique. Créer du contenu SEO permettrait de capter ce trafic gratuitement.',
  },
  low_organic: {
    label: 'SEO faible',
    description: 'Vous êtes positionné au-delà de la page 1 en organique. Optimiser le contenu existant pourrait réduire la dépendance au SEA.',
  },
  high_potential: {
    label: 'Fort potentiel',
    description: 'La position organique est correcte et le mot-clé convertit bien en SEA. Renforcer le SEO pourrait amplifier les résultats.',
  },
  cannibalisation_risk: {
    label: 'Cannibalisation',
    description: 'Vous payez du trafic SEA pour un mot-clé où vous êtes déjà bien positionné en organique. Réduire le budget SEA est envisageable.',
  },
};

export function SeaSeoBridge({ domain, trackedSiteId }: SeaSeoBridgeProps) {
  const { language } = useLanguage();
  const { isDemoMode } = useDemoMode();
  const [loading, setLoading] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<string | null>(null);
  const [adsConnected, setAdsConnected] = useState<boolean | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: ads } = await (supabase as any)
        .from('google_ads_connections_public')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setAdsConnected(!!ads);
    };
    check();
  }, []);

  useEffect(() => {
    if (isDemoMode && !adsConnected && !summary) {
      setSummary(SIMULATED_SUMMARY);
      setOpportunities(SIMULATED_OPPORTUNITIES as Opportunity[]);
    }
  }, [isDemoMode, adsConnected, summary]);

  const analyze = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('sea-seo-bridge', {
        body: { action: 'analyze', user_id: user.id, domain, tracked_site_id: trackedSiteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSummary(data.summary);
      setOpportunities(data.opportunities || []);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('SEA→SEO analysis error:', err);
      toast.error(err.message || 'Erreur lors de l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  const injectSelected = async () => {
    if (selectedIds.size === 0) {
      toast.warning('Sélectionnez au moins une opportunité');
      return;
    }
    if (summary?.data_source === 'simulated') {
      toast.info('Les données simulées ne peuvent pas être injectées dans le workbench.');
      return;
    }
    setInjecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const selected = Array.from(selectedIds).map(i => opportunities[i]);
      const { data, error } = await supabase.functions.invoke('sea-seo-bridge', {
        body: {
          action: 'inject_workbench',
          user_id: user.id,
          domain,
          tracked_site_id: trackedSiteId,
          opportunity_ids: selected,
        },
      });
      if (error) throw error;
      toast.success(`${data?.injected_count || 0} opportunités injectées dans le workbench`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur d\'injection');
    } finally {
      setInjecting(false);
    }
  };

  const disconnectAds = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('google-ads-connector', {
        body: { action: 'disconnect' },
      });
      if (error) throw error;
      setAdsConnected(false);
      setSummary(null);
      setOpportunities([]);
      toast.success(t3(language, 'Google Ads déconnecté', 'Google Ads disconnected', 'Google Ads desconectado'));
    } catch (err: any) {
      toast.error(err.message || 'Erreur de déconnexion');
    } finally {
      setDisconnecting(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    const filtered = filteredOpportunities;
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((_, i) => opportunities.indexOf(filtered[i]))));
    }
  };

  const filteredOpportunities = filterType
    ? opportunities.filter(o => o.opportunity_type === filterType)
    : opportunities;

  const getDifficultyLabel = (d: number) =>
    d >= 70 ? 'Élevée' : d >= 40 ? 'Moyenne' : 'Faible';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            SEA → SEO Bridge
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t3(language,
              'Identifiez les mots-clés payants que vous pourriez capter en SEO pour réduire vos coûts publicitaires.',
              'Identify paid keywords you could capture organically to reduce ad spend.',
              'Identifique palabras clave pagas que podría capturar orgánicamente.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {adsConnected && (
            <Button variant="outline" size="sm" onClick={disconnectAds} disabled={disconnecting} className="text-muted-foreground border-border/50 hover:bg-muted/50">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unplug className="h-4 w-4 mr-1" />}
              Déconnecter
            </Button>
          )}
          <Button onClick={analyze} disabled={loading || (!adsConnected && !isDemoMode)} size="sm" variant="outline" className="border-border/50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            {loading ? 'Analyse…' : 'Analyser'}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-border/40 rounded-lg p-4">
              <div className="text-2xl font-bold">{summary.total_keywords}</div>
              <div className="text-xs text-muted-foreground">Mots-clés analysés</div>
            </div>
            <div className="border border-border/40 rounded-lg p-4">
              <div className="text-2xl font-bold">{summary.total_sea_cost_eur.toFixed(0)}€</div>
              <div className="text-xs text-muted-foreground">Budget SEA / 30j</div>
            </div>
            <div className="border border-border/40 rounded-lg p-4">
              <div className="text-2xl font-bold text-emerald-500">{summary.potential_monthly_savings_eur.toFixed(0)}€</div>
              <div className="text-xs text-muted-foreground">Économie potentielle / mois</div>
            </div>
            <div className="border border-border/40 rounded-lg p-4">
              <div className="text-2xl font-bold">{summary.cocoon_aligned_count}</div>
              <div className="text-xs text-muted-foreground">Alignés gaps Cocoon</div>
            </div>
          </div>

          {summary.data_source === 'simulated' && (
            <div className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Données simulées — Connectez Google Ads pour des résultats réels
            </div>
          )}
        </>
      )}

      {/* Legend */}
      {opportunities.length > 0 && (
        <div className="border border-border/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Info className="h-4 w-4" />
            Comment lire ce tableau
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="w-8 h-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">92</span>
              <span><strong className="text-foreground">Score d'opportunité</strong> — De 0 à 100, mesure le potentiel d'économie en remplaçant le trafic payant par du trafic organique. Plus il est élevé, plus l'action SEO est rentable.</span>
            </div>
            <div className="flex items-start gap-2">
              <BarChart3 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong className="text-foreground">Vol. SERP</strong> — Volume de recherche mensuel estimé (DataForSEO). Indique la taille du marché disponible en organique.</span>
            </div>
            <div className="flex items-start gap-2">
              <Globe className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong className="text-foreground">KD%</strong> — Keyword Difficulty. Estime la difficulté de se positionner en page 1 pour ce mot-clé.</span>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong className="text-foreground">Économie</strong> — Réduction estimée du budget SEA si vous captez ce trafic en organique.</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter pills + actions */}
      {opportunities.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={filterType === null ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilterType(null)}
            >
              Tous ({opportunities.length})
            </Button>
            {Object.entries(typeLabels).map(([type, cfg]) => {
              const count = opportunities.filter(o => o.opportunity_type === type).length;
              if (count === 0) return null;
              return (
                <TooltipProvider key={type}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={filterType === type ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setFilterType(filterType === type ? null : type)}
                      >
                        {cfg.label} ({count})
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {cfg.description}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>
              {selectedIds.size === filteredOpportunities.length ? 'Désélectionner' : 'Tout sélectionner'}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              disabled={selectedIds.size === 0 || injecting || summary?.data_source === 'simulated'}
              onClick={injectSelected}
            >
              {injecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Injecter {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
          </div>
        </div>
      )}

      {/* Table header */}
      {filteredOpportunities.length > 0 && (
        <div className="hidden md:grid grid-cols-[40px_44px_1fr_90px_90px_70px_100px_100px_32px] gap-2 items-center px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium border-b border-border/20">
          <div></div>
          <div className="flex items-center gap-0.5">
            Score
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground/40 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[280px] leading-relaxed">
                  <p className="font-semibold mb-1">Score d'opportunité (0-100)</p>
                  <p>Mesure l'intérêt de basculer un mot-clé payant vers le SEO naturel :</p>
                  <ul className="mt-1 space-y-0.5 list-disc pl-3">
                    <li><strong>90-100</strong> — Aucune présence organique, fort trafic SEA</li>
                    <li><strong>60-90</strong> — Position organique faible (&gt;10), marge de progression</li>
                    <li><strong>50-70</strong> — Haut potentiel de conversion</li>
                    <li><strong>40-70</strong> — Cannibalisation (déjà top 5 + SEA actif)</li>
                  </ul>
                  <p className="mt-1">+15 pts si aligné avec un gap du cocon sémantique.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div>Mot-clé</div>
          <div className="text-right">CPC SEA</div>
          <div className="text-right">Clics SEA</div>
          <div className="text-right">Pos. SEO</div>
          <div className="text-right">Vol. SERP</div>
          <div className="text-right">Économie</div>
          <div></div>
        </div>
      )}

      {/* Opportunities list */}
      {filteredOpportunities.length > 0 && (
        <div className="space-y-1">
          {filteredOpportunities.map((opp, idx) => {
            const realIdx = opportunities.indexOf(opp);
            const isSelected = selectedIds.has(realIdx);
            const isExpanded = expandedIdx === realIdx;
            const typeInfo = typeLabels[opp.opportunity_type] || typeLabels.high_potential;

            return (
              <div key={realIdx} className="group">
                {/* Main row */}
                <div
                  className={cn(
                    'grid grid-cols-[40px_44px_1fr_90px_90px_70px_100px_100px_32px] gap-2 items-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/5 border border-primary/20' : 'border border-transparent hover:bg-muted/30'
                  )}
                  onClick={() => toggleSelect(realIdx)}
                >
                  {/* Checkbox */}
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                    isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/20'
                  )}>
                    {isSelected && <span className="text-[10px]">✓</span>}
                  </div>

                  {/* Score */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          'w-9 h-9 rounded flex items-center justify-center text-sm font-bold shrink-0 tabular-nums',
                          opp.opportunity_score >= 85 ? 'bg-foreground/10 text-foreground' :
                          opp.opportunity_score >= 65 ? 'bg-muted text-muted-foreground' :
                          'bg-muted/50 text-muted-foreground/70'
                        )}>
                          {opp.opportunity_score}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs max-w-[200px]">
                        Score d'opportunité SEO. Plus il est élevé, plus le potentiel d'économie est important.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Keyword + type */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{opp.keyword}</span>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">{typeInfo.label}</span>
                      {opp.has_cocoon_gap && (
                        <span className="text-[10px] text-emerald-500/70 shrink-0">Cocoon ✓</span>
                      )}
                    </div>
                  </div>

                  {/* CPC SEA */}
                  <div className="text-right text-sm tabular-nums">{opp.sea_cpc.toFixed(2)}€</div>

                  {/* Clics SEA */}
                  <div className="text-right text-sm tabular-nums text-muted-foreground">{opp.sea_clicks}</div>

                  {/* Pos SEO */}
                  <div className="text-right text-sm tabular-nums">
                    {opp.organic_position ? opp.organic_position.toFixed(0) : <span className="text-muted-foreground/30">—</span>}
                  </div>

                  {/* Vol. SERP */}
                  <div className="text-right text-sm tabular-nums">
                    {opp.serp_volume ? opp.serp_volume.toLocaleString('fr-FR') : <span className="text-muted-foreground/30">—</span>}
                  </div>

                  {/* Économie */}
                  <div className="text-right text-sm tabular-nums text-emerald-500 font-medium">
                    -{opp.monthly_savings_potential.toFixed(0)}€<span className="text-muted-foreground/40 font-normal">/m</span>
                  </div>

                  {/* Expand */}
                  <button
                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedIdx(isExpanded ? null : realIdx);
                    }}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="ml-[84px] mr-8 py-3 px-4 mb-2 border border-border/20 rounded-lg bg-muted/10 text-xs space-y-3">
                    <p className="text-muted-foreground">{typeInfo.description}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-muted-foreground/60 mb-0.5">Campagne SEA</div>
                        <div className="font-medium">{opp.sea_campaign}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground/60 mb-0.5">Conversions SEA</div>
                        <div className="font-medium">{opp.sea_conversions}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground/60 mb-0.5">Coût total SEA / 30j</div>
                        <div className="font-medium">{opp.sea_cost.toFixed(2)}€</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground/60 mb-0.5">Clics organiques</div>
                        <div className="font-medium">{opp.organic_clicks}</div>
                      </div>
                    </div>

                    {/* DataForSEO SERP data */}
                    {(opp.serp_volume || opp.serp_difficulty) && (
                      <div className="border-t border-border/20 pt-3">
                        <div className="text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                          <BarChart3 className="h-3 w-3" />
                          Données SERP (DataForSEO)
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-muted-foreground/60 mb-0.5">Volume mensuel</div>
                            <div className="font-medium">{opp.serp_volume?.toLocaleString('fr-FR') || '—'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground/60 mb-0.5">Keyword Difficulty</div>
                            <div className="font-medium">
                              {opp.serp_difficulty}% — {getDifficultyLabel(opp.serp_difficulty!)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground/60 mb-0.5">CPC marché</div>
                            <div className="font-medium">{opp.serp_cpc_market?.toFixed(2)}€</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground/60 mb-0.5">Compétition</div>
                            <div className="font-medium">{((opp.serp_competition || 0) * 100).toFixed(0)}%</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state — Google Ads NOT connected */}
      {!loading && opportunities.length === 0 && !summary && adsConnected === false && !isDemoMode && (
        <Card className="border-dashed border-2 border-border/20">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <LinkIcon className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {t3(language, 'Connectez Google Ads', 'Connect Google Ads', 'Conecte Google Ads')}
              </h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                {t3(language,
                  'Le SEA → SEO Bridge nécessite une connexion à votre compte Google Ads pour croiser vos données de campagnes payantes avec vos positions organiques.',
                  'The SEA → SEO Bridge requires a connection to your Google Ads account to cross-reference your paid campaign data with organic positions.',
                  'El SEA → SEO Bridge requiere una conexión a su cuenta de Google Ads para cruzar sus datos de campañas pagadas con posiciones orgánicas.'
                )}
              </p>
            </div>
            <Link to="/console" className="inline-block">
              <Button variant="outline" size="sm" className="gap-2">
                <Target className="h-4 w-4" />
                {t3(language, 'Aller dans API → Google Ads', 'Go to API → Google Ads', 'Ir a API → Google Ads')}
              </Button>
            </Link>
            <p className="text-[11px] text-muted-foreground/50">
              {t3(language, 'Seules des opérations de consultation sont effectuées.', 'Only read operations are performed.', 'Solo se realizan operaciones de consulta.')}{' '}
              <Link to="/api-integrations#google-ads" className="underline hover:text-muted-foreground">
                {t3(language, 'Politique de confidentialité', 'Privacy policy', 'Política de privacidad')}
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state — Google Ads connected but no analysis yet */}
      {!loading && opportunities.length === 0 && !summary && adsConnected === true && (
        <div className="border border-dashed border-border/30 rounded-lg p-8 text-center">
          <Target className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {t3(language,
              'Google Ads connecté ✓ — Lancez l\'analyse pour croiser vos données SEA avec vos positions organiques.',
              'Google Ads connected ✓ — Run the analysis to cross-reference your SEA data with organic positions.',
              'Google Ads conectado ✓ — Ejecute el análisis.'
            )}
          </p>
        </div>
      )}

      {/* Privacy link footer */}
      <div className="text-center pt-2">
        <Link to="/api-integrations#google-ads" className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors underline">
          {t3(language, 'Politique de confidentialité Google Ads', 'Google Ads Privacy Policy', 'Política de privacidad Google Ads')}
        </Link>
      </div>
    </div>
  );
}
