/**
 * AIAttributionCard — visites humaines attribuées aux moteurs IA (30j).
 * Source : edge function geo-attribution-summary (qui agrège ai_attribution_events).
 *
 * Modèle : multi-touch pondéré, fenêtre stricte 30 jours, fingerprint anonymisé.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, ExternalLink } from 'lucide-react';
import { MethodologyTooltip } from './MethodologyTooltip';
import { edgeFunctionUrl } from '@/utils/supabaseUrl';

interface AIAttributionCardProps {
  trackedSiteId: string;
}

interface AttributionSummary {
  ok: boolean;
  domain: string;
  window_days: number;
  total: number;
  by_source: Record<string, number>;
  top_urls: Array<{ path: string; count: number }>;
  timeline: Array<{ date: string; count: number }>;
}

const SOURCE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  copilot: 'Copilot',
  you: 'You.com',
  bing_chat: 'Bing Chat',
  other_ai: 'Autres IA',
};

export function AIAttributionCard({ trackedSiteId }: AIAttributionCardProps) {
  const [data, setData] = useState<AttributionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) throw new Error('Non authentifié');
        const url = `${edgeFunctionUrl('geo-attribution-summary')}?tracked_site_id=${trackedSiteId}&days=30`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const json = (await res.json()) as AttributionSummary;
        if (!cancelled) {
          if (!json.ok) throw new Error('Erreur edge');
          setData(json);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [trackedSiteId]);

  const sources = data ? Object.entries(data.by_source).sort((a, b) => b[1] - a[1]) : [];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Attribution IA → visites humaines (30j)
          </span>
          <MethodologyTooltip
            label="Méthode"
            title="Attribution multi-touch pondérée — 30 jours strict"
            body={
              <>
                <p>
                  Lorsqu'un humain visite votre site avec un <strong>referer</strong> ChatGPT, Claude, Perplexity… nous
                  recherchons les visites bots IA précédentes sur la <strong>même URL</strong> dans une fenêtre stricte
                  de <strong>30 jours</strong>.
                </p>
                <p>
                  La pondération suit une décroissance exponentielle : <code>poids = exp(-jours / 15)</code>. Plus le
                  crawl bot est récent, plus son crédit d'attribution est élevé. Le bot le plus pondéré est marqué
                  <code> top_attributed_bot</code>.
                </p>
                <p>
                  Aucune donnée personnelle : seul un <strong>fingerprint anonymisé</strong> (SHA-256 de UA+IP) est
                  utilisé pour dédupliquer les sessions.
                </p>
              </>
            }
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <p className="text-xs text-destructive">Erreur : {error}</p>
        ) : !data || data.total === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucune visite attribuée à un moteur IA sur les 30 derniers jours. La corrélation se déclenche dès qu'un
            visiteur arrive avec un referer IA reconnu.
          </p>
        ) : (
          <>
            <div className="rounded-md border border-primary/30 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Total visites attribuées</p>
              <p className="text-2xl font-bold text-foreground">{data.total.toLocaleString()}</p>
            </div>

            {/* Sources */}
            <div>
              <p className="mb-1.5 text-[10px] uppercase text-muted-foreground">Par moteur IA</p>
              <ul className="space-y-1.5">
                {sources.map(([source, count]) => {
                  const pct = data.total > 0 ? (count / data.total) * 100 : 0;
                  return (
                    <li key={source} className="text-xs">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="font-medium text-foreground">{SOURCE_LABEL[source] ?? source}</span>
                        <span className="text-muted-foreground">
                          {count} <span className="text-[10px]">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Top URLs */}
            {data.top_urls.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] uppercase text-muted-foreground">Top URLs attribuées</p>
                <ul className="space-y-1">
                  {data.top_urls.slice(0, 5).map((u) => (
                    <li
                      key={u.path}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1 text-xs"
                    >
                      <span className="truncate font-mono text-foreground" title={u.path}>
                        {u.path}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{u.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Fenêtre : 30j strict · Modèle : multi-touch pondéré · Mise à jour : toutes les 6h
              <a
                href="/guides/bot-human-correlation"
                className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                en savoir plus <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
