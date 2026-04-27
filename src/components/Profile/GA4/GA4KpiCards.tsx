import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GA4Totals } from './types';

interface Props {
  totals?: GA4Totals;
  compareTotals?: GA4Totals;
  avgEngagementTime?: number;
  avgEngagementRate?: number;
  loading?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('fr-FR');
}

function delta(current: number, previous: number): { pct: number; dir: 'up' | 'down' | 'flat' } | null {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { pct, dir: 'flat' };
  return { pct, dir: pct > 0 ? 'up' : 'down' };
}

function KpiCard({ label, value, sub, change }: { label: string; value: string; sub?: string; change?: { pct: number; dir: 'up' | 'down' | 'flat' } | null }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      {change && (
        <div
          className={cn(
            'mt-1 inline-flex items-center gap-1 text-[11px] font-medium',
            change.dir === 'up' && 'text-emerald-500',
            change.dir === 'down' && 'text-red-500',
            change.dir === 'flat' && 'text-muted-foreground',
          )}
        >
          {change.dir === 'up' && <TrendingUp className="h-3 w-3" />}
          {change.dir === 'down' && <TrendingDown className="h-3 w-3" />}
          {change.dir === 'flat' && <Minus className="h-3 w-3" />}
          {change.pct > 0 ? '+' : ''}
          {change.pct.toFixed(1)}% vs N-1
        </div>
      )}
    </Card>
  );
}

export function GA4KpiCards({ totals, compareTotals, avgEngagementTime, avgEngagementRate, loading }: Props) {
  if (loading || !totals) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-[80px] animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard
        label="Sessions"
        value={formatNumber(totals.sessions)}
        change={compareTotals ? delta(totals.sessions, compareTotals.sessions) : null}
      />
      <KpiCard
        label="Utilisateurs"
        value={formatNumber(totals.users)}
        change={compareTotals ? delta(totals.users, compareTotals.users) : null}
      />
      <KpiCard
        label="Pages vues"
        value={formatNumber(totals.pageviews)}
        change={compareTotals ? delta(totals.pageviews, compareTotals.pageviews) : null}
      />
      <KpiCard
        label="Engagement moyen"
        value={formatDuration(avgEngagementTime || 0)}
        sub={avgEngagementRate ? `${(avgEngagementRate * 100).toFixed(0)}% engagés` : undefined}
      />
    </div>
  );
}
