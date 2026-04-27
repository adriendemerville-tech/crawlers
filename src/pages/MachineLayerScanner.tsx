import { useState, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GeoScoreGauge } from '@/components/GeoScoreGauge';
import { SignalCard, type ScanRecommendation } from '@/components/MachineLayer/SignalCard';
import { setMachineLayerPreload } from '@/components/MachineLayer/preloadBridge';
import { useTurnstile } from '@/hooks/useTurnstile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ScanLine, ArrowRight, Loader2, Sparkles, Globe, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface ScanResponse {
  id: string | null;
  url: string;
  domain: string;
  rendered_via: string;
  score_global: number;
  scores_by_family: Record<string, { score: number; max: number; label: string }>;
  detected_signals: Record<string, any>;
  recommendations: ScanRecommendation[];
  issues: Array<{ family: string; severity: string; key: string; message: string }>;
}

// Mapping famille → sous-objets `detected_signals` à afficher dans la carte.
// Pour `external`, on extrait des sous-clés précises afin que GEO et Robots
// n'affichent que ce qui les concerne.
const FAMILY_ORDER: Array<{ key: string; pickFrom: 'root' | 'external'; keys: string[] }> = [
  { key: 'meta', pickFrom: 'root', keys: ['meta', 'htmlLang'] },
  { key: 'canonical', pickFrom: 'root', keys: ['links'] },
  { key: 'opengraph', pickFrom: 'root', keys: ['openGraph'] },
  { key: 'twitter', pickFrom: 'root', keys: ['twitterCard'] },
  { key: 'schema', pickFrom: 'root', keys: ['schemaOrg', 'microdata', 'rdfa'] },
  { key: 'robots', pickFrom: 'external', keys: ['robotsTxt', 'sitemapXml'] },
  { key: 'geo', pickFrom: 'external', keys: ['llmsTxt', 'aiTxt', 'aiPlugin'] },
  { key: 'security', pickFrom: 'root', keys: ['httpHeaders'] },
];

