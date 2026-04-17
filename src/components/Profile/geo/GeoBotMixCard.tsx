/**
 * GeoBotMixCard — répartition des LLMs qui citent la marque,
 * comparable aux benchmarks Senthor (OpenAI 47%, Anthropic 19%, Autres 34%).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot } from 'lucide-react';

interface Props { trackedSiteId: string; }

const PROVIDER_GROUPS: Record<string, string> = {
  'gpt-4o': 'OpenAI',
  'gpt-4': 'OpenAI',
  'gpt-5': 'OpenAI',
  'openai': 'OpenAI',
  'chatgpt': 'OpenAI',
  'claude': 'Anthropic',
  'claude-3': 'Anthropic',
  'claude-3.5': 'Anthropic',
  'anthropic': 'Anthropic',
  'gemini': 'Google',
  'gemini-flash': 'Google',
  'google': 'Google',
  'perplexity': 'Perplexity',
  'mistral': 'Mistral',
};

const COLORS: Record<string, string> = {
  OpenAI: 'bg-emerald-500',
  Anthropic: 'bg-purple-500',
  Google: 'bg-amber-500',
  Perplexity: 'bg-sky-500',
  Mistral: 'bg-rose-500',
  Autres: 'bg-muted-foreground',
};

const BENCHMARK = { OpenAI: 47, Anthropic: 19, Autres: 34 };

export function GeoBotMixCard({ trackedSiteId }: Props) {
  const [mix, setMix] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackedSiteId) return;
    setLoading(true);
    supabase
      .from('geo_kpi_snapshots')
      .select('bot_traffic_mix')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const raw = (data?.bot_traffic_mix as Record<string, number>) || {};
        // Group by provider family
        const grouped: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw)) {
          const lower = k.toLowerCase();
          let family = 'Autres';
          for (const [needle, group] of Object.entries(PROVIDER_GROUPS)) {
            if (lower.includes(needle)) { family = group; break; }
          }
          grouped[family] = (grouped[family] || 0) + v;
        }
        setMix(grouped);
        setLoading(false);
      });
  }, [trackedSiteId]);

  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  const entries = Object.entries(mix).sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Mix de citations par LLM
        </CardTitle>
        <CardDescription>
          Quels moteurs IA vous citent. Benchmark sectoriel : OpenAI {BENCHMARK.OpenAI}%, Anthropic {BENCHMARK.Anthropic}%, Autres {BENCHMARK.Autres}%.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Aucune citation détectée. Lancez le benchmark LLM ci-dessous pour collecter les premières mesures.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Stacked bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {entries.map(([name, count]) => {
                const pct = (count / total) * 100;
                return (
                  <div
                    key={name}
                    className={COLORS[name] || COLORS.Autres}
                    style={{ width: `${pct}%` }}
                    title={`${name}: ${pct.toFixed(0)}%`}
                  />
                );
              })}
            </div>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {entries.map(([name, count]) => {
                const pct = (count / total) * 100;
                const bench = BENCHMARK[name as keyof typeof BENCHMARK];
                const diff = bench != null ? pct - bench : null;
                return (
                  <li key={name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <span className={`h-2 w-2 rounded-full ${COLORS[name] || COLORS.Autres}`} />
                      {name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {pct.toFixed(0)}%
                      {diff !== null && (
                        <span className={diff >= 0 ? 'ml-1 text-emerald-500' : 'ml-1 text-amber-500'}>
                          ({diff > 0 ? '+' : ''}{diff.toFixed(0)})
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
