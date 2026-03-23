import { useMemo } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { ExpertAuditResult } from '@/types/expertAudit';

interface AuditRadialChartProps {
  result: ExpertAuditResult;
  mode: 'technical' | 'strategic';
  language: string;
  inline?: boolean;
}

const COLORS = {
  technical: {
    fill: 'hsl(263, 70%, 50%)',
    stroke: 'hsl(263, 70%, 38%)',
    fillOpacity: 0.25,
  },
  strategic: {
    fill: 'hsl(263, 70%, 50%)',
    stroke: 'hsl(263, 70%, 38%)',
    fillOpacity: 0.25,
  },
};

function getScoreColor(ratio: number): string {
  if (ratio >= 0.8) return 'hsl(var(--primary))';
  if (ratio >= 0.5) return 'hsl(38, 92%, 50%)';
  return 'hsl(0, 84%, 60%)';
}

const labels = {
  fr: {
    performance: 'Performance',
    technical: 'Technique',
    semantic: 'Contenu',
    aiReady: 'IA & GEO',
    security: 'Sécurité',
    citability: 'Citabilité',
    brand: 'Marque',
    social: 'Social',
    market: 'Marché',
    geoReady: 'GEO Ready',
    keywords: 'Mots-clés',
    title: 'Score de qualité',
  },
  en: {
    performance: 'Performance',
    technical: 'Technical',
    semantic: 'Content',
    aiReady: 'AI & GEO',
    security: 'Security',
    citability: 'Citability',
    brand: 'Brand',
    social: 'Social',
    market: 'Market',
    geoReady: 'GEO Ready',
    keywords: 'Keywords',
    title: 'Quality Score',
  },
  es: {
    performance: 'Rendimiento',
    technical: 'Técnico',
    semantic: 'Contenido',
    aiReady: 'IA & GEO',
    security: 'Seguridad',
    citability: 'Citabilidad',
    brand: 'Marca',
    social: 'Social',
    market: 'Mercado',
    geoReady: 'GEO Ready',
    keywords: 'Palabras clave',
    title: 'Puntuación de calidad',
  },
};

