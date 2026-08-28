// Rapport HTML exportable de la matrice de concurrence (PDF).
// Chaque bloc porte data-pdf-section pour une pagination sans coupure au milieu.

import type { MarketKeyword, MatrixResult } from './types';
import { COVERAGE_LABEL, COMPETITOR_TYPE_LABEL } from './types';
import { GAP_KIND_LABEL, VERDICT_LABEL, type MatrixReport } from './report';
import { SECTION_LEADS } from './reportCopy';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #17151f; background: #fff; font-size: 12px; line-height: 1.55; }
  .wrap { padding: 24px; }
  .cover { border: 2px solid #4c1d95; border-radius: 10px; padding: 28px; margin-bottom: 18px; }
  .cover h1 { font-size: 22px; margin: 0 0 10px; color: #2e1065; }
  .cover .dom { font-size: 15px; font-weight: 600; }
  .badge { display: inline-block; border: 1px solid #4c1d95; color: #2e1065; border-radius: 999px; padding: 3px 10px; font-size: 11px; }
  .section { border: 1px solid #ddd8e6; border-radius: 10px; padding: 18px; margin-bottom: 14px; page-break-inside: avoid; }
  .section h2 { font-size: 15px; margin: 0 0 6px; color: #2e1065; }
  .lead { color: #5b5470; font-size: 11px; margin: 0 0 12px; }
  .kpis { display: flex; flex-wrap: wrap; gap: 10px; }
  .kpi { border: 1px solid #ddd8e6; border-radius: 8px; padding: 10px 12px; width: 30%; }
  .kpi .v { font-size: 18px; font-weight: 700; color: #2e1065; }
  .kpi .l { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #5b5470; }
  .kpi .h { font-size: 10px; color: #6f6885; margin-top: 4px; }
  .action { border: 1px solid #ddd8e6; border-left: 4px solid #b4880b; border-radius: 8px; padding: 14px; margin-bottom: 10px; page-break-inside: avoid; }
  .action.p1 { border-left-color: #4c1d95; }
  .action h3 { font-size: 13px; margin: 0 0 6px; }
  .action dt { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #5b5470; margin-top: 8px; }
  .action dd { margin: 2px 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd8e6; padding: 5px 6px; text-align: left; }
  th { background: #f6f4fb; }
  .kw { font-size: 10px; color: #5b5470; }
  .foot { font-size: 10px; color: #6f6885; text-align: center; padding-top: 8px; }
`;

function coverHtml(r: MatrixReport, date: string): string {
  return `<div class="cover" data-pdf-section="cover">
    <span class="badge">Matrice de concurrence — Crawlers.fr</span>
    <h1>${esc(r.verdict.headline)}</h1>
    <p class="dom">${esc(r.name)} — ${esc(r.domain)}</p>
    <p class="lead">Rapport généré le ${esc(date)} · ${r.measured.totalKeywords} requêtes du marché · ${r.measured.competitors} concurrents suivis · ${r.measured.serpKeywords} relevés Google · ${r.measured.aiKeywords} requêtes testées dans les IA</p>
  </div>`;
}

function verdictHtml(r: MatrixReport): string {
  return `<div class="section" data-pdf-section="verdict">
    <h2>Synthèse exécutive</h2>
    <p class="lead">${esc(SECTION_LEADS.verdict)}</p>
    <p><span class="badge">${esc(VERDICT_LABEL[r.verdict.level])} · indice de présence ${r.verdict.score}/100</span></p>
    <p>${esc(r.verdict.explanation)}</p>
  </div>`;
}

function kpiHtml(r: MatrixReport): string {
  return `<div class="section" data-pdf-section="kpis">
    <h2>Les cinq chiffres à retenir</h2>
    <p class="lead">${esc(SECTION_LEADS.kpis)}</p>
    <div class="kpis">
      ${r.kpis.map((k) => `<div class="kpi"><div class="l">${esc(k.label)}</div><div class="v">${esc(k.value)}</div><div class="h">${esc(k.hint)}</div></div>`).join('')}
    </div>
  </div>`;
}

function actionsHtml(r: MatrixReport): string {
  if (r.actions.length === 0) return '';
  return `<div class="section" data-pdf-section="actions-intro">
      <h2>Plan d’action priorisé</h2>
      <p class="lead">${esc(SECTION_LEADS.actions)}</p>
    </div>
    ${r.actions.map((a) => `<div class="action ${a.priority === 'P1' ? 'p1' : ''}" data-pdf-section="action-${esc(a.id)}">
      <h3>${esc(a.priority)} · ${esc(a.title)}</h3>
      <p class="kw">${esc(a.horizon)} · ${a.volume.toLocaleString('fr-FR')} recherches/mois concernées</p>
      <dl>
        <dt>Constat mesuré</dt><dd>${esc(a.finding)}</dd>
        <dt>Pourquoi c’est prioritaire</dt><dd>${esc(a.why)}</dd>
        <dt>Ce qu’il faut faire</dt><dd>${esc(a.how)}</dd>
      </dl>
    </div>`).join('')}`;
}

function leaderboardHtml(r: MatrixReport): string {
  return `<div class="section" data-pdf-section="leaderboard">
    <h2>Classement du marché</h2>
    <p class="lead">${esc(SECTION_LEADS.leaderboard)}</p>
    <table><thead><tr>
      <th>Domaine</th><th>Rôle</th><th>Couvertes</th><th>Faibles</th><th>Absentes</th><th>Position moyenne</th><th>Citation IA</th><th>AI Overviews</th>
    </tr></thead><tbody>
      ${r.leaderboard.map((e) => `<tr>
        <td>${e.isTarget ? '<strong>' : ''}${esc(e.name)}${e.isTarget ? '</strong>' : ''}</td>
        <td>${esc(e.typeLabel)}</td><td>${e.covered}</td><td>${e.weak}</td><td>${e.absent}</td>
        <td>${e.avgPosition === null ? 'non mesuré' : e.avgPosition}</td>
        <td>${e.aiRate === null ? 'non mesuré' : `${e.aiRate} %`}</td>
        <td>${e.aiOverviewHits}</td>
      </tr>`).join('')}
    </tbody></table>
  </div>`;
}

function gapsHtml(r: MatrixReport): string {
  if (r.coverageGaps.length === 0) return '';
  return `<div class="section" data-pdf-section="gaps">
    <h2>Gaps de couverture face aux leaders</h2>
    <p class="lead">${esc(SECTION_LEADS.gaps)}</p>
    <table><thead><tr>
      <th>Requête</th><th>Type d’écart</th><th>Vous</th><th>Leaders qui la couvrent</th><th>Volume/mois</th><th>Difficulté</th><th>Rentabilité</th>
    </tr></thead><tbody>
      ${r.coverageGaps.map((g) => `<tr>
        <td><strong>${esc(g.keyword)}</strong><div class="kw">${esc(g.reason)}</div></td>
        <td>${esc(GAP_KIND_LABEL[g.kind])}</td>
        <td>${g.targetPosition !== null ? `position ${g.targetPosition}` : 'hors top 30'}${g.targetAiRate !== null ? `<div class="kw">IA : ${g.targetAiRate} %</div>` : ''}</td>
        <td>${g.leaders.length > 0 ? esc(g.leaders.map((l) => `${l.name}${l.position !== null ? ` (${l.position})` : ''}`).join(', ')) : 'aucun leader dans le top 10'}</td>
        <td>${g.volume.toLocaleString('fr-FR')}</td><td>${g.difficulty}</td><td><strong>${g.value.toLocaleString('fr-FR')}</strong></td>
      </tr>`).join('')}
    </tbody></table>
    <p class="kw">${r.coverageGaps.length} opportunités retenues, soit ${r.gapVolume.toLocaleString('fr-FR')} recherches mensuelles hors de votre couverture actuelle. La rentabilité est un indice de comparaison interne, pas une prévision de trafic.</p>
  </div>`;
}

function aiHtml(r: MatrixReport): string {
  if (r.aiOverviewGaps.length === 0) return '';
  return `<div class="section" data-pdf-section="ai-overviews">
    <h2>Réponses générées par Google où vous n’apparaissez pas</h2>
    <p class="lead">${esc(SECTION_LEADS.aiOverviews)}</p>
    <table><thead><tr><th>Requête</th><th>Sources citées</th></tr></thead><tbody>
      ${r.aiOverviewGaps.map((g) => `<tr><td>${esc(g.keyword)}</td><td>${esc(g.domains.join(', '))}</td></tr>`).join('')}
    </tbody></table>
  </div>`;
}

function matrixHtml(matrix: MatrixResult, keywords: MarketKeyword[]): string {
  return `<div class="section" data-pdf-section="matrix">
    <h2>Annexe — matrice détaillée</h2>
    <p class="lead">${esc(SECTION_LEADS.matrix)}</p>
    <table><thead><tr><th>Requête</th><th>Vol./mois</th>${matrix.rows.map((row) => `<th>${esc(row.name)}</th>`).join('')}<th>AI Overview</th></tr></thead>
    <tbody>
      ${keywords.map((kw, i) => `<tr>
        <td>${esc(kw.keyword)}${kw.quickWin ? ' <span class="kw">(quick win)</span>' : ''}</td>
        <td>${kw.volume.toLocaleString('fr-FR')}</td>
        ${matrix.rows.map((row) => {
          const c = row.cells[i];
          const pos = c.position !== null ? `pos. ${c.position}` : '';
          const rate = c.aiCitationRate !== null ? `${Math.round(c.aiCitationRate * 100)} % IA` : '';
          return `<td>${esc(COVERAGE_LABEL[c.state])}${pos || rate ? `<div class="kw">${esc([pos, rate].filter(Boolean).join(' · '))}</div>` : ''}</td>`;
        }).join('')}
        <td>${matrix.aiOverviewRow[i]?.triggered === null ? 'non relevé' : (matrix.aiOverviewRow[i]?.domains.length || 0)}</td>
      </tr>`).join('')}
    </tbody></table>
  </div>`;
}

function scopeHtml(matrix: MatrixResult): string {
  return `<div class="section" data-pdf-section="method">
    <h2>Méthode et limites</h2>
    <p class="lead">${esc(SECTION_LEADS.method)}</p>
    <ul>
      <li>Les positions Google proviennent d’un relevé SERP daté, localisé en France, sur les requêtes retenues.</li>
      <li>Les citations IA sont mesurées sur 3 itérations par moteur (ChatGPT, Gemini, Claude), soit 9 réponses par requête.</li>
      <li>Une case « non mesuré » signale l’absence de relevé, jamais une absence de visibilité.</li>
      <li>Les volumes de recherche sont des volumes de marché : ils indiquent une demande, pas un trafic garanti.</li>
      ${matrix.outOfScope.length > 0 ? `<li>Hors matrice : ${matrix.outOfScope.map((c) => `${esc(c.name)} (${esc(COMPETITOR_TYPE_LABEL[c.type])})`).join(', ')} — ces acteurs faussent la lecture d’une matrice de mots-clés.</li>` : ''}
    </ul>
  </div>`;
}

export function generateMatrixReportHTML(
  report: MatrixReport,
  matrix: MatrixResult,
  keywords: MarketKeyword[],
): string {
  const date = new Date(report.generatedAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Matrice de concurrence — ${esc(report.domain)}</title><style>${STYLES}</style></head>
<body><div class="wrap">
  ${coverHtml(report, date)}
  ${verdictHtml(report)}
  ${kpiHtml(report)}
  ${actionsHtml(report)}
  ${leaderboardHtml(report)}
  ${gapsHtml(report)}
  ${aiHtml(report)}
  ${matrixHtml(matrix, keywords)}
  ${scopeHtml(matrix)}
  <div class="foot" data-pdf-section="footer">Rapport produit par Crawlers.fr — matrice de concurrence Google et moteurs de réponse IA.</div>
</div></body></html>`;
}
