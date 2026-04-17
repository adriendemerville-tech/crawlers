/**
 * AICrawlActivityCard — activité des bots IA (30 derniers jours).
 * Source : table bot_hits filtrée sur is_ai_bot = true.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot } from 'lucide-react';
import { MethodologyTooltip } from './MethodologyTooltip';

interface AICrawlActivityCardProps {
  trackedSiteId: string;
}

interface BotHitRow {
  bot_family: string | null;
  bot_name: string | null;
  hit_at: string;
}

export function AICrawlActivityCard({ trackedSiteId }: AICrawlActivityCardProps) {
  const [rows, setRows] = useState<BotHitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    supabase
      .from('bot_hits')
      .select('bot_family, bot_name, hit_at')
      .eq('tracked_site_id', trackedSiteId)
      .eq('is_ai_bot', true)
      .gte('hit_at', since)
      .order('hit_at', { ascending: false })
      .limit(5000)
      .then(({ data }) => {
        setRows((data as BotHitRow[]) ?? []);
        setLoading(false);
      });
  }, [trackedSiteId]);

  const total = rows.length;
  const byFamily = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.bot_family ?? r.bot_name ?? 'inconnu';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(byFamily).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Activité des bots IA (30j)
          </span>
          <MethodologyTooltip
            label="Méthode"
            title="Détection des bots IA"
            body={
              <>
                <p>
                  Chaque requête est qualifiée par son <strong>User-Agent</strong> et son IP. Les bots reconnus (GPTBot,
                  ClaudeBot, PerplexityBot, Google-Extended, etc.) sont marqués <code>is_ai_bot = true</code>.
                </p>
                <p>
                  Les comptages affichés ici proviennent de la table <code>bot_hits</code> et sont rafraîchis en temps
                  réel par le Worker Cloudflare.
                </p>
              </>
            }
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="rounded-md border border-primary/30 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Total visites bots IA</p>
              <p className="text-2xl font-bold text-foreground">{total.toLocaleString()}</p>
            </div>
            {top.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun crawl IA détecté sur la période.</p>
            ) : (
              <ul className="space-y-1.5">
                {top.map(([family, count]) => {
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <li key={family} className="text-xs">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="font-mono text-foreground">{family}</span>
                        <span className="text-muted-foreground">
                          {count} <span className="text-[10px]">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
