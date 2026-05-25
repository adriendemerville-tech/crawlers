import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Search, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { normalizeUrl } from '@/hooks/useUrlValidation';

type ScanResult = {
  score: number;
  experience: number;
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
  strengths?: string[];
  missingSignals?: string[];
};

const scoreColor = (n: number) => (n >= 70 ? 'text-amber-500' : n >= 45 ? 'text-foreground' : 'text-destructive');
const scoreLevel = (n: number) => (n >= 70 ? 'Solide' : n >= 45 ? 'Moyen' : 'À risque');

export function QuickEEATTest() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setScanning(true);
    setProgress(0);
    setResult(null);

    try {
      const { data: jobData, error: jobError } = await supabase.functions.invoke('check-eeat', {
        body: { url: trimmed, async: true },
      });
      if (jobError) throw jobError;
      if (!jobData?.job_id) throw new Error('Aucun job_id retourné');

      toast({ title: 'Scan E-E-A-T lancé', description: 'Analyse de la page en cours…' });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollResp = await fetch(`${supabaseUrl}/functions/v1/check-eeat?job_id=${jobData.job_id}`, {
          headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey },
        });
        const pollData = await pollResp.json();
        setProgress(pollData.progress || 0);

        if (pollData.status === 'completed' && pollData.result) {
          const d = pollData.result;
          if (d?.success === false) throw new Error(d.error || 'Impossible de crawler cette URL.');
          setResult({
            score: d.score ?? 0,
            experience: d.experience ?? 0,
            expertise: d.expertise ?? 0,
            authoritativeness: d.authoritativeness ?? 0,
            trustworthiness: d.trustworthiness ?? 0,
            strengths: d.strengths || [],
            missingSignals: d.missingSignals || [],
          });
          toast({ title: 'Scan terminé', description: `Score E-E-A-T : ${d.score ?? '?'}/100` });
          return;
        }
        if (pollData.status === 'failed') throw new Error(pollData.error || 'Scan échoué');
      }
      throw new Error('Délai dépassé. Réessayez dans quelques minutes.');
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const pillars = result
    ? [
        { label: 'Experience', value: result.experience },
        { label: 'Expertise', value: result.expertise },
        { label: 'Authoritativeness', value: result.authoritativeness },
        { label: 'Trustworthiness', value: result.trustworthiness },
      ]
    : [];

  return (
    <section className="py-10 sm:py-14 px-4 border-b border-border/50 bg-gradient-to-b from-primary/5 via-amber-500/5 to-background">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 mb-3 justify-center">
          <Badge variant="outline" className="text-xs uppercase gap-1">
            <Sparkles className="h-3 w-3" /> Scan gratuit
          </Badge>
          <Badge variant="outline" className="text-xs">URL · sans inscription · ~1 min</Badge>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground mb-3">
          Test E-E-A-T instantané : scannez votre URL
        </h2>
        <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
          Obtenez en une minute le score E-E-A-T de n'importe quelle page (Experience, Expertise, Autorité, Confiance)
          calculé par le même moteur que l'audit complet Crawlers.fr.
        </p>

        <Card className="border-2 border-border/60">
          <CardContent className="p-5 sm:p-7">
            <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3">
              <Input
                type="url"
                placeholder="https://votre-site.fr/page"
                value={url}
                onChange={e => setUrl(e.target.value)}
                disabled={scanning}
                required
                className="flex-1"
              />
              <Button
                type="submit"
                size="lg"
                disabled={scanning || !url.trim()}
                className="gap-2 border-2 border-foreground bg-transparent text-foreground hover:bg-foreground/5 disabled:opacity-40"
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scan en cours…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Lancer le scan
                  </>
                )}
              </Button>
            </form>

            {scanning && (
              <div className="mt-5">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Crawl multi-signaux… {progress}%
                </p>
              </div>
            )}

            {result && !scanning && (
              <div className="mt-6 pt-6 border-t border-border/40">
                <div className="text-center mb-6">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Score E-E-A-T</p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className={`text-6xl font-bold ${scoreColor(result.score)}`}>{result.score}</span>
                    <span className="text-2xl text-muted-foreground">/100</span>
                  </div>
                  <p className={`text-lg font-semibold mt-1 ${scoreColor(result.score)}`}>
                    Niveau : {scoreLevel(result.score)}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {pillars.map(p => (
                    <div key={p.label} className="rounded-lg border border-border/60 p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{p.label}</p>
                      <p className={`text-2xl font-bold ${scoreColor(p.value)}`}>{p.value}</p>
                    </div>
                  ))}
                </div>

                {result.missingSignals && result.missingSignals.length > 0 && (
                  <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Signaux manquants détectés ({result.missingSignals.length})
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      {result.missingSignals.slice(0, 3).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                      {result.missingSignals.length > 3 && (
                        <li className="italic">+ {result.missingSignals.length - 3} autres signaux dans l'audit complet</li>
                      )}
                    </ul>
                  </div>
                )}

                <blockquote className="citable-passage border-l-4 border-amber-500 bg-amber-500/5 px-5 py-4 rounded-r-lg mb-6 text-sm text-foreground">
                  Ce scan analyse une page. L'<strong>audit E-E-A-T complet</strong> Crawlers.fr crawle l'ensemble du site,
                  croise GA4, Search Console, backlinks et JSON-LD, et génère un plan d'action priorisé avec sévérité et prime de récence.
                </blockquote>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to={`/auth?mode=signup&source=eeat-url-scan&url=${encodeURIComponent(url)}`}>
                    <Button size="lg" className="gap-2 w-full sm:w-auto border-2 border-foreground bg-transparent text-foreground hover:bg-foreground/5">
                      Lancer l'audit E-E-A-T complet
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => { setResult(null); setUrl(''); setProgress(0); }}
                    className="w-full sm:w-auto"
                  >
                    Scanner une autre URL
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
