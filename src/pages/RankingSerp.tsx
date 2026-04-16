import { lazy, Suspense, useState, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Search, BarChart3, CheckCircle2, TrendingUp, Globe, Zap, Target,
  ArrowRight, Shield, Brain, Crown, Copy, Loader2
} from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const t3 = (l: string, fr: string, en: string, es: string) =>
  l === 'fr' ? fr : l === 'es' ? es : en;

/* ── Mini SERP Benchmark Tool (lead magnet) ── */

interface MiniResult {
  rank: number;
  url: string;
  domain: string;
  title: string;
  average: number;
  positions: Record<string, number | null>;
}

const PROVIDERS = [
  { id: 'DataForSEO', label: 'DataForSEO', color: 'bg-blue-500', textColor: 'text-white' },
  { id: 'SerpApi', label: 'SerpApi', color: 'bg-violet-600', textColor: 'text-white' },
  { id: 'Serper', label: 'serper.dev', color: 'bg-emerald-600', textColor: 'text-white' },
  { id: 'Bright Data', label: 'Bright Data', color: 'bg-orange-500', textColor: 'text-white' },
] as const;

function SerpBenchmarkMini() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MiniResult[]>([]);
  const [providerSummaries, setProviderSummaries] = useState<{ provider: string; count: number; error?: string }[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['DataForSEO', 'SerpApi', 'Serper']);
  const [locScale, setLocScale] = useState<'pays' | 'region' | 'departement' | 'ville'>('pays');
  const [locValue, setLocValue] = useState('France');
  const singleHitPenalty = 20;
  const [penaltyEnabled, setPenaltyEnabled] = useState(true);

  const toggleProvider = (id: string) => {
    setSelectedProviders(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const buildLocation = () => {
    let v = locValue.trim();
    if (!v) return 'France';
    // Strip leading "NN - " prefix from département entries (e.g. "13 - Bouches-du-Rhône" → "Bouches-du-Rhône")
    v = v.replace(/^[0-9AB]{1,3}\s*-\s*/i, '').trim();
    switch (locScale) {
      case 'pays': return v;
      case 'region': return `${v},France`;
      case 'departement': return `${v},France`;
      case 'ville': return `${v},France`;
      default: return v;
    }
  };

  const runBenchmark = async () => {
    if (!query.trim()) return;
    if (selectedProviders.length < 2) { toast.error('Sélectionnez au moins 2 providers'); return; }
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('serp-benchmark', {
        body: {
          action: 'benchmark',
          query: query.trim(),
          providers: selectedProviders,
          location: buildLocation(),
          language: 'fr',
          country: 'fr',
          single_hit_penalty: penaltyEnabled ? singleHitPenalty : 0,
        },
      });

      if (error) throw error;
      setResults(data?.averaged_results?.slice(0, 20) || []);
      setProviderSummaries(data?.providers || []);
      toast.success(`${data.total_sites} sites analysés via ${data.providers?.filter((p: any) => !p.error).length || 0} providers`);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const copyResults = () => {
    const activeProviders = providerSummaries.filter(p => !p.error).map(p => p.provider);
    const header = ['#', 'Site', ...activeProviders, 'Moyenne'].join('\t');
    const rows = results.map(r =>
      [r.rank, r.domain, ...activeProviders.map(p => r.positions[p] ?? '—'), r.average].join('\t')
    );
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    toast.success(t3(language, 'Copié !', 'Copied!', '¡Copiado!'));
  };

  const posColor = (pos: number | null) => {
    if (pos === null) return 'text-muted-foreground';
    if (pos <= 3) return 'text-emerald-600';
    if (pos <= 10) return 'text-blue-500';
    if (pos <= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  const activeProviders = providerSummaries.filter(p => !p.error);

  return (
    <Card className="border-primary/30 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Search className="h-5 w-5 text-primary" />
              {t3(language, 'Benchmark SERP', 'SERP Benchmark', 'Benchmark SERP')}
            </CardTitle>
            <CardDescription>
              {t3(language,
                'Comparez les positions Google renvoyées par plusieurs providers SERP simultanément.',
                'Compare Google positions returned by multiple SERP providers simultaneously.',
                'Compara las posiciones de Google devueltas por múltiples proveedores SERP simultáneamente.'
              )}
            </CardDescription>
          </div>
          {results.length > 0 && (
            <Button size="sm" variant="outline" onClick={copyResults} className="gap-1">
              <Copy className="h-3.5 w-3.5" /> Copy {results.length}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Query + Location */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t3(language, 'Mot-clé cible', 'Target keyword', 'Palabra clave')}
            </label>
            <Input
              placeholder='"agence seo"'
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runBenchmark()}
              className="caret-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t3(language, 'Échelle', 'Scale', 'Escala')}
            </label>
            <Select value={locScale} onValueChange={(v: any) => { setLocScale(v); setLocValue(''); }}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start" position="popper">
                <SelectItem value="pays">Pays</SelectItem>
                <SelectItem value="region">Région</SelectItem>
                <SelectItem value="departement">Département</SelectItem>
                <SelectItem value="ville">Ville</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {locScale === 'pays' ? t3(language, 'Pays', 'Country', 'País')
                : locScale === 'region' ? t3(language, 'Région', 'Region', 'Región')
                : locScale === 'departement' ? t3(language, 'Département', 'Department', 'Departamento')
                : t3(language, 'Ville', 'City', 'Ciudad')}
            </label>
            <Input
              placeholder={locScale === 'ville' ? 'ex: Lyon' : locScale === 'pays' ? 'France' : locScale === 'region' ? 'Île-de-France' : 'Rhône'}
              value={locValue}
              onChange={e => setLocValue(e.target.value)}
              className="w-full max-w-[180px] caret-foreground"
              list={`loc-suggestions-mini-${locScale}`}
            />
            {locScale === 'pays' && (
              <datalist id="loc-suggestions-mini-pays">
                <option value="France" /><option value="Belgium" /><option value="Switzerland" />
                <option value="Canada" /><option value="United States" /><option value="United Kingdom" />
                <option value="Germany" /><option value="Spain" /><option value="Italy" /><option value="Portugal" />
              </datalist>
            )}
            {locScale === 'region' && (
              <datalist id="loc-suggestions-mini-region">
                <option value="Île-de-France" /><option value="Auvergne-Rhône-Alpes" /><option value="Provence-Alpes-Côte d'Azur" />
                <option value="Occitanie" /><option value="Pays de la Loire" /><option value="Nouvelle-Aquitaine" />
                <option value="Bretagne" /><option value="Hauts-de-France" /><option value="Grand Est" />
              </datalist>
            )}
            {locScale === 'departement' && (
              <datalist id="loc-suggestions-mini-departement">
                <option value="01 - Ain" /><option value="02 - Aisne" /><option value="03 - Allier" />
                <option value="04 - Alpes-de-Haute-Provence" /><option value="05 - Hautes-Alpes" />
                <option value="06 - Alpes-Maritimes" /><option value="07 - Ardèche" /><option value="08 - Ardennes" />
                <option value="09 - Ariège" /><option value="10 - Aube" /><option value="11 - Aude" />
                <option value="12 - Aveyron" /><option value="13 - Bouches-du-Rhône" /><option value="14 - Calvados" />
                <option value="15 - Cantal" /><option value="16 - Charente" /><option value="17 - Charente-Maritime" />
                <option value="18 - Cher" /><option value="19 - Corrèze" /><option value="2A - Corse-du-Sud" />
                <option value="2B - Haute-Corse" /><option value="21 - Côte-d'Or" /><option value="22 - Côtes-d'Armor" />
                <option value="23 - Creuse" /><option value="24 - Dordogne" /><option value="25 - Doubs" />
                <option value="26 - Drôme" /><option value="27 - Eure" /><option value="28 - Eure-et-Loir" />
                <option value="29 - Finistère" /><option value="30 - Gard" /><option value="31 - Haute-Garonne" />
                <option value="32 - Gers" /><option value="33 - Gironde" /><option value="34 - Hérault" />
                <option value="35 - Ille-et-Vilaine" /><option value="36 - Indre" /><option value="37 - Indre-et-Loire" />
                <option value="38 - Isère" /><option value="39 - Jura" /><option value="40 - Landes" />
                <option value="41 - Loir-et-Cher" /><option value="42 - Loire" /><option value="43 - Haute-Loire" />
                <option value="44 - Loire-Atlantique" /><option value="45 - Loiret" /><option value="46 - Lot" />
                <option value="47 - Lot-et-Garonne" /><option value="48 - Lozère" /><option value="49 - Maine-et-Loire" />
                <option value="50 - Manche" /><option value="51 - Marne" /><option value="52 - Haute-Marne" />
                <option value="53 - Mayenne" /><option value="54 - Meurthe-et-Moselle" /><option value="55 - Meuse" />
                <option value="56 - Morbihan" /><option value="57 - Moselle" /><option value="58 - Nièvre" />
                <option value="59 - Nord" /><option value="60 - Oise" /><option value="61 - Orne" />
                <option value="62 - Pas-de-Calais" /><option value="63 - Puy-de-Dôme" />
                <option value="64 - Pyrénées-Atlantiques" /><option value="65 - Hautes-Pyrénées" />
                <option value="66 - Pyrénées-Orientales" /><option value="67 - Bas-Rhin" /><option value="68 - Haut-Rhin" />
                <option value="69 - Rhône" /><option value="70 - Haute-Saône" /><option value="71 - Saône-et-Loire" />
                <option value="72 - Sarthe" /><option value="73 - Savoie" /><option value="74 - Haute-Savoie" />
                <option value="75 - Paris" /><option value="76 - Seine-Maritime" /><option value="77 - Seine-et-Marne" />
                <option value="78 - Yvelines" /><option value="79 - Deux-Sèvres" /><option value="80 - Somme" />
                <option value="81 - Tarn" /><option value="82 - Tarn-et-Garonne" /><option value="83 - Var" />
                <option value="84 - Vaucluse" /><option value="85 - Vendée" /><option value="86 - Vienne" />
                <option value="87 - Haute-Vienne" /><option value="88 - Vosges" /><option value="89 - Yonne" />
                <option value="90 - Territoire de Belfort" /><option value="91 - Essonne" />
                <option value="92 - Hauts-de-Seine" /><option value="93 - Seine-Saint-Denis" />
                <option value="94 - Val-de-Marne" /><option value="95 - Val-d'Oise" />
                <option value="971 - Guadeloupe" /><option value="972 - Martinique" /><option value="973 - Guyane" />
                <option value="974 - La Réunion" /><option value="976 - Mayotte" />
              </datalist>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={runBenchmark}
              disabled={loading || !query.trim() || selectedProviders.length < 2}
              className="gap-1.5 h-9 px-3 text-sm font-medium border-foreground/30 text-foreground hover:bg-foreground/10"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {loading
                ? t3(language, 'Analyse…', 'Analyzing…', 'Analizando…')
                : t3(language, 'Analyser', 'Analyze', 'Analizar')
              }
            </Button>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Checkbox
                checked={penaltyEnabled}
                onCheckedChange={(v) => setPenaltyEnabled(!!v)}
                className="h-3 w-3 border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:border-muted-foreground"
              />
              <label className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">
                Penalty (+{singleHitPenalty})
              </label>
            </div>
          </div>
        </div>

        {!user && (
          <p className="text-xs text-muted-foreground">
            {t3(language,
              'Connectez-vous pour sauvegarder vos benchmarks et accéder à l\'historique.',
              'Log in to save your benchmarks and access history.',
              'Inicia sesión para guardar tus benchmarks y acceder al historial.'
            )}
          </p>
        )}

        {providerSummaries.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {providerSummaries.map(p => (
              <Badge key={p.provider} variant={p.error ? 'destructive' : 'secondary'} className="text-xs">
                {p.provider}: {p.error || `${p.count} résultats`}
              </Badge>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t3(language, `Top ${results.length} résultats croisés`, `Top ${results.length} cross-referenced results`, `Top ${results.length} resultados cruzados`)}
            </p>
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Domain</th>
                    {activeProviders.map(p => (
                      <th key={p.provider} className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">{p.provider}</th>
                    ))}
                    <th className="px-3 py-2 text-center text-xs font-medium text-primary">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.rank} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-1.5 text-xs font-mono text-muted-foreground">{r.rank}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=16`}
                            alt=""
                            className="h-4 w-4 rounded-sm"
                            loading="lazy"
                          />
                          <span className="text-xs font-medium truncate max-w-[200px]">{r.domain}</span>
                        </div>
                      </td>
                      {activeProviders.map(p => (
                        <td key={p.provider} className={`px-3 py-1.5 text-center text-xs font-mono ${posColor(r.positions[p.provider])}`}>
                          {r.positions[p.provider] ?? '—'}
                        </td>
                      ))}
                      <td className={`px-3 py-1.5 text-center text-xs font-bold ${posColor(r.average)}`}>
                        {r.average}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main Page ── */

const RankingSerp = memo(() => {
  const { language } = useLanguage();
  useCanonicalHreflang('/app/ranking-serp');

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "Benchmark Rank SERP — Crawlers.fr",
        "applicationCategory": "SEO Tool",
        "operatingSystem": "Web",
        "description": "Outil gratuit de benchmark SERP multi-providers. Comparez les positions Google renvoyées par DataForSEO, SerpApi, Serper et Bright Data pour fiabiliser votre suivi SEO.",
        "url": "https://crawlers.fr/app/ranking-serp",
        "author": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Pourquoi croiser plusieurs sources SERP ?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Chaque API SERP (DataForSEO, SerpApi, Serper, Bright Data) interroge Google depuis des datacenter différents. Les positions varient selon la localisation, le user-agent et les mesures anti-scraping. Le croisement multi-providers neutralise ces biais et donne un classement statistiquement fiable."
            }
          },
          {
            "@type": "Question",
            "name": "Qu'est-ce que la pénalité single-hit ?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Si un site n'est trouvé que par un seul provider sur trois, sa position moyenne est pénalisée de +20 points. Cela réduit les faux positifs causés par les résultats personnalisés ou les techniques anti-scraping de Google."
            }
          },
          {
            "@type": "Question",
            "name": "Est-ce que cet outil est gratuit ?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Oui, le benchmark SERP est accessible gratuitement à tous les utilisateurs, inscrits ou non. Les utilisateurs connectés bénéficient en plus de la sauvegarde et de l'historique de leurs benchmarks."
            }
          }
        ]
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Benchmark Rank SERP", "item": "https://crawlers.fr/app/ranking-serp" }
        ]
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>{t3(language,
          'Benchmark Rank SERP — Classement Google multi-providers gratuit | Crawlers.fr',
          'SERP Rank Benchmark — Free multi-provider Google ranking | Crawlers.fr',
          'Benchmark Rank SERP — Ranking Google multi-proveedor gratis | Crawlers.fr'
        )}</title>
        <meta name="description" content={t3(language,
           'Comparez les positions Google de n\'importe quel mot-clé via 4 providers SERP simultanément (DataForSEO, SerpApi, Serper, Bright Data). Outil gratuit, classement croisé fiable.',
           'Compare Google positions for any keyword via 4 SERP providers simultaneously (DataForSEO, SerpApi, Serper, Bright Data). Free tool, reliable cross-referenced ranking.',
           'Compara las posiciones de Google para cualquier palabra clave mediante 4 proveedores SERP simultáneamente (DataForSEO, SerpApi, Serper, Bright Data). Herramienta gratuita.'
        )} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <link rel="canonical" href="https://crawlers.fr/app/ranking-serp" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main className="min-h-screen bg-background pb-20">
        {/* Hero */}
        <section className="relative pt-16 pb-12 sm:pt-24 sm:pb-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="container mx-auto max-w-5xl px-4 relative">
            <div className="text-center space-y-4">
              <Badge variant="outline" className="border-primary/40 text-primary">
                {t3(language, 'Outil gratuit', 'Free tool', 'Herramienta gratuita')}
              </Badge>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-foreground leading-tight">
                {t3(language,
                  'Benchmark Rank SERP',
                  'SERP Rank Benchmark',
                  'Benchmark Rank SERP'
                )}
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                {t3(language,
                  'Comparez les positions Google renvoyées par 4 providers SERP en une seule requête. Classement croisé, pénalité anti-faux-positif, résultats fiables.',
                  'Compare Google positions returned by 4 SERP providers in a single query. Cross-referenced ranking, anti-false-positive penalty, reliable results.',
                  'Compara las posiciones de Google devueltas por 4 proveedores SERP en una sola consulta. Ranking cruzado, penalización anti-falso-positivo, resultados fiables.'
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Tool Section */}
        <section className="container mx-auto max-w-5xl px-4 mb-16">
          <SerpBenchmarkMini />
        </section>

        {/* How it works */}
        <section className="container mx-auto max-w-5xl px-4 mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
            {t3(language, 'Comment fonctionne le benchmark SERP multi-providers ?', 'How does the multi-provider SERP benchmark work?', '¿Cómo funciona el benchmark SERP multi-proveedor?')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Globe,
                title: t3(language, '1. Requête parallèle', '1. Parallel query', '1. Consulta paralela'),
                desc: t3(language,
                  'Votre mot-clé est envoyé simultanément à DataForSEO, SerpApi et Serper.dev. Chaque provider interroge Google depuis des IP et datacenter différents.',
                  'Your keyword is sent simultaneously to DataForSEO, SerpApi and Serper.dev. Each provider queries Google from different IPs and datacenters.',
                  'Su palabra clave se envía simultáneamente a DataForSEO, SerpApi y Serper.dev. Cada proveedor consulta Google desde IPs y datacenters diferentes.'
                ),
              },
              {
                icon: BarChart3,
                title: t3(language, '2. Normalisation & croisement', '2. Normalization & cross-referencing', '2. Normalización y cruce'),
                desc: t3(language,
                  'Les URLs sont normalisées et dédupliquées. Pour chaque site, la position moyenne est calculée sur les providers qui le trouvent.',
                  'URLs are normalized and deduplicated. For each site, the average position is calculated across providers that find it.',
                  'Las URLs se normalizan y deduplicán. Para cada sitio, la posición promedio se calcula entre los proveedores que lo encuentran.'
                ),
              },
              {
                icon: Shield,
                title: t3(language, '3. Pénalité single-hit', '3. Single-hit penalty', '3. Penalización single-hit'),
                desc: t3(language,
                  'Un site trouvé par un seul provider est pénalisé de +20 positions. Cela élimine les faux positifs dus aux résultats personnalisés ou anti-scraping de Google.',
                  'A site found by only one provider is penalized by +20 positions. This eliminates false positives from personalized or anti-scraping results.',
                  'Un sitio encontrado por solo un proveedor recibe una penalización de +20 posiciones. Esto elimina falsos positivos.'
                ),
              },
            ].map((step, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="pt-6 space-y-3">
                  <step.icon className="h-8 w-8 text-gray-700" />
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Why cross-reference */}
        <section className="container mx-auto max-w-5xl px-4 mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            {t3(language, 'Pourquoi croiser les données SERP de plusieurs providers ?', 'Why cross-reference SERP data from multiple providers?', '¿Por qué cruzar datos SERP de múltiples proveedores?')}
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'Les outils SEO traditionnels (Semrush, Ahrefs, SE Ranking) s\'appuient sur un seul provider SERP pour récupérer les positions Google. Le problème : Google applique des mesures anti-scraping (rotation de résultats, résultats personnalisés, A/B tests) qui font varier les positions d\'un datacenter à l\'autre. Résultat, un outil peut afficher la position 5 quand un autre affiche la position 12 pour le même mot-clé.',
                'Traditional SEO tools (Semrush, Ahrefs, SE Ranking) rely on a single SERP provider to fetch Google positions. The problem: Google applies anti-scraping measures (result rotation, personalized results, A/B tests) that cause positions to vary between datacenters. One tool may show position 5 while another shows position 12 for the same keyword.',
                'Las herramientas SEO tradicionales (Semrush, Ahrefs, SE Ranking) dependen de un solo proveedor SERP. El problema: Google aplica medidas anti-scraping que hacen variar las posiciones entre datacenters.'
              )}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'Le benchmark multi-providers de Crawlers.fr résout ce problème en interrogeant simultanément DataForSEO, SerpApi et Serper.dev. Le classement final est une moyenne pondérée des positions croisées, neutralisant les biais inhérents à chaque source. C\'est la méthode utilisée par les agences SEO les plus exigeantes.',
                'Crawlers.fr multi-provider benchmark solves this by querying DataForSEO, SerpApi and Serper.dev simultaneously. The final ranking is a weighted average of cross-referenced positions, neutralizing biases inherent to each source. This is the method used by the most demanding SEO agencies.',
                'El benchmark multi-proveedor de Crawlers.fr resuelve esto consultando DataForSEO, SerpApi y Serper.dev simultáneamente. El ranking final es un promedio ponderado de posiciones cruzadas.'
              )}
            </p>
          </div>
        </section>

        {/* Use cases */}
        <section className="container mx-auto max-w-5xl px-4 mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
            {t3(language, 'Cas d\'usage du benchmark SERP', 'SERP Benchmark use cases', 'Casos de uso del benchmark SERP')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: t3(language, 'Vérifier une position Google', 'Verify a Google position', 'Verificar una posición en Google'),
                desc: t3(language,
                  'Votre outil SEO affiche la position 3, mais le trafic ne suit pas ? Lancez un benchmark croisé pour connaître la position réelle, telle que vue par 3 sources indépendantes.',
                  'Your SEO tool shows position 3 but traffic doesn\'t follow? Run a cross benchmark to know the real position as seen by 3 independent sources.',
                  'Su herramienta SEO muestra la posición 3 pero el tráfico no lo refleja? Lance un benchmark cruzado.'
                ),
              },
              {
                title: t3(language, 'Auditer la concurrence', 'Audit competition', 'Auditar la competencia'),
                desc: t3(language,
                  'Identifiez les sites qui trustent réellement les premières positions sur votre requête cible. Le classement croisé élimine les anomalies d\'un provider unique.',
                  'Identify sites that truly dominate top positions on your target query. Cross-referenced ranking eliminates single-provider anomalies.',
                  'Identifique los sitios que realmente dominan las primeras posiciones en su consulta objetivo.'
                ),
              },
              {
                title: t3(language, 'Comparer avant/après une mise à jour', 'Compare before/after an update', 'Comparar antes/después de una actualización'),
                desc: t3(language,
                  'Mesurez l\'impact d\'un Core Update Google ou d\'une refonte technique en comparant les benchmarks SERP à intervalles réguliers.',
                  'Measure the impact of a Google Core Update or technical overhaul by comparing SERP benchmarks at regular intervals.',
                  'Mida el impacto de una Core Update de Google comparando benchmarks SERP a intervalos regulares.'
                ),
              },
              {
                title: t3(language, 'Fiabiliser le reporting client', 'Improve client reporting', 'Mejorar los informes al cliente'),
                desc: t3(language,
                  'Présentez à vos clients des positions Google vérifiées par 3 sources. Plus crédible qu\'un screenshot d\'outil unique.',
                  'Present clients with Google positions verified by 3 sources. More credible than a single tool screenshot.',
                  'Presente a sus clientes posiciones de Google verificadas por 3 fuentes.'
                ),
              },
            ].map((c, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {c.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{c.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Providers detail */}
        <section className="container mx-auto max-w-5xl px-4 mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            {t3(language, 'Les 3 providers SERP utilisés', 'The 3 SERP providers used', 'Los 3 proveedores SERP utilizados')}
          </h2>
          <ul className="space-y-4">
            {[
              {
                name: 'DataForSEO',
                desc: t3(language,
                  'API leader du marché pour les données SEO. Interroge Google en mode "live advanced" avec géolocalisation précise. 30 résultats organiques par requête.',
                  'Market-leading API for SEO data. Queries Google in "live advanced" mode with precise geolocation. 30 organic results per query.',
                  'API líder del mercado para datos SEO. Consulta Google en modo "live advanced" con geolocalización precisa.'
                ),
              },
              {
                name: 'SerpApi',
                desc: t3(language,
                  'Spécialiste du parsing SERP depuis 2016. Infrastructure massive avec proxy résidentiel. Réputé pour la précision des extractions organiques.',
                  'SERP parsing specialist since 2016. Massive infrastructure with residential proxy. Renowned for organic extraction accuracy.',
                  'Especialista en análisis SERP desde 2016. Infraestructura masiva con proxy residencial.'
                ),
              },
              {
                name: 'Serper.dev',
                desc: t3(language,
                  'API SERP rapide et économique. Excellente couverture des résultats organiques avec un rapport qualité/prix imbattable pour les requêtes en volume.',
                  'Fast and affordable SERP API. Excellent organic result coverage with unbeatable value for volume queries.',
                  'API SERP rápida y económica. Excelente cobertura de resultados orgánicos.'
                ),
              },
            ].map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">{p.name}</span>
                  <span className="text-muted-foreground"> — {p.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="container mx-auto max-w-5xl px-4 mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
            {t3(language, 'Questions fréquentes — Benchmark SERP', 'FAQ — SERP Benchmark', 'Preguntas frecuentes — Benchmark SERP')}
          </h2>
          <div className="space-y-6 max-w-3xl mx-auto">
            {[
              {
                q: t3(language, 'Pourquoi les positions Google varient-elles d\'un outil à l\'autre ?', 'Why do Google positions vary between tools?', '¿Por qué las posiciones de Google varían entre herramientas?'),
                a: t3(language,
                  'Google personnalise les résultats selon la localisation IP, l\'historique, le device et applique des A/B tests permanents. Chaque provider SERP voit une "version" différente de Google. Le croisement multi-sources est la seule méthode fiable pour obtenir un classement stabilisé.',
                  'Google personalizes results based on IP location, history, device and runs permanent A/B tests. Each SERP provider sees a different "version" of Google. Multi-source cross-referencing is the only reliable method for a stabilized ranking.',
                  'Google personaliza los resultados según la ubicación IP, historial, dispositivo y aplica A/B tests permanentes.'
                ),
              },
              {
                q: t3(language, 'Combien de résultats le benchmark renvoie-t-il ?', 'How many results does the benchmark return?', '¿Cuántos resultados devuelve el benchmark?'),
                a: t3(language,
                  'Chaque provider renvoie jusqu\'à 30 résultats organiques. Le croisement peut générer 50-80 URLs uniques, triées par position moyenne. Les 20 premiers sont affichés dans l\'outil gratuit.',
                  'Each provider returns up to 30 organic results. Cross-referencing can generate 50-80 unique URLs, sorted by average position. The top 20 are displayed in the free tool.',
                  'Cada proveedor devuelve hasta 30 resultados orgánicos. El cruce puede generar 50-80 URLs únicas.'
                ),
              },
              {
                q: t3(language, 'Le benchmark fonctionne-t-il pour tous les pays ?', 'Does the benchmark work for all countries?', '¿Funciona el benchmark para todos los países?'),
                a: t3(language,
                  'L\'outil est configuré par défaut pour la France (Google.fr). En mode Console (abonnés Pro Agency), vous pouvez paramétrer le pays, la langue et la localisation pour cibler n\'importe quel marché.',
                  'The tool is configured by default for France (Google.fr). In Console mode (Pro Agency subscribers), you can set the country, language and location to target any market.',
                  'La herramienta está configurada por defecto para Francia. En modo Consola (suscriptores Pro Agency), puede configurar cualquier mercado.'
                ),
              },
              {
                q: t3(language, 'Comment la pénalité single-hit fonctionne-t-elle exactement ?', 'How exactly does the single-hit penalty work?', '¿Cómo funciona exactamente la penalización single-hit?'),
                a: t3(language,
                  'Si un site n\'apparaît que dans les résultats d\'un seul provider (sur les 3 actifs), sa position moyenne est augmentée de 20 points. Exemple : un site à la position 8 chez DataForSEO mais absent chez SerpApi et Serper aura une moyenne de 28 au lieu de 8. Cela réduit les faux positifs.',
                  'If a site only appears in one provider\'s results (out of 3 active), its average position is increased by 20 points. Example: a site at position 8 on DataForSEO but absent on SerpApi and Serper will have an average of 28 instead of 8.',
                  'Si un sitio solo aparece en los resultados de un proveedor (de 3 activos), su posición promedio aumenta en 20 puntos.'
                ),
              },
            ].map((faq, i) => (
              <div key={i} className="space-y-2">
                <h3 className="font-semibold text-foreground">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto max-w-3xl px-4 text-center">
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="py-10 space-y-4">
              <Crown className="h-8 w-8 mx-auto text-violet-600" />
              <h2 className="text-xl font-bold text-foreground">
                {t3(language,
                  'Passez au niveau supérieur avec Pro Agency',
                  'Level up with Pro Agency',
                  'Suba de nivel con Pro Agency'
                )}
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                {t3(language,
                  'Benchmarks illimités, 4 providers (dont Bright Data), historique complet, configuration avancée (pays, langue, localisation), export et intégration Console.',
                  'Unlimited benchmarks, 4 providers (including Bright Data), full history, advanced configuration (country, language, location), export and Console integration.',
                  'Benchmarks ilimitados, 4 proveedores (incluyendo Bright Data), historial completo, configuración avanzada, exportación e integración Console.'
                )}
              </p>
              <div className="flex justify-center gap-3 flex-wrap">
                <Link to="/pro-agency">
                  <Button className="gap-2 bg-violet-600 hover:bg-violet-700">
                    <Crown className="h-4 w-4" />
                    {t3(language, 'Découvrir Pro Agency', 'Discover Pro Agency', 'Descubrir Pro Agency')}
                  </Button>
                </Link>
                <Link to="/tarifs">
                  <Button variant="outline" className="gap-2">
                    {t3(language, 'Voir les tarifs', 'View pricing', 'Ver precios')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
});

RankingSerp.displayName = 'RankingSerp';

export default RankingSerp;
