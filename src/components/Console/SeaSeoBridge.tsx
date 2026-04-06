import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, ArrowRight, Zap, AlertTriangle, Search, DollarSign, Target, Send, Unplug, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { SIMULATED_OPPORTUNITIES, SIMULATED_SUMMARY } from '@/data/seaSeoSimulatedData';

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

const typeConfig: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  no_organic: { label: 'Sans présence SEO', color: 'bg-red-500/10 text-red-500 border-red-500/30', icon: AlertTriangle },
  low_organic: { label: 'SEO faible', color: 'bg-orange-500/10 text-orange-500 border-orange-500/30', icon: TrendingDown },
  high_potential: { label: 'Fort potentiel', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: TrendingUp },
  cannibalisation_risk: { label: 'Cannibalisation SEA/SEO', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30', icon: Zap },
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

  // Check Google Ads connection status
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ads } = await (supabase as any)
        .from('google_ads_connections')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setAdsConnected(!!ads);
    };
    check();
  }, []);

  // Auto-load simulated data when demo mode is enabled and no live data
  useEffect(() => {
    if (isDemoMode && !adsConnected && !summary) {
      setSummary(SIMULATED_SUMMARY);
      setOpportunities(SIMULATED_OPPORTUNITIES);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            SEA → SEO Bridge
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t3(language,
              'Croisez vos données Google Ads, GA4 et les gaps Cocoon pour trouver des opportunités SEO inexploitées.',
              'Cross-reference your Google Ads, GA4 and Cocoon gaps data to find untapped SEO opportunities.',
              'Cruce sus datos de Google Ads, GA4 y gaps Cocoon para encontrar oportunidades SEO sin explotar.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {adsConnected && (
            <Button variant="outline" size="sm" onClick={disconnectAds} disabled={disconnecting} className="text-destructive border-destructive/30 hover:bg-destructive/10">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unplug className="h-4 w-4 mr-1" />}
              {t3(language, 'Déconnecter Google Ads', 'Disconnect Google Ads', 'Desconectar Google Ads')}
            </Button>
          )}
          <Button onClick={analyze} disabled={loading || (!adsConnected && !simulatedDataEnabled)} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            {loading ? 'Analyse…' : 'Analyser'}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summary.total_keywords}</div>
              <div className="text-xs text-muted-foreground">Mots-clés SEA analysés</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-500">{summary.total_sea_cost_eur.toFixed(0)}€</div>
              <div className="text-xs text-muted-foreground">Dépense SEA / 30j</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-500">{summary.potential_monthly_savings_eur.toFixed(0)}€</div>
              <div className="text-xs text-muted-foreground">Économie potentielle / mois</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-500">{summary.cocoon_aligned_count}</div>
              <div className="text-xs text-muted-foreground">Alignés avec gaps Cocoon</div>
            </CardContent>
          </Card>
          {summary.data_source === 'simulated' && (
            <div className="col-span-full">
              <Badge variant="outline" className="border-orange-500/40 text-orange-500 text-xs">
                ⚠️ {t3(language,
                  'Données simulées — Connectez Google Ads pour des données réelles',
                  'Simulated data — Connect Google Ads for real data',
                  'Datos simulados — Conecte Google Ads para datos reales'
                )}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Filter pills */}
      {opportunities.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={filterType === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilterType(null)}
          >
            Tous ({opportunities.length})
          </Badge>
          {Object.entries(typeConfig).map(([type, cfg]) => {
            const count = opportunities.filter(o => o.opportunity_type === type).length;
            if (count === 0) return null;
            return (
              <Badge
                key={type}
                variant={filterType === type ? 'default' : 'outline'}
                className={cn('cursor-pointer', filterType !== type && cfg.color)}
                onClick={() => setFilterType(filterType === type ? null : type)}
              >
                {cfg.label} ({count})
              </Badge>
            );
          })}
        </div>
      )}

      {/* Action bar */}
      {opportunities.length > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={selectAll}>
            {selectedIds.size === filteredOpportunities.length ? 'Tout désélectionner' : 'Tout sélectionner'}
          </Button>
          <Button
            size="sm"
            disabled={selectedIds.size === 0 || injecting || summary?.data_source === 'simulated'}
            onClick={injectSelected}
            className="gap-2"
          >
            {injecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Injecter {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} dans le Workbench
          </Button>
        </div>
      )}

      {/* Opportunities list */}
      {filteredOpportunities.length > 0 && (
        <div className="space-y-2">
          {filteredOpportunities.map((opp, idx) => {
            const realIdx = opportunities.indexOf(opp);
            const config = typeConfig[opp.opportunity_type] || typeConfig.high_potential;
            const Icon = config.icon;
            const isSelected = selectedIds.has(realIdx);

            return (
              <Card
                key={realIdx}
                className={cn(
                  'cursor-pointer transition-all border',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'
                )}
                onClick={() => toggleSelect(realIdx)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  {/* Checkbox */}
                  <div className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                    isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                  )}>
                    {isSelected && <span className="text-xs">✓</span>}
                  </div>

                  {/* Score */}
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                    opp.opportunity_score >= 80 ? 'bg-red-500/10 text-red-500' :
                    opp.opportunity_score >= 60 ? 'bg-orange-500/10 text-orange-500' :
                    'bg-blue-500/10 text-blue-500'
                  )}>
                    {opp.opportunity_score}
                  </div>

                  {/* Keyword + type */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{opp.keyword}</span>
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', config.color)}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      {opp.has_cocoon_gap && (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500 shrink-0">
                          Cocoon ✓
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        CPC {opp.sea_cpc.toFixed(2)}€
                      </span>
                      <span>{opp.sea_clicks} clics SEA</span>
                      <span>{opp.sea_conversions} conv.</span>
                      {opp.organic_position && (
                        <span className="flex items-center gap-1">
                          <Search className="h-3 w-3" />
                          Pos. {opp.organic_position.toFixed(0)}
                        </span>
                      )}
                      <span className="text-emerald-500 font-medium">
                        -{opp.monthly_savings_potential.toFixed(0)}€/mois
                      </span>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state — Google Ads NOT connected */}
      {!loading && opportunities.length === 0 && !summary && adsConnected === false && !simulatedDataEnabled && (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <LinkIcon className="h-8 w-8 text-primary" />
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
              {t3(language,
                'Accès en lecture seule uniquement.',
                'Read-only access only.',
                'Acceso de solo lectura.'
              )}
              {' '}
              <Link to="/api-integrations#google-ads" className="underline hover:text-muted-foreground">
                {t3(language, 'Politique de confidentialité', 'Privacy policy', 'Política de privacidad')}
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state — Google Ads connected but no analysis yet */}
      {!loading && opportunities.length === 0 && !summary && adsConnected === true && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Target className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {t3(language,
                'Google Ads connecté ✓ — Lancez l\'analyse pour croiser vos données SEA avec vos positions organiques et les gaps Cocoon.',
                'Google Ads connected ✓ — Run the analysis to cross-reference your SEA data with organic positions and Cocoon gaps.',
                'Google Ads conectado ✓ — Ejecute el análisis para cruzar sus datos SEA con posiciones orgánicas y gaps Cocoon.'
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Privacy link footer */}
      <div className="text-center pt-2">
        <Link to="/api-integrations#google-ads" className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors underline">
          {t3(language,
            'Politique de confidentialité Google Ads',
            'Google Ads Privacy Policy',
            'Política de privacidad Google Ads'
          )}
        </Link>
      </div>
    </div>
  );
}
