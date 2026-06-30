/**
 * BotPrerenderCheck — Test rapide multi-bots
 *
 * Saisit une URL, appelle l'edge function `bot-prerender-check` qui
 * effectue 6 fetch parallèles avec les User-Agents des principaux bots IA
 * (GPTBot, CCBot, Google-Extended, ClaudeBot, Applebot-Extended, PerplexityBot)
 * puis affiche un tableau de résultats (HTTP, prerender, title, h1, JSON-LD…).
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface BotResult {
  bot: string;
  ua: string;
  status: number;
  prerenderBot?: string;
  cfWorker?: string;
  server?: string;
  cfRay?: string;
  title?: string;
  h1?: string;
  jsonLdCount?: number;
  contentLength?: number;
  ms: number;
  error?: string;
}

interface Props {
  defaultUrl?: string;
}

export function BotPrerenderCheck({ defaultUrl = '' }: Props) {
  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BotResult[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const run = async () => {
    if (!url) {
      toast.error('Saisissez une URL à tester.');
      return;
    }
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('bot-prerender-check', {
        body: { url: normalized },
      });
      if (error) throw error;
      setResults(data.results as BotResult[]);
      setCheckedAt(data.checkedAt);
    } catch (e) {
      toast.error(`Test impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const verdict = (r: BotResult) => {
    if (r.error || r.status === 0) return { icon: <XCircle className="h-4 w-4 text-red-500" />, label: 'Erreur', tone: 'text-red-500' };
    if (r.status >= 400) return { icon: <XCircle className="h-4 w-4 text-red-500" />, label: `HTTP ${r.status}`, tone: 'text-red-500' };
    if (r.prerenderBot === '1') return { icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, label: 'Pré-rendu OK', tone: 'text-emerald-500' };
    if (r.title && r.title.length > 0 && (r.jsonLdCount ?? 0) > 0) return { icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, label: 'HTML enrichi', tone: 'text-emerald-500' };
    return { icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, label: 'SPA vide ?', tone: 'text-amber-500' };
  };

  return (
    <Card className="mb-6 border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-primary" />
          Test rapide multi-bots
        </CardTitle>
        <CardDescription>
          Vérifie en parallèle ce que reçoivent GPTBot, CCBot, Google-Extended, ClaudeBot, Applebot-Extended et PerplexityBot sur une URL donnée.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="https://votre-site.fr/page-a-tester"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
            disabled={loading}
          />
          <Button
            variant="outline"
            onClick={run}
            disabled={loading}
            className="border-2"
          >
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Test en cours…</> : 'Lancer le test'}
          </Button>
        </div>

        {results && (
          <div className="space-y-3">
            {checkedAt && (
              <p className="text-xs text-muted-foreground">
                Testé le {new Date(checkedAt).toLocaleString('fr-FR')}
              </p>
            )}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Bot</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium">Pré-rendu</th>
                    <th className="px-3 py-2 font-medium">Title servi</th>
                    <th className="px-3 py-2 font-medium">JSON-LD</th>
                    <th className="px-3 py-2 font-medium">Poids</th>
                    <th className="px-3 py-2 font-medium">Latence</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const v = verdict(r);
                    return (
                      <tr key={r.bot} className="border-t">
                        <td className="px-3 py-2 font-mono">{r.bot}</td>
                        <td className={`px-3 py-2 ${v.tone}`}>
                          <span className="inline-flex items-center gap-1.5">{v.icon}{v.label}</span>
                        </td>
                        <td className="px-3 py-2">
                          {r.prerenderBot === '1'
                            ? <Badge variant="outline" className="border-emerald-500 text-emerald-500">x-prerender-bot</Badge>
                            : <span className="text-muted-foreground">—</span>}
                          {r.cfWorker ? <Badge variant="outline" className="ml-1">{r.cfWorker}</Badge> : null}
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate" title={r.title || ''}>{r.title || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2">{r.jsonLdCount ?? 0}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.contentLength ? `${(r.contentLength / 1024).toFixed(1)} Ko` : '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.ms} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Pré-rendu OK</strong> = en-tête <code>x-prerender-bot: 1</code> renvoyé par le Worker → le bot reçoit le HTML enrichi.
              <strong className="ml-2">SPA vide ?</strong> = aucune balise <code>title</code>/JSON-LD détectée, le bot ne voit que la coquille React.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
