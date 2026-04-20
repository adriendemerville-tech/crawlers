import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, ShieldAlert, EyeOff, ShieldQuestion, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ReliabilityKPIs {
  total: number;
  verified: number;
  suspect: number;
  stealth: number;
  unverified: number;
  topImpostors: Array<{ bot_name: string; count: number }>;
}

interface Props {
  siteIds: string[];
  /** ISO date — fenêtre de calcul, défaut 7 jours */
  sinceISO?: string;
}

export function ReliabilityWidget({ siteIds, sinceISO }: Props) {
  const [kpis, setKpis] = useState<ReliabilityKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (siteIds.length === 0) {
        setKpis({ total: 0, verified: 0, suspect: 0, stealth: 0, unverified: 0, topImpostors: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      const since = sinceISO || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('log_entries')
        .select('verification_status, bot_name')
        .in('tracked_site_id', siteIds)
        .eq('is_bot', true)
        .gte('ts', since)
        .limit(5000);

      if (cancelled) return;
      const rows = (data as Array<{ verification_status: string | null; bot_name: string | null }>) || [];

      const buckets = { verified: 0, suspect: 0, stealth: 0, unverified: 0 };
      const impostorMap = new Map<string, number>();
      for (const r of rows) {
        const k = (r.verification_status || 'unverified') as keyof typeof buckets;
        if (k in buckets) buckets[k]++;
        // Top usurpateurs = bots déclarés (UA) mais pas vérifiés
        if ((r.verification_status === 'suspect' || r.verification_status === 'stealth') && r.bot_name) {
          impostorMap.set(r.bot_name, (impostorMap.get(r.bot_name) || 0) + 1);
        }
      }
      const topImpostors = [...impostorMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([bot_name, count]) => ({ bot_name, count }));

      setKpis({ total: rows.length, ...buckets, topImpostors });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [siteIds.join(','), sinceISO]);

  if (loading || !kpis) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-sm text-muted-foreground">Chargement de la fiabilité…</CardContent>
      </Card>
    );
  }

  const total = kpis.total || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const trustScore = pct(kpis.verified);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Fiabilité de la détection
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/70 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  Indice basé sur la vérification croisée rDNS + plages IP officielles + User-Agent.
                  Un bot est <strong>Vérifié</strong> si son identité réseau correspond à un crawler officiel.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="ml-auto text-xs font-normal text-muted-foreground">7 derniers jours</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trust score */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-2xl font-bold tabular-nums">{trustScore}%</span>
            <span className="text-xs text-muted-foreground">{kpis.total} hits analysés</span>
          </div>
          <Progress value={trustScore} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground mt-1">
            Part des bots dont l'identité réseau a été confirmée
          </p>
        </div>

        {/* Buckets */}
        <div className="grid grid-cols-2 gap-2">
          <BucketRow icon={ShieldCheck} label="Vérifiés"    count={kpis.verified}    pct={pct(kpis.verified)}    tone="emerald" />
          <BucketRow icon={ShieldAlert} label="Suspects"    count={kpis.suspect}     pct={pct(kpis.suspect)}     tone="amber" />
          <BucketRow icon={EyeOff}      label="Furtifs"     count={kpis.stealth}     pct={pct(kpis.stealth)}     tone="rose" />
          <BucketRow icon={ShieldQuestion} label="En attente" count={kpis.unverified} pct={pct(kpis.unverified)} tone="muted" />
        </div>

        {/* Top usurpateurs */}
        {kpis.topImpostors.length > 0 && (
          <div className="pt-2 border-t border-border/30">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Top usurpations détectées</p>
            <div className="space-y-1">
              {kpis.topImpostors.map(i => (
                <div key={i.bot_name} className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate">{i.bot_name}</span>
                  <span className="text-muted-foreground tabular-nums">{i.count} hits</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              Ces User-Agents se présentent comme des bots officiels sans validation rDNS — probablement des scrapers.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TONE_MAP = {
  emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
  amber:   'border-amber-500/30 bg-amber-500/5 text-amber-600',
  rose:    'border-rose-500/30 bg-rose-500/5 text-rose-600',
  muted:   'border-border/40 bg-muted/30 text-muted-foreground',
} as const;

function BucketRow({
  icon: Icon, label, count, pct, tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  count: number;
  pct: number;
  tone: keyof typeof TONE_MAP;
}) {
  return (
    <div className={cn('rounded-md border px-2.5 py-1.5 flex items-center gap-2', TONE_MAP[tone])}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-tight">{label}</p>
        <p className="text-[10px] opacity-70 leading-tight">{count} • {pct}%</p>
      </div>
    </div>
  );
}
