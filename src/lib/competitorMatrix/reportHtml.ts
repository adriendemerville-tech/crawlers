// Rapport HTML exportable de la matrice de concurrence (PDF).
// Chaque bloc porte data-pdf-section pour une pagination sans coupure au milieu.

import type { MarketKeyword, MatrixResult } from './types';
import { COVERAGE_LABEL, COMPETITOR_TYPE_LABEL } from './types';
import { GAP_KIND_LABEL, GAP_VALUE_EXPLAINER, RIVAL_STANDING_LABEL, VERDICT_LABEL, type MatrixReport } from './report';
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
  const rivals = (title: string, hint: string, list: MatrixReport['rivalPanel']['primary']) =>
    `<div style="border:1px solid #ddd8e6;border-radius:8px;padding:10px;width:48%;">
      <div style="font-weight:700;">${esc(title)}</div>
      <div class="kw" style="margin-bottom:6px;">${esc(hint)}</div>
      ${
        list.length === 0
          ? '<div class="kw">Aucun concurrent mesuré dans cette catégorie.</div>'
          : `<ul style="margin:0;padding-left:14px;">${list
              .map(
                (e) =>
                  `<li><strong>${esc(e.name)}</strong> (${esc(e.domain)}) — ${esc(RIVAL_STANDING_LABEL[e.standing])} · ${esc(e.typeLabel)}<div class="kw">${esc(e.reason)}</div></li>`,
              )
              .join('')}</ul>`
      }
    </div>`;

  return `<div class="section" data-pdf-section="verdict">
    <h2>Synthèse exécutive</h2>
    <p class="lead">${esc(SECTION_LEADS.verdict)}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
      ${rivals('Concurrents primaires', 'Même produit ou service, devant ou derrière vous, plus les leaders et goliaths du marché.', r.rivalPanel.primary)}
      ${rivals('Concurrents secondaires', 'À votre niveau ou au-dessus, sans vendre la même offre.', r.rivalPanel.secondary)}
    </div>
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
        <td>${g.volume.toLocaleString('fr-FR')}</td>
        <td>${g.difficulty}<div class="kw">÷ ${g.valueFactors.difficultyDivisor.toLocaleString('fr-FR')}</div></td>
        <td><strong>${g.value.toLocaleString('fr-FR')}</strong><div class="kw">${esc(g.valueFactors.formula)}</div><div class="kw">proximité ${g.valueFactors.proximity.toLocaleString('fr-FR')} — ${esc(g.valueFactors.proximityLabel)}</div></td>
      </tr>`).join('')}
    </tbody></table>
    <h3>Comment lire l’indice de rentabilité</h3>
    <p class="kw">${esc(GAP_VALUE_EXPLAINER)}</p>
    <ul class="kw">
      <li><strong>Volume</strong> : recherches mensuelles mesurées sur la requête.</li>
      <li><strong>Proximité</strong> : distance au top 10 — 1 (11-30), 0,6 (captée par un leader), 0,5 (au-delà du top 10 sans leader), 0,4 (position acquise, citations IA absentes).</li>
      <li><strong>Difficulté</strong> : diviseur 1 + difficulté / 100, soit 1,0 à 2,0 selon la concurrence de la requête.</li>
    </ul>
    <p class="kw">${r.coverageGaps.length} opportunités retenues, soit ${r.gapVolume.toLocaleString('fr-FR')} recherches mensuelles hors de votre couverture actuelle. L’indice sert à comparer les requêtes entre elles, ce n’est pas une prévision de trafic.</p>
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

function semanticHtml(r: MatrixReport): string {
  if (!r.semantic || r.semantic.entries.length === 0) return '';
  return `<div class="section" data-pdf-section="semantic">
    <h2>Présentation sémantique des pages</h2>
    <p class="lead">${esc('Comment chaque page d’accueil se présente aux moteurs et aux IA : structure Hn, balisage Schema.org et passages citables, relevés sur le HTML servi.')}</p>
    <p><span class="badge">${esc(r.semantic.headline)}</span></p>
    <p>${esc(r.semantic.detail)}</p>
    <table><thead><tr><th>Domaine</th><th>Score</th><th>H2 / H3</th><th>Passages citables</th><th>Types Schema.org</th><th>Sommaire</th></tr></thead><tbody>
      ${r.semantic.entries
        .map(
          (e) => `<tr>
        <td>${e.isTarget ? `<strong>${esc(e.domain)} (vous)</strong>` : esc(e.domain)}</td>
        <td>${e.score ?? 'non lu'}</td>
        <td>${e.h2Count} / ${e.h3Count}</td>
        <td>${e.citablePassages}</td>
        <td>${esc(e.schemaTypes.length > 0 ? e.schemaTypes.join(', ') : 'aucun')}</td>
        <td>${e.hasToc ? 'oui' : 'non'}</td>
      </tr>`,
        )
        .join('')}
    </tbody></table>
  </div>`;
}

