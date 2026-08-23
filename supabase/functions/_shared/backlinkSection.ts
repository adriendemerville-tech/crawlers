// Section dédiée « Profil de backlinks » des rapports (Marina, audit expert).
//
// 100 % déterministe, 0 token LLM : on relit les champs déjà mesurés par
// `domainAuthority.ts` et on ré-expose le détail du calcul — volumétrie,
// Authority Score, contribution de chaque signal au score de toxicité, seuils
// de verdict, répartition et fiabilité de l'échantillon.
//
// Les points de toxicité affichés reprennent exactement les formules de
// `computeBacklinkToxicity` : le lecteur peut refaire l'addition à la main.

import type { AuthorityData, BacklinkToxicity } from './domainAuthority.ts';

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nf = (n: number) => Math.round(n).toLocaleString('fr-FR');
const pct = (r: number) => `${Math.round((r || 0) * 100)} %`;

const VERDICT_LABEL: Record<BacklinkToxicity['verdict'], string> = {
  sain: 'Sain',
  a_surveiller: 'À surveiller',
  pollue: 'Pollué',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'élevée',
  medium: 'moyenne',
  low: 'faible',
};

interface PenaltyRow {
  label: string;
  measure: string;
  rule: string;
  points: number;
}

/** Recompose, règle par règle, les points de toxicité issus des mesures stockées. */
export function toxicityPenaltyRows(t: BacklinkToxicity, refDomains: number, dofollowRatio: number): PenaltyRow[] {
  const rows: PenaltyRow[] = [];

  if (t.dominant_anchor_ratio >= 0.3) {
    rows.push({
      label: 'Ancre dominante',
      measure: `« ${t.dominant_anchor ?? 'n/d'} » sur ${pct(t.dominant_anchor_ratio)} de l'échantillon`,
      rule: 'au-delà de 30 % : 15 pts + 1 pt par point de pourcentage excédentaire (max 35)',
      points: Math.min(35, Math.round((t.dominant_anchor_ratio - 0.3) * 100) + 15),
    });
  }
  if (t.unnatural_anchor_ratio >= 0.25) {
    rows.push({
      label: 'Ancres non naturelles',
      measure: `${pct(t.unnatural_anchor_ratio)} d'ancres URL nue / mot générique / emoji`,
      rule: 'au-delà de 25 % : 10 pts + 0,6 pt par point excédentaire (max 25)',
      points: Math.min(25, Math.round((t.unnatural_anchor_ratio - 0.25) * 60) + 10),
    });
  }
  if (t.avg_referrer_rank > 0 && t.avg_referrer_rank < 15) {
    rows.push({
      label: 'Autorité des référents',
      measure: `rank moyen ${t.avg_referrer_rank}/100 sur l'échantillon`,
      rule: 'rank moyen < 15/100 : 20 pts',
      points: 20,
    });
  }
  if (t.links_per_domain >= 25) {
    rows.push({
      label: 'Liens par domaine',
      measure: `${t.links_per_domain} liens par domaine référent`,
      rule: 'à partir de 25 liens/domaine : liens ÷ 5 (max 20) — empreinte de type annuaire',
      points: Math.min(20, Math.round(t.links_per_domain / 5)),
    });
  }
  if (t.broken_ratio >= 0.1) {
    rows.push({
      label: 'Liens entrants cassés',
      measure: `${pct(t.broken_ratio)} des backlinks pointent une page morte`,
      rule: 'à partir de 10 % : 10 pts',
      points: 10,
    });
  }
  if (dofollowRatio >= 98 && refDomains > 50) {
    rows.push({
      label: 'Ratio dofollow',
      measure: `${Math.round(dofollowRatio)} % de liens dofollow`,
      rule: '≥ 98 % avec plus de 50 domaines référents : 5 pts',
      points: 5,
    });
  }

  const suspicious = t.signals.find((s) => /hors-sujet/i.test(s));
  if (suspicious) {
    const n = Number(suspicious.match(/^(\d+)/)?.[1] || 0);
    rows.push({
      label: 'Référents hors-sujet',
      measure: esc(suspicious),
      rule: '12 pts + 6 pts par domaine détecté (max 30) — interdit le verdict « sain »',
      points: Math.min(30, 12 + n * 6),
    });
  }

  return rows;
}

