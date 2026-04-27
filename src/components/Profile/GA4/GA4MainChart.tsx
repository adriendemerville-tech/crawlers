import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceDot,
  Legend,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChartMetric, GA4SeriesPoint, GA4Anomaly } from './types';

interface Props {
  series: GA4SeriesPoint[];
  byPage?: Record<string, GA4SeriesPoint[]>;
  compareSeries?: GA4SeriesPoint[];
  anomalies?: GA4Anomaly[];
  loading?: boolean;
}

const METRICS: { value: ChartMetric; label: string; color: string }[] = [
  { value: 'sessions', label: 'Sessions', color: 'hsl(45 95% 50%)' /* jaune d'or */ },
  { value: 'users', label: 'Utilisateurs', color: 'hsl(265 70% 55%)' /* violet */ },
  { value: 'pageviews', label: 'Pages vues', color: 'hsl(0 0% 30%)' /* gris foncé */ },
  { value: 'avg_engagement_time', label: 'Tps engagement', color: 'hsl(45 95% 50%)' },
  { value: 'engagement_rate', label: 'Taux engagement', color: 'hsl(265 70% 55%)' },
];

const PAGE_COLORS = [
  'hsl(45 95% 50%)',
  'hsl(265 70% 55%)',
  'hsl(155 60% 45%)',
  'hsl(15 85% 55%)',
  'hsl(200 70% 50%)',
  'hsl(330 70% 55%)',
  'hsl(95 50% 45%)',
];

function formatTickDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function formatYValue(v: number, metric: ChartMetric) {
  if (metric === 'avg_engagement_time') {
    if (v >= 60) return `${Math.round(v / 60)}m`;
    return `${Math.round(v)}s`;
  }
  if (metric === 'engagement_rate') return `${(v * 100).toFixed(0)}%`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export function GA4MainChart({ series, byPage, compareSeries, anomalies, loading }: Props) {
  const [metric, setMetric] = useState<ChartMetric>('sessions');

  const data = useMemo(() => {
    // Merge site series + per-page series + compare into one row per date
    const map = new Map<string, any>();
    for (const p of series) {
      map.set(p.date, { date: p.date, _site: (p as any)[metric] ?? 0 });
    }
    if (compareSeries) {
      // Align compare series by ordinal index, label as _compare
      compareSeries.forEach((p, i) => {
        const base = series[i]?.date || p.date;
        const cur = map.get(base) || { date: base };
        cur._compare = (p as any)[metric] ?? 0;
        map.set(base, cur);
      });
    }
    if (byPage) {
      for (const [path, points] of Object.entries(byPage)) {
        for (const p of points) {
          const cur = map.get(p.date) || { date: p.date };
          cur[`page::${path}`] = (p as any)[metric] ?? 0;
          map.set(p.date, cur);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [series, byPage, compareSeries, metric]);

  const pagePaths = byPage ? Object.keys(byPage) : [];
  const activeMetric = METRICS.find((m) => m.value === metric)!;

  const anomalyDots = useMemo(() => {
    if (!anomalies || metric === 'avg_engagement_time' || metric === 'engagement_rate') return [];
    return anomalies.filter((a) => a.metric === (metric as any));
  }, [anomalies, metric]);

  if (loading) {
    return <Card className="h-[360px] animate-pulse bg-muted/40" />;
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {METRICS.map((m) => (
          <Button
            key={m.value}
            variant="outline"
            size="sm"
            className={cn(
              'h-7 px-2.5 text-[11px]',
              metric === m.value && 'border-foreground/60 bg-foreground/5',
            )}
            onClick={() => setMetric(m.value)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="date" tickFormatter={formatTickDate} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={(v) => formatYValue(v, metric)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              formatter={(v: any, name: any) => [formatYValue(v, metric), name === '_site' ? activeMetric.label : name === '_compare' ? `${activeMetric.label} N-1` : String(name).replace('page::', '')]}
            />
            {pagePaths.length === 0 && (
              <Line
                type="monotone"
                dataKey="_site"
                stroke={activeMetric.color}
                strokeWidth={2}
                dot={false}
                name="_site"
              />
            )}
            {pagePaths.map((path, i) => (
              <Line
                key={path}
                type="monotone"
                dataKey={`page::${path}`}
                stroke={PAGE_COLORS[i % PAGE_COLORS.length]}
                strokeWidth={1.8}
                dot={false}
                name={path}
              />
            ))}
            {compareSeries && (
              <Line
                type="monotone"
                dataKey="_compare"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                name="_compare"
              />
            )}
            {anomalyDots.map((a, i) => (
              <ReferenceDot
                key={`${a.date}-${i}`}
                x={a.date}
                y={a.value}
                r={5}
                fill={a.direction === 'up' ? 'hsl(155 60% 45%)' : 'hsl(0 75% 55%)'}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
            {pagePaths.length > 0 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {anomalyDots.length > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {anomalyDots.length} anomalie{anomalyDots.length > 1 ? 's' : ''} détectée{anomalyDots.length > 1 ? 's' : ''} (z-score ≥ 2 sur 14 jours).
        </div>
      )}
    </Card>
  );
}
