import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { MatrixTable } from './MatrixTable';
import { buildMatrixReport, GAP_KIND_LABEL, GAP_VALUE_EXPLAINER, RIVAL_STANDING_LABEL, VERDICT_LABEL, type ActionPriority, type RivalEntry } from '@/lib/competitorMatrix/report';
import { SECTION_LEADS, VERDICT_HINT } from '@/lib/competitorMatrix/reportCopy';
import { generateMatrixReportHTML } from '@/lib/competitorMatrix/reportHtml';
import { COMPETITOR_TYPE_LABEL, type MatrixJobState } from '@/lib/competitorMatrix/types';

const PRIORITY_LABEL: Record<ActionPriority, string> = {
  P1: 'Priorité 1 — à traiter maintenant',
  P2: 'Priorité 2 — visibilité dans les IA',
  P3: 'Priorité 3 — terrain libre',
};

function SectionTitle({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-3">
        <span className="h-6 w-1 rounded-full bg-primary" />
        <h3 className="text-xl font-bold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{lead}</p>
    </div>
  );
}

function RivalList({ title, hint, entries }: { title: string; hint: string; entries: RivalEntry[] }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mb-3 text-xs text-muted-foreground">{hint}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun concurrent mesuré dans cette catégorie.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.domain} className="text-sm">
              <span className="font-medium">{e.name}</span>{' '}
              <span className="text-xs text-muted-foreground">({e.domain})</span>
              <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px]">
                {RIVAL_STANDING_LABEL[e.standing]}
              </span>
              <span className="ml-2 text-[11px] uppercase tracking-wide text-muted-foreground">{e.typeLabel}</span>
              <p className="text-xs text-muted-foreground">{e.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


export function MatrixReportView({ job }: { job: MatrixJobState }) {
  const report = useMemo(() => buildMatrixReport(job), [job]);
  const [exporting, setExporting] = useState(false);

  if (!report || !job.matrix) return null;
  const matrix = job.matrix;

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { generateSectionBasedPDF } = await import('@/utils/sectionBasedPdfExport');
      await generateSectionBasedPDF({
        htmlContent: generateMatrixReportHTML(report, matrix, job.keywords),
        filename: `matrice-concurrence-${report.domain.replace(/[^a-z0-9.-]/gi, '-')}.pdf`,
        backgroundColor: '#ffffff',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* 1. Synthèse exécutive */}
      <section>
        <SectionTitle title="Synthèse exécutive" lead={SECTION_LEADS.verdict} />
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <RivalList
                title="Concurrents primaires"
                hint="Même produit ou service que vous, devant ou derrière vous dans Google, plus les leaders et goliaths du marché."
                entries={report.rivalPanel.primary}
              />
              <RivalList
                title="Concurrents secondaires"
                hint="Positionnés à votre niveau ou au-dessus sans vendre la même offre."
                entries={report.rivalPanel.secondary}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-primary px-3 py-1 text-sm font-medium text-primary">
                {VERDICT_LABEL[report.verdict.level]}
              </span>
              <span className="text-sm text-muted-foreground" title={VERDICT_HINT}>
                Indice de présence {report.verdict.score}/100
              </span>
            </div>
            <h4 className="text-lg font-semibold">{report.verdict.headline}</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{report.verdict.explanation}</p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="outline" onClick={exportPdf} disabled={exporting} className="gap-2">
                <FileDown className="h-4 w-4" />
                {exporting ? 'Génération du PDF…' : 'Télécharger le rapport (PDF)'}
              </Button>
              <span className="text-xs text-muted-foreground">
                {report.measured.totalKeywords} requêtes · {report.measured.competitors} concurrents ·{' '}
                {report.measured.serpKeywords} relevés Google · {report.measured.aiKeywords} requêtes testées dans les IA
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. KPI */}
      <section>
        <SectionTitle title="Les cinq chiffres à retenir" lead={SECTION_LEADS.kpis} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {report.kpis.map((k) => (
            <Card key={k.key}>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="my-1 text-2xl font-bold text-primary">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. Plan d'action priorisé */}
      {report.actions.length > 0 && (
        <section>
          <SectionTitle title="Plan d’action priorisé" lead={SECTION_LEADS.actions} />
          <div className="space-y-4">
            {report.actions.map((a) => (
              <Card key={a.id} className={a.priority === 'P1' ? 'border-l-4 border-l-primary' : 'border-l-4 border-l-[hsl(43,89%,38%)]'}>
                <CardContent className="space-y-3 p-6">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                      {PRIORITY_LABEL[a.priority]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.horizon} · {a.volume.toLocaleString('fr-FR')} recherches/mois concernées
                    </span>
                  </div>
                  <h4 className="text-base font-semibold">{a.title}</h4>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Constat mesuré</dt>
                      <dd>{a.finding}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Pourquoi c’est prioritaire</dt>
                      <dd className="text-muted-foreground">{a.why}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ce qu’il faut faire</dt>
                      <dd className="text-muted-foreground">{a.how}</dd>
                    </div>
                  </dl>
                  {a.keywords.length > 0 && (
                    <ul className="flex flex-wrap gap-2 pt-1">
                      {a.keywords.slice(0, 10).map((kw) => (
                        <li key={kw} className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          {kw}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 4. Classement du marché */}
      <section>
        <SectionTitle title="Classement du marché" lead={SECTION_LEADS.leaderboard} />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Domaine</th>
                <th className="p-3">Rôle</th>
                <th className="p-3">Couvertes</th>
                <th className="p-3">Faibles</th>
                <th className="p-3">Absentes</th>
                <th className="p-3">Position moy.</th>
                <th className="p-3">Citation IA</th>
                <th className="p-3">AI Overviews</th>
              </tr>
            </thead>
            <tbody>
              {report.leaderboard.map((e) => (
                <tr key={e.domain} className={`border-b border-border last:border-0 ${e.isTarget ? 'bg-primary/5' : ''}`}>
                  <td className="p-3">
                    <span className={e.isTarget ? 'font-semibold' : ''}>{e.name}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{e.typeLabel}</td>
                  <td className="p-3">{e.covered}</td>
                  <td className="p-3">{e.weak}</td>
                  <td className="p-3">{e.absent}</td>
                  <td className="p-3">{e.avgPosition === null ? 'non mesuré' : e.avgPosition}</td>
                  <td className="p-3">{e.aiRate === null ? 'non mesuré' : `${e.aiRate} %`}</td>
                  <td className="p-3">{e.aiOverviewHits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4 bis. Gaps de couverture face aux leaders */}
      {report.coverageGaps.length > 0 && (
        <section>
          <SectionTitle title="Gaps de couverture face aux leaders" lead={SECTION_LEADS.gaps} />
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="p-3">Requête</th>
                  <th className="p-3">Type d’écart</th>
                  <th className="p-3">Vous</th>
                  <th className="p-3">Leaders qui la couvrent</th>
                  <th className="p-3">Volume/mois</th>
                  <th className="p-3">Difficulté</th>
                  <th className="p-3">Rentabilité</th>
                </tr>
              </thead>
              <tbody>
                {report.coverageGaps.map((g) => (
                  <tr key={g.keyword} className="border-b border-border align-top last:border-0">
                    <td className="p-3">
                      <span className="font-medium">{g.keyword}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{g.reason}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${
                          g.kind === 'quick_win' ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                        }`}
                      >
                        {GAP_KIND_LABEL[g.kind]}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {g.targetPosition !== null ? `position ${g.targetPosition}` : 'hors top 30'}
                      {g.targetAiRate !== null && (
                        <span className="block text-xs text-muted-foreground">IA : {g.targetAiRate} %</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {g.leaders.length > 0
                        ? g.leaders
                            .map((l) => `${l.name}${l.position !== null ? ` (${l.position})` : ''}`)
                            .join(', ')
                        : 'aucun leader dans le top 10'}
                    </td>
                    <td className="p-3 whitespace-nowrap">{g.volume.toLocaleString('fr-FR')}</td>
                    <td className="p-3">
                      {g.difficulty}
                      <span className="block text-xs text-muted-foreground">
                        ÷ {g.valueFactors.difficultyDivisor.toLocaleString('fr-FR')}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-primary">
                      {g.value.toLocaleString('fr-FR')}
                      <span className="mt-1 block font-normal text-xs text-muted-foreground">
                        {g.valueFactors.formula}
                      </span>
                      <span className="block font-normal text-xs text-muted-foreground">
                        proximité {g.valueFactors.proximity.toLocaleString('fr-FR')} — {g.valueFactors.proximityLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded-lg border border-border p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Comment lire l’indice de rentabilité</p>
            <p className="mt-2">{GAP_VALUE_EXPLAINER}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Volume</strong> : recherches mensuelles mesurées sur la requête.</li>
              <li>
                <strong>Proximité</strong> : distance au top 10 — 1 (11-30), 0,6 (captée par un leader), 0,5 (au-delà du
                top 10 sans leader), 0,4 (position acquise, citations IA absentes).
              </li>
              <li>
                <strong>Difficulté</strong> : diviseur 1 + difficulté / 100, donc 1,0 à 2,0 selon la concurrence de la
                requête.
              </li>
            </ul>
            <p className="mt-2">
              {report.coverageGaps.length} opportunités retenues, soit {report.gapVolume.toLocaleString('fr-FR')}{' '}
              recherches mensuelles hors de votre couverture actuelle. L’indice sert à comparer les requêtes entre elles,
              ce n’est pas une prévision de trafic.
            </p>
          </div>
        </section>
      )}


      {/* 5. AI Overviews sans vous */}
      {report.aiOverviewGaps.length > 0 && (
        <section>
          <SectionTitle
            title="Réponses générées par Google où vous n’apparaissez pas"
            lead={SECTION_LEADS.aiOverviews}
          />
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="p-3">Requête</th>
                  <th className="p-3">Sources citées par Google</th>
                </tr>
              </thead>
              <tbody>
                {report.aiOverviewGaps.map((g) => (
                  <tr key={g.keyword} className="border-b border-border last:border-0">
                    <td className="p-3">{g.keyword}</td>
                    <td className="p-3 text-muted-foreground">{g.domains.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 6. Annexe : matrice */}
      <section>
        <SectionTitle title="Annexe — matrice détaillée" lead={SECTION_LEADS.matrix} />
        <MatrixTable matrix={matrix} keywords={job.keywords} />
      </section>

      {/* 7. Méthode et limites */}
      <section>
        <SectionTitle title="Méthode et limites" lead={SECTION_LEADS.method} />
        <Card>
          <CardContent className="p-6">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Positions Google issues d’un relevé SERP daté, localisé en France.</li>
              <li>Citations IA mesurées sur 3 itérations par moteur (ChatGPT, Gemini, Claude), soit 9 réponses par requête.</li>
              <li>Une case « non mesuré » signale l’absence de relevé, jamais une absence de visibilité.</li>
              <li>Les volumes de recherche sont des volumes de marché : une demande, pas un trafic garanti.</li>
              {matrix.outOfScope.length > 0 && (
                <li>
                  Hors matrice :{' '}
                  {matrix.outOfScope.map((c) => `${c.name} (${COMPETITOR_TYPE_LABEL[c.type]})`).join(', ')} — ces acteurs
                  faussent la lecture d’une matrice de mots-clés.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default MatrixReportView;
