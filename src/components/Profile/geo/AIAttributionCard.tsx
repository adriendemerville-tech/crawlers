/**
 * AIAttributionCard — visites humaines attribuées aux moteurs IA.
 * Source : edge function geo-attribution-summary.
 *
 * Modèle : multi-touch pondéré, fingerprint anonymisé.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sparkles, ExternalLink } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MethodologyTooltip } from './MethodologyTooltip';
import { edgeFunctionUrl } from '@/utils/supabaseUrl';

interface AIAttributionCardProps {
  trackedSiteId: string;
}

type Interval = 'day' | 'week' | 'month';
type Period = 'days' | 'weeks' | 'months' | 'year';

interface AttributionSummary {
  ok: boolean;
  domain: string;
  window_days: number;
  interval: Interval;
  total: number;
  by_source: Record<string, number>;
  top_urls: Array<{ path: string; count: number }>;
  timeline_by_source: Array<{ date: string; counts: Record<string, number> }>;
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

const CHART_SOURCES = [
  { key: 'gemini', label: 'Gemini', stroke: 'hsl(var(--brand-gold))', dot: 'bg-brand-gold' },
  { key: 'chatgpt', label: 'ChatGPT', stroke: 'hsl(var(--brand-violet))', dot: 'bg-brand-violet' },
  { key: 'copilot', label: 'Copilot', stroke: 'hsl(var(--foreground))', dot: 'bg-foreground' },
  { key: 'claude', label: 'Claude', stroke: 'hsl(var(--muted-foreground))', dot: 'bg-muted-foreground' },
] as const;

const PERIODS: Array<{ value: Period; label: string; days: number }> = [
  { value: 'days', label: '30 jours', days: 30 },
  { value: 'weeks', label: '12 semaines', days: 84 },
  { value: 'months', label: '12 mois', days: 365 },
  { value: 'year', label: '1 an', days: 365 },
];

const INTERVALS: Array<{ value: Interval; label: string }> = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
];

function formatDate(value: string, interval: Interval): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('fr-FR', interval === 'month'
    ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
    : { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(date);
}

export function AIAttributionCard({ trackedSiteId }: AIAttributionCardProps) {
  const [data, setData] = useState<AttributionSummary | null>(null);
  const [period, setPeriod] = useState<Period>('days');
  const [interval, setInterval] = useState<Interval>('day');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedPeriod = PERIODS.find((item) => item.value === period) ?? PERIODS[0];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) throw new Error('Non authentifié');
        const url = `${edgeFunctionUrl('geo-attribution-summary')}?tracked_site_id=${encodeURIComponent(trackedSiteId)}&days=${selectedPeriod.days}&interval=${interval}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const json = (await res.json()) as AttributionSummary & { error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? 'Erreur lors du chargement');
        if (!cancelled) setData(json);
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
  }, [trackedSiteId, selectedPeriod.days, interval]);

  const sources = data ? Object.entries(data.by_source).sort((a, b) => b[1] - a[1]) : [];
  const chartData = data?.timeline_by_source.map((point) => ({
    date: point.date,
    ...CHART_SOURCES.reduce<Record<string, number>>((acc, source) => {
      acc[source.key] = point.counts[source.key] ?? 0;
      return acc;
    }, {}),
  })) ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Attribution IA → visites humaines
          </span>
          <MethodologyTooltip
            label="Méthode"
            title="Attribution multi-touch pondérée"
            body={
              <>
                <p>
                  Lorsqu'un humain visite votre site avec un <strong>referer</strong> ChatGPT, Claude, Perplexity… nous
                  recherchons les visites bots IA précédentes sur la <strong>même URL</strong>.
                </p>
                <p>
                  La pondération suit une décroissance exponentielle : <code>poids = exp(-jours / 15)</code>. Aucune
                  donnée personnelle n'est conservée : seul un <strong>fingerprint anonymisé</strong> est utilisé pour
                  dédupliquer les sessions.
                </p>
              </>
            }
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : error ? (
          <p className="text-xs text-destructive">Erreur : {error}</p>
        ) : !data ? (
          <p className="text-xs text-muted-foreground">Les visites attribuées sont momentanément indisponibles.</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-md border border-border/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Visites depuis les IA</p>
                  <p className="text-2xl font-bold text-foreground">{data.total.toLocaleString()}</p>
                </div>
                <div className="text-right text-[10px] text-muted-foreground">
                  <p>{selectedPeriod.label}</p>
                  <p>par {INTERVALS.find((item) => item.value === interval)?.label.toLowerCase()}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Période du graphique">
                {PERIODS.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={period === item.value}
                    onClick={() => setPeriod(item.value)}
                    className={period === item.value ? 'border-primary bg-transparent text-primary' : 'bg-transparent'}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Intervalle du graphique">
                <span className="mr-1 text-[10px] uppercase text-muted-foreground">Intervalle</span>
                {INTERVALS.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={interval === item.value}
                    onClick={() => setInterval(item.value)}
                    className={interval === item.value ? 'border-primary bg-transparent text-primary' : 'bg-transparent'}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div aria-label="Visites IA par moteur" className="space-y-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {CHART_SOURCES.map((source) => (
                  <span key={source.key} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${source.dot}`} />
                    {source.label}
                  </span>
                ))}
              </div>
              <div className="h-56 w-full min-w-0">
                {chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center border-y border-border/50 text-xs text-muted-foreground">
                    Aucune visite attribuée sur cette période.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) => formatDate(value, interval)}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={22}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        width={34}
                      />
                      <Tooltip
                        labelFormatter={(value) => formatDate(String(value), interval)}
                        formatter={(value: number, name: string) => [value, SOURCE_LABEL[name] ?? name]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      />
                      {CHART_SOURCES.map((source) => (
                        <Line
                          key={source.key}
                          type="monotone"
                          dataKey={source.key}
                          name={source.key}
                          stroke={source.stroke}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {data.total > 0 && (
              <>
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

                {data.top_urls.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] uppercase text-muted-foreground">Top URLs attribuées</p>
                    <ul className="space-y-1">
                      {data.top_urls.slice(0, 5).map((u) => (
                        <li
                          key={u.path}
                          className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1 text-xs"
                        >
                          <span className="truncate font-mono text-foreground" title={u.path}>{u.path}</span>
                          <span className="shrink-0 text-muted-foreground">{u.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <p className="text-[10px] text-muted-foreground">
              Attribution multi-touch · empreinte anonymisée · mise à jour toutes les 6h
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
