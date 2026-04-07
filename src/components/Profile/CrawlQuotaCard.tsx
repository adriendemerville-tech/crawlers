import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Bug, Users, User, Loader2 } from 'lucide-react';
import { useCrawlQuota } from '@/hooks/useCrawlQuota';
import { useLanguage } from '@/contexts/LanguageContext';

export function CrawlQuotaCard() {
  const { quota, teamQuotas, totalTeamUsed, loading } = useCrawlQuota();
  const { language } = useLanguage();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!quota) return null;

  const isTeam = teamQuotas.length > 1;
  const totalLimit = teamQuotas.reduce((sum, t) => sum + t.limit, 0);

  return (
    <Card className="border-violet-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bug className="h-5 w-5 text-violet-500" />
          {language === 'fr' ? 'Compteur de crawl' : language === 'es' ? 'Contador de crawl' : 'Crawl Counter'}
          <Badge variant="outline" className="ml-auto text-[10px] border-violet-500/30 text-violet-500">
            {quota.planLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Aggregated total */}
        {isTeam && (
          <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/15 space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-semibold text-foreground">
                {language === 'fr' ? 'Total équipe' : language === 'es' ? 'Total equipo' : 'Team total'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums">{totalTeamUsed.toLocaleString('fr-FR')}</span>
              <span className="text-muted-foreground text-sm">/ {totalLimit.toLocaleString('fr-FR')}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                — {Math.max(0, totalLimit - totalTeamUsed).toLocaleString('fr-FR')} {language === 'fr' ? 'restantes' : 'remaining'}
              </span>
            </div>
            <Progress
              value={totalLimit > 0 ? Math.min(100, (totalTeamUsed / totalLimit) * 100) : 0}
              className="h-2"
            />
          </div>
        )}

        {/* Per-user breakdown */}
        <div className="space-y-3">
          {teamQuotas.map((member) => {
            const pct = member.limit > 0 ? Math.min(100, (member.used / member.limit) * 100) : 0;
            const remaining = Math.max(0, member.limit - member.used);
            const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-violet-500';
            const label = member.firstName && member.firstName !== 'Moi'
              ? `${member.firstName} ${member.lastName}`.trim()
              : member.email || (language === 'fr' ? 'Mon compte' : 'My account');

            return (
              <div key={member.userId} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium truncate max-w-[200px]">{label}</span>
                  </div>
                  <div className="flex items-baseline gap-1 text-xs tabular-nums">
                    <span className="font-bold">{member.used.toLocaleString('fr-FR')}</span>
                    <span className="text-muted-foreground">/ {member.limit.toLocaleString('fr-FR')}</span>
                    <span className="text-muted-foreground ml-1">
                      ({remaining.toLocaleString('fr-FR')} {language === 'fr' ? 'restantes' : 'left'})
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          {language === 'fr'
            ? 'Les quotas sont réinitialisés le 1er de chaque mois à 5h00.'
            : language === 'es'
              ? 'Las cuotas se reinician el 1 de cada mes a las 5:00.'
              : 'Quotas reset on the 1st of each month at 5:00 AM.'}
        </p>
      </CardContent>
    </Card>
  );
}