/**
 * Section HTML autonome. Rien n'est affirmé sans mesure : chaque bloc absent
 * est remplacé par la raison de son absence.
 */
export function buildBacklinkSectionHTML(a: AuthorityData | null, trendHtml = ''): string {
  if (!a) return '';
  if (a.data_source === 'unavailable') {
    return `<div data-marina-block="backlinks" style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:8px;">Profil de backlinks</h3>
      <p style="font-size:12.5px;color:#6b7280;margin:0;">Mesure indisponible sur ce domaine${a.unavailable_reason ? ` (${esc(a.unavailable_reason)})` : ''}. Aucun score de toxicité n'est calculé : aucune conclusion sur le profil de liens ne peut être tirée dans ce rapport.</p>
    </div>`;
  }

  const t = a.toxicity;
  const rows = t ? toxicityPenaltyRows(t, a.referring_domains, a.dofollow_ratio) : [];
  const sum = rows.reduce((s, r) => s + r.points, 0);

  const card = (value: string, label: string, note?: string) =>
    `<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;">
      <div style="font-size:16px;font-weight:700;color:#111827;">${value}</div>
      <div style="font-size:11px;color:#6b7280;">${label}</div>
      ${note ? `<div style="font-size:10.5px;color:#9ca3af;margin-top:2px;">${note}</div>` : ''}
    </div>`;

  const sub = (title: string, lead: string, body: string) =>
    body
      ? `<div data-marina-block="backlinks-sub" style="margin-top:16px;padding:14px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
          <h4 style="font-size:14px;font-weight:600;margin:0 0 4px 0;color:#111827;">${title}</h4>
          <p style="font-size:12px;color:#6b7280;margin:0 0 10px 0;">${lead}</p>
          ${body}
        </div>`
      : '';

  const volumetry = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
      ${card(nf(a.backlinks_total), 'Backlinks entrants (externes)', 'liens depuis d’autres domaines, liens internes exclus')}
      ${card(nf(a.referring_domains), 'Domaines référents')}
      ${card(t ? String(t.links_per_domain) : nf(a.referring_domains ? a.backlinks_total / a.referring_domains : 0), 'Liens par domaine', 'un ratio élevé signe quelques sources massives')}
      ${card(`${Math.round(a.dofollow_ratio)} %`, 'Liens dofollow')}
      ${card(nf(a.broken_backlinks), 'Liens entrants cassés')}
      ${card(`${a.authority_score}/100`, 'Authority Score Crawlers', 'estimation propriétaire, plafonnée à 92')}
    </div>`;

  const scoreExplain = `<ul style="margin:0;padding-left:18px;font-size:12.5px;color:#374151;line-height:1.7;">
      <li>Rank du domaine mesuré : <strong>${a.domain_rank_raw}</strong>/1000 → normalisé <strong>${a.domain_rank}</strong>/100 (courbe logarithmique, l’échelle source n’est pas linéaire).</li>
      <li>Composition : 60 % rank normalisé + 40 % diversité des référents (log₁₀ des domaines × 11), pondérée par l’autorité moyenne des référents.</li>
      <li>Pénalité de toxicité appliquée ensuite : jusqu’à −45 % du score.</li>
      <li>Plafond absolu 92/100 : ce n’est pas un score Semrush, Moz ou Majestic, mais une estimation Crawlers.</li>
    </ul>`;

  const toxTable = t
    ? `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:10px;">
        <div style="font-size:22px;font-weight:700;color:${t.toxicity_score >= 60 ? '#b91c1c' : t.toxicity_score >= 35 ? '#b45309' : '#15803d'};">${t.toxicity_score}/100</div>
        <div style="font-size:13px;font-weight:600;color:#111827;">Verdict : ${VERDICT_LABEL[t.verdict]}</div>
        <div style="font-size:11.5px;color:#6b7280;">Seuils : 0-34 sain · 35-59 à surveiller · 60-100 pollué</div>
      </div>
      ${rows.length
        ? `<table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:6px 10px;text-align:left;color:#6b7280;">Signal</th>
              <th style="padding:6px 10px;text-align:left;color:#6b7280;">Mesure</th>
              <th style="padding:6px 10px;text-align:left;color:#6b7280;">Règle appliquée</th>
              <th style="padding:6px 10px;text-align:right;color:#6b7280;">Points</th>
            </tr></thead>
            <tbody>
              ${rows
                .map(
                  (r) => `<tr style="border-bottom:1px solid #e5e7eb;">
                    <td style="padding:6px 10px;font-weight:600;color:#111827;">${esc(r.label)}</td>
                    <td style="padding:6px 10px;color:#374151;">${r.measure}</td>
                    <td style="padding:6px 10px;color:#6b7280;">${esc(r.rule)}</td>
                    <td style="padding:6px 10px;text-align:right;font-weight:700;color:#111827;">+${r.points}</td>
                  </tr>`,
                )
                .join('')}
              <tr><td colspan="3" style="padding:6px 10px;font-weight:600;">Total (borné à 100)</td><td style="padding:6px 10px;text-align:right;font-weight:700;">${Math.min(100, sum)}</td></tr>
            </tbody>
          </table>`
        : `<p style="font-size:12.5px;color:#374151;margin:0;">Aucun seuil de manipulation n’est franchi sur l’échantillon mesuré : le score reste à ${t.toxicity_score}/100. Les critères testés sont l’ancre dominante (&gt; 30 %), les ancres non naturelles (&gt; 25 %), l’autorité moyenne des référents (&lt; 15/100), les liens par domaine (≥ 25), les liens cassés (≥ 10 %), un ratio dofollow ≥ 98 % et la présence de référents hors-sujet.</p>`}
      <div style="font-size:12.5px;color:#374151;margin-top:10px;"><strong>Lecture :</strong> ${esc(t.recommendation)}</div>`
    : '<p style="font-size:12.5px;color:#6b7280;margin:0;">Échantillon insuffisant pour calculer un score de toxicité : aucun verdict n’est émis.</p>';

  const dist = a.distribution;
  const bucketList = (b: { key: string; share: number }[]) =>
    b
      .slice(0, 5)
      .map((x) => `<li>${esc(x.key)} — ${pct(x.share)}</li>`)
      .join('');
  const distHtml = dist && dist.source !== 'unavailable'
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;font-size:12px;color:#374151;">
        ${dist.tld.length ? `<div><div style="font-weight:600;color:#111827;margin-bottom:4px;">Extensions (TLD)</div><ul style="margin:0;padding-left:16px;">${bucketList(dist.tld)}</ul></div>` : ''}
        ${dist.countries.length ? `<div><div style="font-weight:600;color:#111827;margin-bottom:4px;">Pays des référents</div><ul style="margin:0;padding-left:16px;">${bucketList(dist.countries)}</ul></div>` : ''}
        ${dist.platform_types.length ? `<div><div style="font-weight:600;color:#111827;margin-bottom:4px;">Types de plateformes</div><ul style="margin:0;padding-left:16px;">${bucketList(dist.platform_types)}</ul></div>` : ''}
      </div>
      ${dist.signals.length ? `<ul style="margin:10px 0 0;padding-left:18px;font-size:12px;color:#374151;line-height:1.6;">${dist.signals.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${dist.recommendation ? `<div style="font-size:12.5px;color:#374151;margin-top:8px;"><strong>Lecture :</strong> ${esc(dist.recommendation)}</div>` : ''}`
    : '';

  const refs = a.top_referring_domains?.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:6px 10px;text-align:left;color:#6b7280;">Domaine référent</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Rank</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Liens</th>
        </tr></thead>
        <tbody>${a.top_referring_domains
          .slice(0, 10)
          .map(
            (d) => `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:6px 10px;">${esc(d.domain)}</td><td style="padding:6px 10px;text-align:right;">${d.rank}</td><td style="padding:6px 10px;text-align:right;">${nf(d.backlinks)}</td></tr>`,
          )
          .join('')}</tbody>
      </table>`
    : '';

  const anchors = a.top_anchors_detail?.length
    ? `<ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:1.7;">${a.top_anchors_detail
        .slice(0, 10)
        .map((x) => `<li>« ${esc(x.anchor)} » — ${nf(x.count)} occurrence${x.count > 1 ? 's' : ''}</li>`)
        .join('')}</ul>`
    : '';

  const pages = a.top_linked_pages?.length
    ? `<ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:1.7;">${a.top_linked_pages
        .slice(0, 8)
        .map((p) => `<li>${esc(p.url)} — ${nf(p.referring_domains)} domaines, ${nf(p.backlinks)} liens</li>`)
        .join('')}</ul>`
    : '';

  const reliability = `<p style="font-size:12px;color:#6b7280;margin:0;line-height:1.7;">
      Échantillon analysé : ${nf(a.referring_domains_sampled)} domaines référents sur ${nf(a.referring_domains)} et ${nf(a.anchors_sampled)} ancres
      (${a.anchors_source === 'anchors_endpoint' ? 'ancres mesurées sur l’endpoint dédié' : a.anchors_source === 'summary_sample' ? 'ancres issues du résumé, précision réduite' : 'ancres indisponibles'}).
      Fiabilité de la mesure : <strong>${CONFIDENCE_LABEL[a.confidence] || a.confidence}</strong>${a.confidence_reason ? ` — ${esc(a.confidence_reason)}` : ''}.
      Source : DataForSEO (${esc(a.fetched_at?.slice(0, 10) || 'n/d')}), calibration v${a.calibration_version}. Les scores d’autorité et de toxicité sont des estimations Crawlers, pas des scores Semrush, Moz ou Majestic.
    </p>`;

  return `<div data-marina-block="backlinks" style="margin-top:20px;padding:16px;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:4px;">Profil de backlinks — volumétrie, autorité et toxicité</h3>
    <p style="font-size:12px;color:#6b7280;margin:0 0 12px 0;">Ce que d’autres sites disent de ${esc(a.domain)}. Tous les liens comptés ici sont <strong>externes</strong> : le maillage interne est exclu de la mesure. Le détail du calcul est donné pour que chaque chiffre soit vérifiable.</p>
    ${volumetry}
    ${sub('Comment l’Authority Score est calculé', 'Un score maison, reconstitué à partir du rank mesuré et de la diversité des référents.', scoreExplain)}
    ${sub('Score de toxicité — détail du calcul', 'Chaque signal mesuré ajoute des points. Le total borné à 100 donne le verdict.', toxTable)}
    ${sub('Répartition du profil de liens', 'D’où viennent les liens : extensions, pays et types de plateformes mesurés sur l’échantillon.', distHtml)}
    ${sub('Principaux domaines référents', 'Les dix sources les plus actives de l’échantillon, avec leur autorité mesurée.', refs)}
    ${sub('Ancres les plus fréquentes', 'Le texte cliquable des liens entrants : une ancre trop répétée est le premier marqueur d’achat de liens.', anchors)}
    ${sub('Pages les plus liées', 'Les pages du domaine qui concentrent les liens externes.', pages)}
    ${trendHtml}
    ${sub('Fiabilité et portée de la mesure', 'Taille de l’échantillon et limites à garder en tête avant toute action de désaveu.', reliability)}
  </div>`;
}