function eeatHtml(r: MatrixReport): string {
  const e = r.eeat;
  const measured = e.signals.filter((s) => s.status !== 'not_measured');
  if (measured.length === 0 && e.target === null) return '';

  const num = (n: number | null) => (n === null ? 'non mesuré' : n.toLocaleString('fr-FR'));
  const profiles = [e.target, ...e.rivals].filter(Boolean) as NonNullable<MatrixReport['eeat']['target']>[];

  return `<div class="section" data-pdf-section="eeat">
    <h2>Autorité, profil de liens et E-E-A-T</h2>
    <p class="lead">Ce bloc explique pourquoi certaines requêtes sont classées « atteignables » et d’autres non : à contenu égal, c’est l’autorité et les preuves d’identité qui décident.</p>
    <p><span class="badge">${esc(e.backlinkVerdict.headline)}${e.score !== null ? ` · E-E-A-T ${e.score}/100` : ''}</span></p>
    <p>${esc(e.backlinkVerdict.detail)}</p>
    ${
      profiles.length > 0
        ? `<table><thead><tr><th>Domaine</th><th>Authority Score</th><th>Domaines référents</th><th>Backlinks</th><th>Liens / domaine</th><th>Dofollow</th></tr></thead><tbody>
      ${profiles
        .map(
          (p) => `<tr>
        <td>${p.isTarget ? `<strong>${esc(p.domain)}</strong>` : esc(p.domain)}</td>
        <td>${num(p.authorityScore)}</td><td>${num(p.referringDomains)}</td><td>${num(p.backlinks)}</td>
        <td>${num(p.linksPerDomain)}</td>
        <td>${p.dofollowRatio === null ? 'non mesuré' : `${Math.round(p.dofollowRatio * 100)} %`}</td>
      </tr>`,
        )
        .join('')}
    </tbody></table>`
        : ''
    }
    <h3>Les quatre piliers</h3>
    <table><thead><tr><th>Pilier</th><th>Score</th><th>Lecture</th></tr></thead><tbody>
      ${e.pillars
        .map(
          (p) =>
            `<tr><td>${esc(p.label)}</td><td>${p.score === null ? 'non mesuré' : `${p.score}/100`}</td><td>${esc(p.comment)}</td></tr>`,
        )
        .join('')}
    </tbody></table>
    ${
      measured.length > 0
        ? `<h3>Signaux relevés</h3>
    <table><thead><tr><th>Signal</th><th>État</th><th>Ce qui a été trouvé</th></tr></thead><tbody>
      ${measured
        .map(
          (s) =>
            `<tr><td>${esc(s.label)}</td><td>${s.status === 'ok' ? 'présent' : 'absent'}</td><td>${esc(s.evidence)}</td></tr>`,
        )
        .join('')}
    </tbody></table>`
        : ''
    }
  </div>`;
}

function quickWinsHtml(r: MatrixReport): string {
  if (r.plan.quickWins.length === 0) return '';
  return `<div class="section" data-pdf-section="quick-wins">
    <h2>Quick wins</h2>
    <p class="lead">Gains obtenables sans production de contenu neuf ni gain d’autorité : à traiter avant toute nouvelle page.</p>
    ${r.plan.quickWins
      .map(
        (w) => `<div class="action p1" style="margin-bottom:8px;">
      <h3>${esc(w.title)}</h3>
      <p class="kw">Effort ${esc(w.effort)}${w.volume > 0 ? ` · ${w.volume.toLocaleString('fr-FR')} recherches/mois concernées` : ''}</p>
      <dl>
        <dt>Constat mesuré</dt><dd>${esc(w.finding)}</dd>
        <dt>Ce qu’il faut faire</dt><dd>${esc(w.action)}</dd>
        <dt>Gain attendu</dt><dd>${esc(w.gain)}</dd>
      </dl>
    </div>`,
      )
      .join('')}
  </div>`;
}

function phasesHtml(r: MatrixReport): string {
  return `<div class="section" data-pdf-section="plan-phases">
      <h2>Plan en quatre phases</h2>
      <p class="lead">Chaque requête du marché est classée une seule fois, selon sa difficulté confrontée à votre autorité réellement mesurée.</p>
      <p class="kw"><strong>Base de faisabilité :</strong> ${esc(r.plan.reach.basis)}</p>
    </div>
    ${r.plan.phases
      .map(
        (p) => `<div class="section" data-pdf-section="plan-${p.key}">
      <h2>${esc(p.title)}</h2>
      <p class="kw">${esc(p.horizon)} · ${p.items.length} requête(s) · ${p.volume.toLocaleString('fr-FR')} recherches/mois</p>
      <p class="kw"><strong>Règle appliquée :</strong> ${esc(p.rule)}</p>
      <p>${esc(p.rationale)}</p>
      ${
        p.items.length === 0
          ? '<p class="kw">Aucune requête du marché ne tombe dans cette phase.</p>'
          : `<table><thead><tr><th>Requête</th><th>Vol./mois</th><th>Difficulté</th><th>Votre position</th><th>Motif du classement</th></tr></thead><tbody>
        ${p.items
          .map(
            (i) => `<tr><td><strong>${esc(i.keyword)}</strong></td><td>${i.volume.toLocaleString('fr-FR')}</td><td>${i.difficulty}</td>
          <td>${i.targetPosition === null ? 'hors top 30' : `position ${i.targetPosition}`}</td><td class="kw">${esc(i.note)}</td></tr>`,
          )
          .join('')}
      </tbody></table>`
      }
    </div>`,
      )
      .join('')}`;
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
  ${semanticHtml(report)}
  ${eeatHtml(report)}
  ${quickWinsHtml(report)}
  ${phasesHtml(report)}
  ${matrixHtml(matrix, keywords)}
  ${scopeHtml(matrix)}
  <div class="foot" data-pdf-section="footer">Rapport produit par Crawlers.fr — matrice de concurrence Google et moteurs de réponse IA.</div>
</div></body></html>`;
}
