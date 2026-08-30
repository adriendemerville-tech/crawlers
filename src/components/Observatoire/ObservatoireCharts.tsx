// Graphiques Recharts de l'Observatoire, isolés dans un module chargé
// dynamiquement côté client uniquement (hors graphe SSR).
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
} as const;

export function PerfAreaChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="gLoad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gTtfb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gFcp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gLcp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} unit="ms" />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => {
            const labels: Record<string, string> = { avgLoadTime: 'Load Time', avgTtfb: 'TTFB', avgFcp: 'FCP', avgLcp: 'LCP' };
            return [`${value} ms`, labels[name] || name];
          }}
        />
        <Legend />
        <Area type="monotone" dataKey="avgLoadTime" name="Load Time" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gLoad)" />
        <Area type="monotone" dataKey="avgTtfb" name="TTFB" stroke="#f59e0b" strokeWidth={2} fill="url(#gTtfb)" />
        <Area type="monotone" dataKey="avgFcp" name="FCP" stroke="#10b981" strokeWidth={2} fill="url(#gFcp)" />
        <Area type="monotone" dataKey="avgLcp" name="LCP" stroke="#ef4444" strokeWidth={2} fill="url(#gLcp)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SectorRadarChart({ data, sectors }: { data: any[]; sectors: string[] }) {
  const radarColors = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  return (
    <ResponsiveContainer width="100%" height={360}>
      <RadarChart data={data}>
        <PolarGrid className="stroke-border" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
        {sectors.map((sec, i) => (
          <Radar key={sec} name={sec.charAt(0).toUpperCase() + sec.slice(1)} dataKey={sec}
            stroke={radarColors[i % radarColors.length]} fill={radarColors[i % radarColors.length]}
            fillOpacity={0.15} strokeWidth={2} />
        ))}
        <Legend />
        <Tooltip contentStyle={tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function SectorTrendBarChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} domain={[0, 100]} unit="%" />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        <Bar dataKey="json_ld_rate" name="JSON-LD" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="https_rate" name="HTTPS" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="schema_org_rate" name="Schema.org" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="avg_seo_score" name="Score SEO" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
