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

function confidenceLabel(c: 'high' | 'medium' | 'low'): string {
  return c === 'high' ? 'élevée' : c === 'medium' ? 'moyenne' : 'faible';
}

function toxicityLabel(v: 'sain' | 'a_surveiller' | 'pollue'): string {
  return v === 'pollue' ? 'Pollué' : v === 'a_surveiller' ? 'À surveiller' : 'Sain';
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
                domaines référents pondérée par leur qualité, moins la pénalité de toxicité.
              </p>
              <p className="text-xs text-muted-foreground">
                Estimation propriétaire Crawlers (plafonnée à 92), pas un score Semrush ou Moz.
                {authority.confidence ? ` Fiabilité : ${confidenceLabel(authority.confidence)}${authority.confidence_reason ? ` — ${authority.confidence_reason}` : ''}.` : ''}
              </p>
            </div>

            {authority.toxicity && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Toxicité du profil de liens</span>
                  <Badge variant="outline" className="text-xs">
                    {toxicityLabel(authority.toxicity.verdict)} · {authority.toxicity.toxicity_score}/100
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <div>Ancre dominante : {Math.round(authority.toxicity.dominant_anchor_ratio * 100)} %</div>
                  <div>Ancres non naturelles : {Math.round(authority.toxicity.unnatural_anchor_ratio * 100)} %</div>
                  <div>Rank moyen des référents : {authority.toxicity.avg_referrer_rank}/100</div>
                  <div>Liens par domaine : {authority.toxicity.links_per_domain}</div>
                </div>
                {authority.toxicity.signals.length > 0 && (
                  <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                    {authority.toxicity.signals.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs">{authority.toxicity.recommendation}</p>
              </div>
            )}

            {authority.organic_visibility?.source === 'dataforseo_labs' && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Trafic estimé / mois</div>
                  <div className="text-lg font-semibold">
                    {(authority.organic_visibility.estimated_traffic ?? 0).toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Mots-clés positionnés</div>
                  <div className="text-lg font-semibold">
                    {(authority.organic_visibility.ranked_keywords ?? 0).toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Position moyenne</div>
                  <div className="text-lg font-semibold">{authority.organic_visibility.average_position ?? '—'}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Top 3 / Top 10</div>
                  <div className="text-lg font-semibold">
                    {authority.organic_visibility.top3 ?? 0} / {authority.organic_visibility.top10 ?? 0}
                  </div>
                </div>
              </div>
            )}

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

            {authority.distribution && authority.distribution.source !== 'unavailable' && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="text-sm font-medium">Répartition du profil de liens</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ['TLD', authority.distribution.tld],
                    ['Pays', authority.distribution.countries],
                    ['Plateformes', authority.distribution.platform_types],
                  ] as const).map(([label, buckets]) =>
                    buckets.length > 0 ? (
                      <div key={label} className="space-y-1">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        {buckets.slice(0, 4).map((b) => (
                          <div key={b.key} className="flex items-center justify-between text-xs">
                            <span className="truncate pr-2">{b.key}</span>
                            <span className="shrink-0 text-muted-foreground">{Math.round(b.share * 100)} %</span>
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>

                {authority.top_linked_pages && authority.top_linked_pages.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Pages cibles les plus liées ({authority.distribution.linked_pages_sampled} pages liées ·{' '}
                      {Math.round(authority.distribution.top_page_share * 100)} % des référents sur la première)
                    </div>
                    {authority.top_linked_pages.slice(0, 5).map((p) => (
                      <div key={p.url} className="flex items-center justify-between text-xs">
                        <span className="truncate pr-2">{p.url}</span>
                        <span className="shrink-0 text-muted-foreground">{p.referring_domains} domaines</span>
                      </div>
                    ))}
                  </div>
                )}

                {authority.distribution.signals.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {authority.distribution.signals.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs">{authority.distribution.recommendation}</p>
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
