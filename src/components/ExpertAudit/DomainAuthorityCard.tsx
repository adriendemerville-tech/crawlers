import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { DomainAuthority } from '@/types/expertAudit';

type Props = {
  authority?: DomainAuthority | null;
};

function scoreVerdict(score: number): { label: string; tone: string } {
  if (score >= 70) return { label: 'Autorité forte', tone: 'text-primary' };
  if (score >= 45) return { label: 'Autorité moyenne', tone: 'text-primary' };
  if (score >= 25) return { label: 'Autorité faible', tone: 'text-muted-foreground' };
  return { label: 'Autorité très faible', tone: 'text-muted-foreground' };
}

/**
 * Bloc "Marché & Autorité" : expose le score d'autorité /100 et le profil de
 * backlinks calculés par _shared/domainAuthority.ts (DataForSEO, cache 24 h).
 */
export function DomainAuthorityCard({ authority }: Props) {
  if (!authority) return null;

  const unavailable = authority.data_source === 'unavailable';
  const verdict = scoreVerdict(authority.authority_score);

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5 text-primary" />
          Marché &amp; Autorité
          <Badge variant="outline" className="ml-auto text-xs">
            {unavailable ? 'Données indisponibles' : 'DataForSEO'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {unavailable ? (
          <p className="text-sm text-muted-foreground">
            Le profil de backlinks n'a pas pu être récupéré
            {authority.unavailable_reason ? ` (${authority.unavailable_reason})` : ''}. Le score d'autorité
            n'est donc pas calculable pour ce domaine.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">Authority Score</span>
                <span className="text-3xl font-bold text-primary">
                  {authority.authority_score}
                  <span className="text-base font-normal text-muted-foreground">/100</span>
                </span>
              </div>
              <Progress value={authority.authority_score} className="h-2" />
              <p className={`text-xs ${verdict.tone}`}>
                {verdict.label} — 60 % rank de domaine ({authority.domain_rank}/100), 40 % diversité des
                domaines référents.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Backlinks</div>
                <div className="text-lg font-semibold">{authority.backlinks_total.toLocaleString('fr-FR')}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Domaines référents</div>
                <div className="text-lg font-semibold">{authority.referring_domains.toLocaleString('fr-FR')}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Ratio dofollow</div>
                <div className="text-lg font-semibold">{Math.round((authority.dofollow_ratio || 0) * 100)} %</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Liens cassés</div>
                <div className="text-lg font-semibold">{authority.broken_backlinks.toLocaleString('fr-FR')}</div>
              </div>
            </div>

            {authority.top_referring_domains?.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Principaux domaines référents</div>
                <ul className="space-y-1">
                  {authority.top_referring_domains.slice(0, 5).map((d) => (
                    <li key={d.domain} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-3">{d.domain}</span>
                      <span className="shrink-0 text-muted-foreground">
                        rank {d.rank} · {d.backlinks.toLocaleString('fr-FR')} liens
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {authority.top_anchors?.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Ancres dominantes</div>
                <div className="flex flex-wrap gap-2">
                  {authority.top_anchors.slice(0, 8).map((a) => (
                    <Badge key={a} variant="outline" className="text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {authority.first_seen && (
              <p className="text-xs text-muted-foreground">
                Premier backlink observé : {new Date(authority.first_seen).toLocaleDateString('fr-FR')} — un profil
                ancien renforce la crédibilité du domaine.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
