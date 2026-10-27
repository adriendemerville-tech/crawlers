import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getConsoleAuditScores } from '@/lib/console/auditScores.functions';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  domain: string | null | undefined;
  showStrategic?: boolean;
  showTechnical?: boolean;
  /** inline : bandeau libre. card : une cellule de la grille KPI, même cadre que les cartes voisines. */
  variant?: 'inline' | 'card';
}

const scoreStroke = (score: number) =>
  score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#ef4444';
const scoreText = (score: number) =>
  score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

function Gauge({ score, label, size = 56 }: { score: number | null; label: string; size?: number }) {
  const compact = size < 48;
  const stroke = compact ? 3 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = score != null ? (Math.min(100, Math.max(0, score)) / 100) * c : 0;
  return (
    <div className={compact ? 'flex flex-col items-center gap-0.5' : 'flex flex-col items-center gap-1'}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
          {score != null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={scoreStroke(score)}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${c}`}
            />
          )}
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-mono font-bold ${compact ? 'text-[11px]' : 'text-base'} ${score ? scoreText(score) : 'text-muted-foreground/50'}`}
        >
          {score != null ? score : '—'}
        </span>
      </div>
      <span className={`text-[10px] text-muted-foreground text-center ${compact ? 'leading-none' : 'leading-tight'}`}>{label}</span>
    </div>
  );
}

/** Même cadre que les cartes KPI de Mes sites (bordure, fond, hauteur). */
const kpiSlotClass =
  'relative min-w-0 h-full min-h-[52px] overflow-hidden rounded-lg border bg-card p-2 flex flex-col items-center justify-center';

/**
 * Jauges circulaires du dernier audit technique et du dernier audit stratégique.
 * « inline » au-dessus de l'onglet GEO ; « card » dans la grille KPI de Mes sites.
 */
export function AuditScoresBanner({ domain, showStrategic = true, showTechnical = true, variant = 'inline' }: Props) {
  const { language } = useLanguage();
  const fetchScores = useServerFn(getConsoleAuditScores);

  const { data } = useQuery({
    queryKey: ['console-audit-scores', domain],
    queryFn: () => fetchScores({ data: { domain: domain! } }),
    enabled: !!domain,
    staleTime: 5 * 60 * 1000,
  });

  if (!domain || !data || (data.technical.length === 0 && data.strategic.length === 0)) return null;

  const technical = data.technical[0]?.score ?? null;
  const strategic = data.strategic[0]?.score ?? null;
  const technicalPrev = data.technical[1]?.score ?? null;
  const strategicPrev = data.strategic[1]?.score ?? null;

  const technicalLabel =
    (language === 'fr' ? 'Technique' : language === 'es' ? 'Técnico' : 'Technical') +
    (technical != null && technicalPrev != null ? ` (${technicalPrev >= technical ? '-' : '+'}${Math.abs(technical - technicalPrev)})` : '');
  const strategicLabel =
    (language === 'fr' ? 'Stratégique' : language === 'es' ? 'Estratégico' : 'Strategic') +
    (strategic != null && strategicPrev != null ? ` (${strategicPrev >= strategic ? '-' : '+'}${Math.abs(strategic - strategicPrev)})` : '');

  if (variant === 'card') {
    return (
      <>
        {showTechnical && (
          <div className={kpiSlotClass}>
            <Gauge score={technical} label={technicalLabel} size={28} />
          </div>
        )}
        {showStrategic && (
          <div className={kpiSlotClass}>
            <Gauge score={strategic} label={strategicLabel} size={28} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {showTechnical && <Gauge score={technical} label={technicalLabel} />}
      {showStrategic && <Gauge score={strategic} label={strategicLabel} />}
    </div>
  );
}
