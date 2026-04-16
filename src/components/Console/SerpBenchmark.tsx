import { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search, Copy, BarChart3, Globe, Trophy, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'fr' ? fr : lang === 'es' ? es : en;

interface AveragedSite {
  rank: number;
  url: string;
  domain: string;
  title: string;
  positions: Record<string, number | null>;
  average: number;
}

interface ProviderSummary {
  provider: string;
  count: number;
  error?: string;
}

const PROVIDERS = [
  { id: 'DataForSEO', label: 'DataForSEO', color: 'bg-blue-500', textColor: 'text-white' },
  { id: 'SerpApi', label: 'SerpApi', color: 'bg-violet-600', textColor: 'text-white' },
  { id: 'Serper', label: 'serper.dev', color: 'bg-emerald-600', textColor: 'text-white' },
  { id: 'Bright Data', label: 'Bright Data', color: 'bg-orange-500', textColor: 'text-white' },
] as const;

function positionCell(pos: number | null) {
  if (pos === null || pos === undefined) return <span className="text-muted-foreground/40">—</span>;
  let colorClass = 'text-emerald-600 font-semibold';
  if (pos > 10) colorClass = 'text-orange-500 font-medium';
  if (pos > 20) colorClass = 'text-red-500 font-medium';
  return <span className={colorClass}>{pos}</span>;
}

export interface SerpBenchmarkHandle {
  triggerBenchmark: (keyword: string) => void;
}

interface Props {
  trackedSites: { id: string; domain: string }[];
  selectedSiteId: string;
}

export const SerpBenchmark = forwardRef<SerpBenchmarkHandle, Props>(function SerpBenchmark({ trackedSites, selectedSiteId }, ref) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isAgencyPro, isAgencyPremium } = useCredits();
  const [query, setQuery] = useState('');
  const [targetDomain, setTargetDomain] = useState('');
  const [location, setLocation] = useState('France');
  const [singleHitPenalty, setSingleHitPenalty] = useState(20);
  const [penaltyEnabled, setPenaltyEnabled] = useState(true);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['DataForSEO', 'SerpApi', 'Serper']);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AveragedSite[] | null>(null);
  const [providerSummaries, setProviderSummaries] = useState<ProviderSummary[]>([]);
  const [totalSites, setTotalSites] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; keyword: string } | null>(null);

  // Auto-fill target domain from selected site
  const selectedSite = trackedSites.find(s => s.id === selectedSiteId);

  const toggleProvider = (id: string) => {
    setSelectedProviders(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const runBenchmark = useCallback(async (overrideQuery?: string) => {
    const q = overrideQuery || query.trim();
    if (!q) { toast.error('Entrez un mot-clé'); return; }
    if (selectedProviders.length < 2) { toast.error('Sélectionnez au moins 2 providers'); return; }
    if (overrideQuery) setQuery(overrideQuery);
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('serp-benchmark', {
        body: {
          action: 'benchmark',
          query: q,
          tracked_site_id: selectedSiteId || undefined,
          target_domain: targetDomain.trim() || selectedSite?.domain || undefined,
          location,
          language: 'fr',
          country: 'fr',
          single_hit_penalty: penaltyEnabled ? singleHitPenalty : 0,
          providers: selectedProviders,
        },
      });
      if (error) throw error;
      setResults(data.averaged_results || []);
      setProviderSummaries(data.providers || []);
      setTotalSites(data.total_sites || 0);
      toast.success(`${data.total_sites} sites analysés via ${data.providers?.filter((p: ProviderSummary) => !p.error).length || 0} providers`);
    } catch (e: any) {
      toast.error(e.message || 'Erreur benchmark');
    } finally {
      setLoading(false);
    }
  }, [query, selectedProviders, selectedSiteId, targetDomain, selectedSite, location, penaltyEnabled, singleHitPenalty]);

  useImperativeHandle(ref, () => ({
    triggerBenchmark: (keyword: string) => runBenchmark(keyword),
  }), [runBenchmark]);

  const maxBatchKeywords = isAgencyPremium ? 5 : isAgencyPro ? 1 : 0;

  const runTopKeywordsBenchmark = useCallback(async () => {
    if (!user || !selectedSiteId) return;
    if (!isAgencyPro) {
      toast.error(t3(language, 'Réservé aux abonnés Pro Agency', 'Pro Agency subscribers only', 'Solo suscriptores Pro Agency'));
      return;
    }
    const site = trackedSites.find(s => s.id === selectedSiteId);
    if (!site) return;

    setBatchLoading(true);
    try {
      const { data: keywords, error } = await supabase
        .from('keyword_universe')
        .select('keyword, opportunity_score')
        .eq('tracked_site_id', selectedSiteId)
        .eq('user_id', user.id)
        .order('opportunity_score', { ascending: false })
        .limit(maxBatchKeywords);

      if (error) throw error;
      if (!keywords?.length) {
        toast.error(t3(language,
          'Aucun mot-clé trouvé dans l\'univers de mots-clés pour ce site. Lancez d\'abord un audit stratégique.',
          'No keywords found in keyword universe for this site. Run a strategic audit first.',
          'No se encontraron palabras clave para este sitio.'
        ));
        setBatchLoading(false);
        return;
      }

      toast.info(`${keywords.length} top keywords à benchmarker`);

      for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        setBatchProgress({ current: i + 1, total: keywords.length, keyword: kw.keyword });

        await supabase.functions.invoke('serp-benchmark', {
          body: {
            action: 'benchmark',
            query: kw.keyword,
            tracked_site_id: selectedSiteId,
            target_domain: site.domain,
            location,
            language: 'fr',
            country: 'fr',
            single_hit_penalty: penaltyEnabled ? singleHitPenalty : 0,
            providers: selectedProviders,
          },
        });

        if (i < keywords.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      toast.success(t3(language,
        `${keywords.length} benchmarks terminés !`,
        `${keywords.length} benchmarks completed!`,
        `${keywords.length} benchmarks completados!`
      ));

      // Display the top keyword result
      runBenchmark(keywords[0].keyword);
    } catch (e: any) {
      toast.error(e.message || 'Erreur batch benchmark');
    } finally {
      setBatchLoading(false);
      setBatchProgress(null);
    }
  }, [user, selectedSiteId, trackedSites, selectedProviders, location, penaltyEnabled, singleHitPenalty, language, runBenchmark]);


  const copyResults = () => {
    if (!results) return;
    const activeProviders = providerSummaries.filter(p => !p.error).map(p => p.provider);
    const header = ['#', 'Site', ...activeProviders, 'Moyenne'].join('\t');
    const rows = results.map(r =>
      [r.rank, r.domain, ...activeProviders.map(p => r.positions[p] ?? '—'), r.average].join('\t')
    );
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    toast.success(`${results.length} lignes copiées`);
  };

  const activeProviders = providerSummaries.filter(p => !p.error).map(p => p.provider);
  const bestPosition = results?.[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t3(language, 'Benchmark SERP Multi-Providers', 'Multi-Provider SERP Benchmark', 'Benchmark SERP Multi-Providers')}
            </CardTitle>
            <CardDescription>
              {t3(language,
                'Compare les positions SERP entre plusieurs fournisseurs de données pour détecter les écarts',
                'Compare SERP positions across multiple data providers to detect discrepancies',
                'Compara posiciones SERP entre múltiples proveedores de datos'
              )}
            </CardDescription>
          </div>
          {results && (
            <Button size="sm" variant="outline" onClick={copyResults} className="gap-1">
              <Copy className="h-3.5 w-3.5" /> Copy {results.length}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Providers */}
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {t3(language, 'Providers', 'Providers', 'Proveedores')}
          </p>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map(p => (
              <label
                key={p.id}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer border transition-all text-sm ${
                  selectedProviders.includes(p.id)
                    ? `${p.color} ${p.textColor} border-transparent shadow-sm`
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                <Checkbox
                  checked={selectedProviders.includes(p.id)}
                  onCheckedChange={() => toggleProvider(p.id)}
                  className="hidden"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        {/* Query form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t3(language, 'Mot-clé cible', 'Target keyword', 'Palabra clave')}
            </label>
            <Input
              placeholder='"agence seo"'
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runBenchmark()}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t3(language, 'Domaine cible', 'Target domain', 'Dominio objetivo')}
            </label>
            <Input
              placeholder={selectedSite?.domain || 'example.com'}
              value={targetDomain}
              onChange={e => setTargetDomain(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t3(language, 'Localisation', 'Location', 'Ubicación')}
            </label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="France">🇫🇷 France</SelectItem>
                <SelectItem value="Belgium">🇧🇪 Belgique</SelectItem>
                <SelectItem value="Switzerland">🇨🇭 Suisse</SelectItem>
                <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                <SelectItem value="United States">🇺🇸 USA</SelectItem>
                <SelectItem value="United Kingdom">🇬🇧 UK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Checkbox
                checked={penaltyEnabled}
                onCheckedChange={(v) => setPenaltyEnabled(!!v)}
                className="h-3.5 w-3.5"
              />
              Single-hit penalty
            </label>
            <Input
              type="number"
              value={singleHitPenalty}
              onChange={e => setSingleHitPenalty(parseInt(e.target.value) || 0)}
              disabled={!penaltyEnabled}
              className="w-full"
              min={0}
              max={100}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => runBenchmark()} disabled={loading || batchLoading || selectedProviders.length < 2} className="gap-2 text-muted-foreground hover:text-foreground border border-border/50 hover:border-border bg-transparent">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading
              ? t3(language, 'Analyse en cours...', 'Analyzing...', 'Analizando...')
              : t3(language, 'Lancer le benchmark', 'Run benchmark', 'Ejecutar benchmark')
            }
          </Button>
          <Button
            variant="outline"
            onClick={runTopKeywordsBenchmark}
            disabled={loading || batchLoading || selectedProviders.length < 2 || !selectedSiteId}
            className="gap-2"
          >
            {batchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {batchLoading && batchProgress
              ? `${batchProgress.current}/${batchProgress.total} — ${batchProgress.keyword}`
              : t3(language, 'Benchmarker mes top keywords', 'Benchmark my top keywords', 'Benchmark mis top keywords')
            }
          </Button>
        </div>

        {/* Provider status */}
        {providerSummaries.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {providerSummaries.map(p => (
              <Badge
                key={p.provider}
                variant={p.error ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {p.provider}: {p.error ? `❌ ${p.error}` : `${p.count} résultats`}
              </Badge>
            ))}
          </div>
        )}

        {/* Best position highlight */}
        {bestPosition && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Trophy className="h-5 w-5 text-primary" />
            <div>
              <span className="font-semibold text-sm">{t3(language, 'Meilleure position', 'Best position', 'Mejor posición')}: </span>
              <span className="text-primary font-bold">#{bestPosition.rank}</span>
              <span className="text-muted-foreground text-sm ml-2">{bestPosition.domain}</span>
              <span className="text-muted-foreground text-xs ml-2">({totalSites} sites, {activeProviders.length} providers)</span>
            </div>
          </div>
        )}

        {/* Results table */}
        {results && results.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left w-10">#</th>
                  <th className="px-3 py-2 text-left">Site</th>
                  {activeProviders.map(p => {
                    const pConfig = PROVIDERS.find(pr => pr.id === p);
                    return (
                      <th key={p} className="px-3 py-2 text-center min-w-[80px]">
                        <Badge className={`${pConfig?.color || 'bg-gray-500'} ${pConfig?.textColor || 'text-white'} text-[10px] px-2`}>
                          {pConfig?.label || p}
                        </Badge>
                      </th>
                    );
                  })}
                  <th className="px-3 py-2 text-center font-bold min-w-[100px]">
                    {t3(language, 'SERP Réelle Moyenne', 'Average SERP', 'SERP Promedio')} ▲
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const isTarget = targetDomain && r.domain.includes(targetDomain.replace(/^www\./, ''));
                  return (
                    <tr
                      key={r.url}
                      className={`border-b hover:bg-muted/20 transition-colors ${isTarget ? 'bg-primary/5 font-medium' : ''}`}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{r.rank}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 max-w-[250px]">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=16`}
                            alt=""
                            className="w-4 h-4 rounded"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <span className="truncate text-xs" title={r.url}>
                            {r.url.replace(/^https?:\/\//, '').substring(0, 40)}
                            {r.url.replace(/^https?:\/\//, '').length > 40 ? '…' : ''}
                          </span>
                        </div>
                      </td>
                      {activeProviders.map(p => (
                        <td key={p} className="px-3 py-2 text-center">
                          {positionCell(r.positions[p])}
                        </td>
                      ))}
                      <td className={`px-3 py-2 text-center font-bold ${r.average <= 3 ? 'text-emerald-600' : r.average <= 10 ? 'text-blue-600' : r.average <= 20 ? 'text-orange-500' : 'text-red-500'}`}>
                        {r.average}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {results && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {t3(language, 'Aucun résultat trouvé', 'No results found', 'Sin resultados')}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
