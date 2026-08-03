import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { GA4Source } from './types';

const COLORS = [
  'hsl(45 95% 50%)',
  'hsl(265 70% 55%)',
  'hsl(155 60% 45%)',
  'hsl(15 85% 55%)',
  'hsl(200 70% 50%)',
  'hsl(330 70% 55%)',
  'hsl(95 50% 45%)',
];

interface Props {
  sources?: GA4Source[];
  loading?: boolean;
}

export function GA4TrafficSources({ sources, loading }: Props) {
  if (loading) {
    return (
      <Card className="h-[280px] animate-pulse bg-muted/40 p-4">
        <div className="text-xs font-medium uppercase text-muted-foreground">Sources de trafic</div>
      </Card>
    );
  }

  if (!sources || sources.length === 0) {
    return (
      <Card className="p-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sources de trafic</div>
        <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
          Aucune donnée de source disponible.
        </div>
      </Card>
    );
  }

  const total = sources.reduce((s, x) => s + x.sessions, 0);

  return (
    <Card className="p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sources de trafic</div>
      <div className="flex items-center gap-4">
        <div className="h-[200px] w-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sources}
                dataKey="sessions"
                nameKey="channel"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {sources.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v: any) => [`${v.toLocaleString('fr-FR')} sessions`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {sources.slice(0, 7).map((s, i) => {
            const pct = total > 0 ? (s.sessions / total) * 100 : 0;
            return (
              <div key={s.channel} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="flex-1 truncate">{s.channel}</span>
                <span className="tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                <span className="w-14 text-right font-medium tabular-nums">{s.sessions.toLocaleString('fr-FR')}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
