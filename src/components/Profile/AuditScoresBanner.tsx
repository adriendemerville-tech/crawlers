import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Wrench, Compass } from 'lucide-react';
import { getConsoleAuditScores } from '@/lib/console/auditScores.functions';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  domain: string | null | undefined;
}

const scoreColor = (score: number) =>
  score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';

/**
 * Bandeau compact affiché en haut des onglets SEO et GEO de la console :
 * note du dernier audit technique et du dernier audit stratégique du domaine.
 */
export function AuditScoresBanner({ domain }: Props) {
  const { language } = useLanguage();
  const fetchScores = useServerFn(getConsoleAuditScores);

  const { data } = useQuery({
    queryKey: ['console-audit-scores', domain],
    queryFn: () => fetchScores({ data: { domain: domain! } }),
    enabled: !!domain,
    staleTime: 5 * 60 * 1000,
  });

  if (!domain || !data || (data.technicalScore === null && data.strategicScore === null)) return null;

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US') : null;

  const items = [
    {
      icon: Wrench,
      label: language === 'fr' ? 'Audit technique' : language === 'es' ? 'Auditoría técnica' : 'Technical audit',
      score: data.technicalScore,
      at: fmtDate(data.technicalAt),
    },
    {
      icon: Compass,
      label: language === 'fr' ? 'Audit stratégique' : language === 'es' ? 'Auditoría estratégica' : 'Strategic audit',
      score: data.strategicScore,
      at: fmtDate(data.strategicAt),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(({ icon: Icon, label, score, at }) => (
        <div
          key={label}
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5"
        >
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
          {score !== null ? (
            <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}/100</span>
          ) : (
            <span className="text-sm font-medium text-muted-foreground/60">—</span>
          )}
          {at && <span className="text-[10px] text-muted-foreground/60">{at}</span>}
        </div>
      ))}
    </div>
  );
}