export default function MachineLayerScanner() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const { containerRef, token: turnstileToken, isReady, reset } = useTurnstile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Auto-launch via ?url=
  useEffect(() => {
    const q = searchParams.get('url');
    if (q && !result && !loading) setUrl(q);
  }, [searchParams, result, loading]);

  // Auto-launch via ?url= (déclenche un scan dès que Turnstile est prêt ou si l'utilisateur est connecté)
  const autoTriggered = useRef(false);
  useEffect(() => {
    const q = searchParams.get('url');
    if (!q || autoTriggered.current || result || loading) return;
    setUrl(q);
    if (user || isReady) {
      autoTriggered.current = true;
      // Laisser React appliquer setUrl avant le scan
      setTimeout(() => handleScanWith(q), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, result, loading, user, isReady]);

  const handleScanWith = async (targetUrl: string) => {
    if (!targetUrl.trim()) { toast.error('Saisissez une URL.'); return; }
    if (!user && !turnstileToken) { toast.error('Vérification anti-bot en cours…'); return; }

    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('machine-layer-scan', {
        body: { url: targetUrl.trim(), turnstile_token: user ? undefined : turnstileToken },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as ScanResponse);
      toast.success('Scan terminé');
    } catch (err: any) {
      toast.error(err?.message || 'Échec du scan');
      reset();
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    return handleScanWith(url);
  };

  const familyCards = useMemo(() => {
    if (!result) return [];
    return FAMILY_ORDER.map(f => {
      const fam = result.scores_by_family[f.key];
      if (!fam) return null;
      const detected: Record<string, any> = {};
      const source = f.pickFrom === 'external'
        ? (result.detected_signals as any).external || {}
        : (result.detected_signals as any);
      f.keys.forEach(k => {
        const v = source[k];
        if (v != null) detected[k] = v;
      });
      const recos = result.recommendations.filter(r => r.family === f.key);
      return { key: f.key, label: fam.label, score: fam.score, max: fam.max, detected, recommendations: recos };
    }).filter(Boolean) as Array<{ key: string; label: string; score: number; max: number; detected: Record<string, any>; recommendations: ScanRecommendation[] }>;
  }, [result]);

  const handleInjectArchitect = () => {
    if (!result) return;
    const rules = result.recommendations.map(r => ({
      payload_type: r.payload_type,
      url_pattern: r.url_pattern || 'GLOBAL',
      payload_data: { snippet: r.ready_to_paste, family: r.family, key: r.key, title: r.title },
      severity: r.severity,
    }));
    setMachineLayerPreload({
      url: result.url,
      domain: result.domain,
      rules,
      source: 'machine-layer-scanner',
      scan_id: result.id,
      created_at: new Date().toISOString(),
    });

    if (!user) {
      toast.success('Vos correctifs sont prêts. Connectez-vous pour les injecter.');
      navigate('/auth?redirect=/architect-generatif?source=machine-layer');
    } else {
      navigate('/architect-generatif?source=machine-layer');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Machine Layer Scanner — Crawlers.fr | Audit signaux SEO/GEO</title>
        <meta name="description" content="Scannez gratuitement la couche machine de votre site : meta, OpenGraph, JSON-LD, robots.txt, llms.txt, headers HTTP. Recommandations rédigées prêtes à coller." />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href="https://crawlers.fr/app/machine-layer" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Machine Layer Scanner',
          applicationCategory: 'SEOApplication',
          operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
          url: 'https://crawlers.fr/app/machine-layer',
          description: 'Audit gratuit des signaux techniques destinés aux moteurs et aux IA.',
        })}</script>
      </Helmet>

      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-12 sm:py-20">
        {/* Hero */}
        <section className="text-center mb-10">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <ScanLine className="h-3 w-3 mr-1.5" /> Outil gratuit · sans inscription
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Machine Layer Scanner
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Visualisez ce que les moteurs et les IA <em>voient vraiment</em> de votre site :
            balises, OpenGraph, JSON-LD, <code className="text-sm">robots.txt</code>, <code className="text-sm">llms.txt</code>, headers HTTP.
            Avec les correctifs rédigés, prêts à coller.
          </p>
        </section>

        {/* Form */}
        <Card className="p-6 sm:p-8 mb-8 border-border/60 bg-card/40 backdrop-blur-sm">
          <form onSubmit={handleScan} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="https://votre-site.com"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="pl-10 h-12 text-base"
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={loading || (!user && !isReady)}
                className="h-12 px-6"
                variant="outline"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scan en cours…</>
                ) : (
                  <><ScanLine className="h-4 w-4 mr-2" /> Lancer le scan</>
                )}
              </Button>
            </div>
            {!user && (
              <div ref={containerRef} className="flex justify-center min-h-[65px]" />
            )}
          </form>
        </Card>

        {/* Results */}
        {result && (
          <section className="space-y-6 animate-fade-in">
            {/* Score global */}
            <Card className="p-6 sm:p-8 border-border/60 bg-card/40 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <GeoScoreGauge score={result.score_global} />
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-bold mb-2">{result.domain}</h2>
                  <p className="text-sm text-muted-foreground mb-3 break-all">{result.url}</p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <Badge variant="outline">
                      <Eye className="h-3 w-3 mr-1" /> Rendu : {result.rendered_via}
                    </Badge>
                    <Badge variant="outline">
                      {result.recommendations.length} recommandation{result.recommendations.length > 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="outline">
                      {result.issues.filter(i => i.severity === 'critical').length} critique{result.issues.filter(i => i.severity === 'critical').length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Family cards */}
            <div className="space-y-3">
              {familyCards.map(c => (
                <SignalCard
                  key={c.key}
                  family={c.key}
                  label={c.label}
                  score={c.score}
                  max={c.max}
                  detected={c.detected}
                  recommendations={c.recommendations}
                />
              ))}
            </div>

            {/* CTA Architect */}
            <Card className="p-6 sm:p-8 border-primary/40 bg-gradient-to-br from-primary/5 to-accent/5">
              <div className="flex flex-col items-center text-center gap-4">
                <Sparkles className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-bold">Injecter directement dans mon site</h3>
                <p className="text-sm text-muted-foreground max-w-xl">
                  {user
                    ? 'Ouvrez Code Architect avec vos correctifs déjà pré-chargés et déployez-les en un clic.'
                    : 'Créez un compte gratuit pour ouvrir Code Architect avec vos correctifs déjà pré-chargés.'}
                </p>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleInjectArchitect}
                  disabled={result.recommendations.length === 0}
                >
                  {user ? 'Ouvrir Code Architect' : 'Créer mon compte et injecter'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* Empty state info */}
        {!result && !loading && (
          <Card className="p-6 sm:p-8 border-border/40 bg-card/20">
            <h3 className="font-semibold mb-3">Que vais-je obtenir ?</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>· Score global 0-100 et sous-scores par famille (méta, OpenGraph, JSON-LD, robots/sitemap, GEO, sécurité…)</li>
              <li>· Liste exhaustive des signaux machine détectés sur la page</li>
              <li>· Détection des éléments manquants ou mal rédigés</li>
              <li>· Recommandations rédigées, prêtes à coller dans votre <code className="text-xs">&lt;head&gt;</code></li>
              <li>· Vérification de <code className="text-xs">robots.txt</code>, <code className="text-xs">sitemap.xml</code>, <code className="text-xs">llms.txt</code>, <code className="text-xs">ai.txt</code> et <code className="text-xs">/.well-known/*</code></li>
            </ul>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
