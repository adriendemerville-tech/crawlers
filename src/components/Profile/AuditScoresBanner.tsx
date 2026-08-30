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

const deltaColor = (delta: number) =>
  delta > 0 ? 'text-emerald-500' : delta >= -5 ? 'text-orange-500' : 'text-red-500';

/**
 * Bandeau compact affiché en haut des onglets SEO et GEO de la console :
 * note du dernier audit technique et du dernier audit stratégique du domaine.
 * Quand un second audit existe : ancienne note — différence — nouvelle note.
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

  if (!domain || !data || (data.technical.length === 0 && data.strategic.length === 0)) return null;

  const items = [
    {
      icon: Wrench,
      label: language === 'fr' ? 'Audit technique' : language === 'es' ? 'Auditoría técnica' : 'Technical audit',
      points: data.technical,
    },
    {
      icon: Compass,
      label: language === 'fr' ? 'Audit stratégique' : language === 'es' ? 'Auditoría estratégica' : 'Strategic audit',
      points: data.strategic,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(({ icon: Icon, label, points }) => {
        const latest = points[0];
        const previous = points[1];
        const delta = latest && previous ? latest.score - previous.score : null;
        return (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{label}</span>
            {latest ? (
              <span className="flex items-center gap-1.5">
                {previous && delta !== null && (
                  <>
                    <span className="text-sm font-medium text-muted-foreground/60">{previous.score}/100</span>
                    <span className={`text-sm font-bold ${deltaColor(delta)}`}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                    <span className="h-px w-3 bg-border" aria-hidden />
                  </>
                )}
                <span className={`text-sm font-bold ${scoreColor(latest.score)}`}>{latest.score}/100</span>
              </span>
            ) : (
              <span className="text-sm font-medium text-muted-foreground/60">—</span>
            )}
            {latest?.at && (
              <span className="text-[10px] text-muted-foreground/60">
                {new Date(latest.at).toLocaleDateString(
                  language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
