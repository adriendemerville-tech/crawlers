import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Calendar, TrendingUp } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

type SignupPoint = { date: string; count: number };
type ReportTypePoint = { type: string; count: number };

export default function AnalyticsCharts({
  recentSignups,
  reportsByType,
}: {
  recentSignups: SignupPoint[];
  reportsByType: ReportTypePoint[];
}) {
  const chartConfig = {
    count: {
      label: 'Inscriptions',
      color: 'hsl(var(--primary))',
    },
  };

  const barChartConfig = {
    count: {
      label: 'Rapports',
      color: 'hsl(var(--chart-1))',
    },
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Signups Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Inscriptions (30 jours)
          </CardTitle>
          <CardDescription>Nouvelles inscriptions par jour</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSignups.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <AreaChart data={recentSignups} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Aucune inscription récente
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports by Type Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Rapports par type
          </CardTitle>
          <CardDescription>Distribution des rapports sauvegardés</CardDescription>
        </CardHeader>
        <CardContent>
          {reportsByType.length > 0 ? (
            <ChartContainer config={barChartConfig} className="h-[200px] w-full">
              <BarChart data={reportsByType} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Aucun rapport sauvegardé
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
