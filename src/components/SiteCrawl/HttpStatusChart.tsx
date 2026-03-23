import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PageData {
  http_status: number | null;
}

interface HttpStatusChartProps {
  pages: PageData[];
  language: string;
}

const STATUS_COLORS: Record<string, string> = {
  '200': '#10b981',
  '2xx': '#34d399',
  '3xx': '#f59e0b',
  '4xx': '#ef4444',
  '5xx': '#dc2626',
  'unknown': '#6b7280',
};

const STATUS_LABELS: Record<string, Record<string, string>> = {
  fr: {
    '200': '200 OK',
    '2xx': 'Autres succès (2xx)',
    '3xx': 'Redirection (3xx)',
    '4xx': 'Erreur client (4xx)',
    '5xx': 'Erreur serveur (5xx)',
    'unknown': 'Inconnu',
    title: 'Codes de réponse HTTP',
  },
  en: {
    '200': '200 OK',
    '2xx': 'Other Success (2xx)',
    '3xx': 'Redirect (3xx)',
    '4xx': 'Client Error (4xx)',
    '5xx': 'Server Error (5xx)',
    'unknown': 'Unknown',
    title: 'HTTP Response Codes',
  },
  es: {
    '200': '200 OK',
    '2xx': 'Otros éxitos (2xx)',
    '3xx': 'Redirección (3xx)',
    '4xx': 'Error cliente (4xx)',
    '5xx': 'Error servidor (5xx)',
    'unknown': 'Desconocido',
    title: 'Códigos de respuesta HTTP',
  },
};

function getStatusGroup(status: number | null): string {
  if (!status) return 'unknown';
  if (status === 200) return '200';
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500) return '5xx';
  return 'unknown';
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }: any) => {
  if (percent < 0.04) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {value}
    </text>
  );
};

export function HttpStatusChart({ pages, language }: HttpStatusChartProps) {
  const labels = STATUS_LABELS[language] || STATUS_LABELS.fr;

  const chartData = useMemo(() => {
    const groups: Record<string, number> = {};
    pages.forEach(p => {
      const group = getStatusGroup(p.http_status);
      groups[group] = (groups[group] || 0) + 1;
    });

    return ['200', '2xx', '3xx', '4xx', '5xx', 'unknown']
      .filter(k => groups[k] > 0)
      .map(k => ({
        name: labels[k],
        value: groups[k],
        key: k,
        pct: ((groups[k] / pages.length) * 100).toFixed(1),
      }));
  }, [pages, labels]);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          🌐 {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-2">
            {chartData.map(d => (
              <div key={d.key} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[d.key] }}
                />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-semibold text-foreground ml-auto tabular-nums">{d.value} ({d.pct}%)</span>
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {chartData.map(d => (
                    <Cell key={d.key} fill={STATUS_COLORS[d.key]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} (${((value / pages.length) * 100).toFixed(1)}%)`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