export function AuditRadialChart({ result, mode, language, inline = false }: AuditRadialChartProps) {
  const t = labels[language as keyof typeof labels] || labels.fr;
  const colors = COLORS[mode];

  const { data, totalScore, maxScore } = useMemo(() => {
    const scores = result.scores;
    const strategic = result.strategicAnalysis;

    type ChartItem = { name: string; value: number; raw: number; max: number };

    if (mode === 'technical') {
      const items: ChartItem[] = [
        { name: t.performance, value: Math.round((scores.performance.score / scores.performance.maxScore) * 100), raw: scores.performance.score, max: scores.performance.maxScore },
        { name: t.technical, value: Math.round((scores.technical.score / scores.technical.maxScore) * 100), raw: scores.technical.score, max: scores.technical.maxScore },
        { name: t.semantic, value: Math.round((scores.semantic.score / scores.semantic.maxScore) * 100), raw: scores.semantic.score, max: scores.semantic.maxScore },
        { name: t.aiReady, value: Math.round((scores.aiReady.score / scores.aiReady.maxScore) * 100), raw: scores.aiReady.score, max: scores.aiReady.maxScore },
        { name: t.security, value: Math.round((scores.security.score / scores.security.maxScore) * 100), raw: scores.security.score, max: scores.security.maxScore },
      ];
      const total = scores.performance.score + scores.technical.score + scores.semantic.score + scores.aiReady.score + scores.security.score;
      return { data: items, totalScore: total, maxScore: 200 };
    }

    // Strategic mode: combine technical + strategic metrics
    const items: ChartItem[] = [
      { name: t.performance, value: Math.round((scores.performance.score / scores.performance.maxScore) * 100), raw: scores.performance.score, max: scores.performance.maxScore },
      { name: t.semantic, value: Math.round((scores.semantic.score / scores.semantic.maxScore) * 100), raw: scores.semantic.score, max: scores.semantic.maxScore },
      { name: t.aiReady, value: Math.round((scores.aiReady.score / scores.aiReady.maxScore) * 100), raw: scores.aiReady.score, max: scores.aiReady.maxScore },
    ];

    // Add GEO readiness if available
    if (strategic?.geo_readiness) {
      const geo = strategic.geo_readiness;
      items.push({ name: t.citability, value: Math.min(100, geo.citability_score || 0), raw: geo.citability_score || 0, max: 100 });
      items.push({ name: t.geoReady, value: Math.min(100, geo.ai_accessibility_score || 0), raw: geo.ai_accessibility_score || 0, max: 100 });
    }

    // Brand authority
    if (strategic?.brand_authority) {
      items.push({ name: t.brand, value: Math.min(100, strategic.brand_authority.thought_leadership_score || 0), raw: strategic.brand_authority.thought_leadership_score || 0, max: 100 });
    }

    // Social signals
    if (strategic?.social_signals?.thought_leadership) {
      const eeat = strategic.social_signals.thought_leadership.eeat_score || 0;
      items.push({ name: t.social, value: Math.min(100, eeat * 10), raw: eeat, max: 10 });
    }

    // Market intelligence
    if (strategic?.market_intelligence?.semantic_gap) {
      items.push({ name: t.market, value: Math.min(100, strategic.market_intelligence.semantic_gap.current_position || 0), raw: strategic.market_intelligence.semantic_gap.current_position || 0, max: 100 });
    }

    const overallScore = strategic?.overallScore || result.totalScore;
    return { data: items, totalScore: overallScore, maxScore: 200 };
  }, [result, mode, t]);

  const scoreRatio = totalScore / maxScore;

  const radarContent = (
    <div style={{ height: inline ? 240 : 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            dataKey="value"
            stroke={colors.stroke}
            fill={colors.fill}
            fillOpacity={colors.fillOpacity}
            strokeWidth={2}
            dot={{ r: 4, fill: colors.stroke, strokeWidth: 0 }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--popover-foreground))',
            }}
            formatter={(value: number, _name: string, entry: any) => {
              const item = entry.payload;
              return [`${item.raw}/${item.max}`, item.name];
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );

  if (inline) {
    return radarContent;
  }

  return (
    <Card className="bg-gradient-to-br from-card via-card to-muted/20 border overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center gap-8">
          {/* Radial Chart */}
          <div className="flex-1 min-w-0">
            {radarContent}
          </div>

          {/* Central Score */}
          <div className="flex flex-col items-center gap-3 shrink-0 pr-4">
            <div className="relative">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke={getScoreColor(scoreRatio)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - scoreRatio)}`}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
                  fontSize="28" fontWeight="700" fill="hsl(var(--foreground))">
                  {totalScore}
                </text>
                <text x="60" y="82" textAnchor="middle"
                  fontSize="11" fill="hsl(var(--muted-foreground))">
                  /{maxScore}
                </text>
              </svg>
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t.title}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Generate SVG HTML for the radial chart (used in PDF/HTML reports)
 */
export function generateRadialChartSVG(
  result: ExpertAuditResult,
  mode: 'technical' | 'strategic',
  language: string
): string {
  const t = labels[language as keyof typeof labels] || labels.fr;
  const scores = result.scores;
  const strategic = result.strategicAnalysis;

  type ChartItem = { name: string; value: number; raw: number; max: number };
  let items: ChartItem[];
  let totalScore: number;

  if (mode === 'technical') {
    items = [
      { name: t.performance, value: Math.round((scores.performance.score / scores.performance.maxScore) * 100), raw: scores.performance.score, max: scores.performance.maxScore },
      { name: t.technical, value: Math.round((scores.technical.score / scores.technical.maxScore) * 100), raw: scores.technical.score, max: scores.technical.maxScore },
      { name: t.semantic, value: Math.round((scores.semantic.score / scores.semantic.maxScore) * 100), raw: scores.semantic.score, max: scores.semantic.maxScore },
      { name: t.aiReady, value: Math.round((scores.aiReady.score / scores.aiReady.maxScore) * 100), raw: scores.aiReady.score, max: scores.aiReady.maxScore },
      { name: t.security, value: Math.round((scores.security.score / scores.security.maxScore) * 100), raw: scores.security.score, max: scores.security.maxScore },
    ];
    totalScore = scores.performance.score + scores.technical.score + scores.semantic.score + scores.aiReady.score + scores.security.score;
  } else {
    items = [
      { name: t.performance, value: Math.round((scores.performance.score / scores.performance.maxScore) * 100), raw: scores.performance.score, max: scores.performance.maxScore },
      { name: t.semantic, value: Math.round((scores.semantic.score / scores.semantic.maxScore) * 100), raw: scores.semantic.score, max: scores.semantic.maxScore },
      { name: t.aiReady, value: Math.round((scores.aiReady.score / scores.aiReady.maxScore) * 100), raw: scores.aiReady.score, max: scores.aiReady.maxScore },
    ];
    if (strategic?.geo_readiness) {
      items.push({ name: t.citability, value: Math.min(100, strategic.geo_readiness.citability_score || 0), raw: strategic.geo_readiness.citability_score || 0, max: 100 });
      items.push({ name: t.geoReady, value: Math.min(100, strategic.geo_readiness.ai_accessibility_score || 0), raw: strategic.geo_readiness.ai_accessibility_score || 0, max: 100 });
    }
    if (strategic?.brand_authority) {
      items.push({ name: t.brand, value: Math.min(100, strategic.brand_authority.thought_leadership_score || 0), raw: strategic.brand_authority.thought_leadership_score || 0, max: 100 });
    }
    if (strategic?.social_signals?.thought_leadership) {
      const eeat = strategic.social_signals.thought_leadership.eeat_score || 0;
      items.push({ name: t.social, value: Math.min(100, eeat * 10), raw: eeat, max: 10 });
    }
    totalScore = strategic?.overallScore || result.totalScore;
  }

  // Build SVG radar chart
  const cx = 180, cy = 180, maxR = 140;
  const n = items.length;
  const angleStep = (2 * Math.PI) / n;

  // Grid circles
  const gridCircles = [25, 50, 75, 100].map(pct => {
    const r = (pct / 100) * maxR;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="0.5" />`;
  }).join('');

  // Grid lines
  const gridLines = items.map((_, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + maxR * Math.cos(angle);
    const y = cy + maxR * Math.sin(angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5" />`;
  }).join('');

  // Data polygon
  const points = items.map((item, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (item.value / 100) * maxR;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');

  // Data dots
  const dots = items.map((item, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (item.value / 100) * maxR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const color = item.value >= 80 ? '#10b981' : item.value >= 50 ? '#f59e0b' : '#ef4444';
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="white" stroke-width="1.5" />`;
  }).join('');

  // Labels
  const labelEls = items.map((item, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = maxR + 24;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const anchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-size="11" fill="#6b7280">${item.name}</text>`;
  }).join('');

  // Score gauge
  const scoreRatio = totalScore / 200;
  const gaugeColor = scoreRatio >= 0.8 ? '#10b981' : scoreRatio >= 0.5 ? '#f59e0b' : '#ef4444';
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - scoreRatio);

  return `
    <div style="display: flex; align-items: center; gap: 32px; margin-bottom: 24px; break-inside: avoid; page-break-inside: avoid;">
      <div style="flex: 1;">
        <svg viewBox="0 0 400 400" width="350" height="350">
          ${gridCircles}
          ${gridLines}
          <polygon points="${points}" fill="rgba(124, 58, 237, 0.15)" stroke="#7c3aed" stroke-width="2" />
          ${dots}
          ${labelEls}
        </svg>
      </div>
      <div style="text-align: center; min-width: 120px;">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="6" />
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="${gaugeColor}" stroke-width="6" stroke-linecap="round"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 50 50)" />
          <text x="50" y="48" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="700" fill="#1f2937">${totalScore}</text>
          <text x="50" y="68" text-anchor="middle" font-size="10" fill="#9ca3af">/200</text>
        </svg>
        <div style="font-size: 11px; color: #6b7280; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${t.title}</div>
      </div>
    </div>
  `;
}
