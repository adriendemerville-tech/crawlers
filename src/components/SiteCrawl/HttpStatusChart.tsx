import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';

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
    '2xx': 'Autres 2xx',
    '3xx': 'Redir. 3xx',
    '4xx': 'Err. 4xx',
    '5xx': 'Err. 5xx',
    'unknown': 'Inconnu',
    title: 'Codes HTTP',
  },
  en: {
    '200': '200 OK',
    '2xx': 'Other 2xx',
    '3xx': 'Redir. 3xx',
    '4xx': 'Err. 4xx',
    '5xx': 'Err. 5xx',
    'unknown': 'Unknown',
    title: 'HTTP Codes',
  },
  es: {
    '200': '200 OK',
    '2xx': 'Otros 2xx',
    '3xx': 'Redir. 3xx',
    '4xx': 'Err. 4xx',
    '5xx': 'Err. 5xx',
    'unknown': 'Desconocido',
    title: 'Códigos HTTP',
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
        pct: ((groups[k] / pages.length) * 100).toFixed(0),
      }));
  }, [pages, labels]);

  if (chartData.length === 0) return null;

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          🌐 {labels.title}
        </p>
        <div className="flex items-center gap-3">
          <div className="w-[72px] h-[72px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={34}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map(d => (
                    <Cell key={d.key} fill={STATUS_COLORS[d.key]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            {chartData.map(d => (
              <div key={d.key} className="flex items-center gap-1.5 text-[11px]">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[d.key] }}
                />
                <span className="text-muted-foreground truncate">{d.name}</span>
                <span className="font-semibold text-foreground ml-auto tabular-nums whitespace-nowrap">{d.value} ({d.pct}%)</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
