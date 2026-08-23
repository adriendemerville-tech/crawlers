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
/** Budget rédactionnel serré : on tronque proprement au dernier mot. */
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(' ', max) > 0 ? s.lastIndexOf(' ', max) : max)}…`);

const VERDICT_LABEL: Record<BacklinkToxicity['verdict'], string> = {
  sain: 'Sain',
  a_surveiller: 'À surveiller — profil à documenter',
  pollue: 'Risque élevé — profil à investiguer',
};

const DOFOLLOW_LEVEL_LABEL: Record<string, string> = {
  faible: 'Faible',
  a_surveiller: 'À surveiller',
  aggravant: 'Aggravant',
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
    const full = Math.min(35, Math.round((t.dominant_anchor_ratio - 0.3) * 100) + 15);
    const downgraded = t.anchor_attribution === 'all_referrers_downgraded';
    rows.push({
      label: 'Ancre dominante',
      measure: `« ${clip(String(t.dominant_anchor ?? 'n/d'), 30)} » — ${pct(t.dominant_anchor_ratio)}`,
      rule: downgraded
        ? `au-delà de 30 % : 15 pts + 1 pt par point excédentaire (max 35), soit ${full} pts — divisé par 2 car ${pct(t.own_network_backlink_share || 0)} des liens viennent du réseau propre et la source ne rattache pas les ancres à leur domaine`
        : 'au-delà de 30 % : 15 pts + 1 pt par point de pourcentage excédentaire (max 35)',
      points: downgraded ? Math.round(full / 2) : full,
    });
  }
  if (t.unnatural_anchor_ratio >= 0.25) {
    rows.push({
      label: 'Ancres non naturelles',
      measure: `${pct(t.unnatural_anchor_ratio)} (URL nue, générique)`,
      rule: 'au-delà de 25 % : 10 pts + 0,6 pt par point excédentaire (max 25)',
      points: Math.min(25, Math.round((t.unnatural_anchor_ratio - 0.25) * 60) + 10),
    });
  }
  if (t.avg_referrer_rank > 0 && t.avg_referrer_rank < 15) {
    rows.push({
      label: 'Autorité des référents tiers',
      measure: `rank moyen ${t.avg_referrer_rank}/100`,
      rule: 'rank moyen < 15/100 : 20 pts',
      points: 20,
    });
  }
  if (t.links_per_domain >= 25) {
    rows.push({
      label: 'Liens par domaine tiers',
      measure: `${t.links_per_domain} liens/domaine`,
      rule: 'à partir de 25 liens/domaine : liens ÷ 5 (max 20) — empreinte de type annuaire',
      points: Math.min(20, Math.round(t.links_per_domain / 5)),
    });
  }
  if (t.broken_ratio >= 0.1) {
    rows.push({
      label: 'Liens entrants cassés',
      measure: `${pct(t.broken_ratio)} vers page morte`,
      rule: 'à partir de 10 % : 10 pts',
      points: 10,
    });
  }
  const dc = t.dofollow_context;
  if (dc && dc.points > 0) {
    rows.push({
      label: 'Dofollow — facteur contextuel',
      measure: `${Math.round(dc.ratio)} % dofollow + ${dc.corroborating.length} anomalie${dc.corroborating.length > 1 ? 's' : ''}`,
      rule: `un lien dofollow n'est pas toxique en soi : 0 pt sans corroboration, 3 pts avec 1 anomalie mesurée, 8 pts à partir de 2 (faisceau d'indices)`,
      points: dc.points,
    });
  } else if (!dc && dofollowRatio >= 98 && refDomains > 50) {
    rows.push({
      label: 'Ratio dofollow (calibrage antérieur)',
      measure: `${Math.round(dofollowRatio)} % dofollow`,
      rule: 'mesure issue d’un calibrage antérieur : ≥ 98 % avec plus de 50 domaines référents, 5 pts',
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
 * Section HTML compacte (budget rédactionnel ≈ 1 500 caractères de texte) :
 * on garde les chiffres et le détail du calcul, on supprime la pédagogie longue.
 * Rien n'est affirmé sans mesure.
 */
export function buildBacklinkSectionHTML(a: AuthorityData | null, trendHtml = ''): string {
  if (!a) return '';
  if (a.data_source === 'unavailable') {
    return `<div data-marina-block="backlinks" style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:8px;">Profil de backlinks</h3>
      <p style="font-size:12.5px;color:#6b7280;margin:0;">Mesure indisponible${a.unavailable_reason ? ` (${esc(a.unavailable_reason)})` : ''} : aucun score de toxicité n'est calculé.</p>
    </div>`;
  }

  const t = a.toxicity;
  const rows = t ? toxicityPenaltyRows(t, a.referring_domains, a.dofollow_ratio) : [];
  const sum = rows.reduce((s, r) => s + r.points, 0);

  const card = (value: string, label: string) =>
    `<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;">
      <div style="font-size:16px;font-weight:700;color:#111827;">${value}</div>
      <div style="font-size:11px;color:#6b7280;">${label}</div>
    </div>`;

  const sub = (title: string, body: string) =>
    body
      ? `<div data-marina-block="backlinks-sub" style="margin-top:14px;padding:12px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
          <h4 style="font-size:13.5px;font-weight:600;margin:0 0 8px 0;color:#111827;">${title}</h4>
          ${body}
        </div>`
      : '';

  const volumetry = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
      ${card(nf(a.backlinks_total), 'Backlinks externes')}
      ${card(nf(a.referring_domains), 'Domaines référents')}
      ${card(
        t ? String(t.links_per_domain_all ?? t.links_per_domain) : nf(a.referring_domains ? a.backlinks_total / a.referring_domains : 0),
        'Liens / domaine',
      )}
      ${card(`${Math.round(a.dofollow_ratio)} %`, 'Dofollow')}
      ${card(nf(a.broken_backlinks), 'Liens cassés')}
      ${card(`${a.authority_score}/100`, 'Authority Score Crawlers')}
    </div>`;

  const toxTable = t
    ? `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
        <div style="font-size:22px;font-weight:700;color:${t.toxicity_score >= 60 ? '#b91c1c' : t.toxicity_score >= 35 ? '#b45309' : '#15803d'};">${t.toxicity_score}/100</div>
        <div style="font-size:13px;font-weight:600;color:#111827;">${VERDICT_LABEL[t.verdict]}</div>
        <div style="font-size:11.5px;color:#6b7280;">Seuils 35 / 60</div>
      </div>
      ${rows.length
        ? `<table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:6px 10px;text-align:left;color:#6b7280;">Signal</th>
              <th style="padding:6px 10px;text-align:left;color:#6b7280;">Mesure</th>
              <th style="padding:6px 10px;text-align:right;color:#6b7280;">Pts</th>
            </tr></thead>
            <tbody>
              ${rows
                .map(
                  (r) => `<tr style="border-bottom:1px solid #e5e7eb;">
                    <td style="padding:6px 10px;font-weight:600;color:#111827;">${esc(r.label)}</td>
                    <td style="padding:6px 10px;color:#374151;">${r.measure}</td>
                    <td style="padding:6px 10px;text-align:right;font-weight:700;color:#111827;">+${r.points}</td>
                  </tr>`,
                )
                .join('')}
              <tr><td colspan="2" style="padding:6px 10px;font-weight:600;">Total (borné à 100)</td><td style="padding:6px 10px;text-align:right;font-weight:700;">${Math.min(100, sum)}</td></tr>
            </tbody>
          </table>`
        : `<p style="font-size:12.5px;color:#374151;margin:0;">Aucun seuil franchi sur l'échantillon : score ${t.toxicity_score}/100.</p>`}
      <div style="font-size:12px;color:#6b7280;margin-top:6px;">Périmètre : ${t.scope === 'third_party_only' ? 'liens tiers' : 'tous référents'}.</div>
      <div style="font-size:12.5px;color:#374151;margin-top:6px;">${clip(esc(t.recommendation), 180)}</div>`
    : '<p style="font-size:12.5px;color:#6b7280;margin:0;">Échantillon insuffisant : aucun verdict.</p>';

  const seg = a.segmentation;
  const COMPARTMENT_LABEL: Record<string, string> = {
    own_network: 'Réseau propre',
    directory_platform: 'Annuaires / plateformes',
    third_party_editorial: 'Éditorial tiers',
  };
  const segRow = (c: { compartment: string; domains: number; backlinks: number; share_domains: number; avg_rank: number; top_domains: string[] }) =>
    `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:6px 10px;font-weight:600;color:#111827;">${COMPARTMENT_LABEL[c.compartment] || esc(c.compartment)}</td>
      <td style="padding:6px 10px;text-align:right;">${nf(c.domains)}</td>
      <td style="padding:6px 10px;text-align:right;">${pct(c.share_domains)}</td>
      <td style="padding:6px 10px;text-align:right;">${nf(c.backlinks)}</td>
      <td style="padding:6px 10px;text-align:right;">${c.avg_rank}/100</td>
    </tr>`;
  const segHtml = seg && seg.sampled > 0
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:6px 10px;text-align:left;color:#6b7280;">Compartiment</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Domaines</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Part</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Liens</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Rank moyen</th>
        </tr></thead>
        <tbody>${segRow(seg.own_network)}${segRow(seg.directory_platform)}${segRow(seg.third_party_editorial)}</tbody>
      </table>
      <div style="font-size:11.5px;color:#6b7280;margin-top:6px;">Réseau propre : ${seg.own_network_source === 'verified' ? 'prouvé' : seg.own_network_source === 'brand_token_suspected' ? 'à confirmer' : seg.own_network_source === 'mixed' ? 'partiellement prouvé' : 'non détecté'}.</div>`
    : '';

  const dctx = t?.dofollow_context ?? null;
  const dofollowHtml = dctx
    ? `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
        <div style="font-size:13px;font-weight:700;color:${dctx.level === 'aggravant' ? '#b91c1c' : dctx.level === 'a_surveiller' ? '#b45309' : '#15803d'};">${DOFOLLOW_LEVEL_LABEL[dctx.level]}</div>
        <div style="font-size:12px;color:#6b7280;">${Math.round(dctx.ratio)} % dofollow · ${dctx.points} pt${dctx.points > 1 ? 's' : ''}</div>
      </div>
      ${dctx.corroborating.length
        ? `<ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:1.6;">${dctx.corroborating.slice(0, 2).map((c) => `<li>${clip(esc(c), 90)}</li>`).join('')}${dctx.corroborating.length > 2 ? `<li>+${dctx.corroborating.length - 2} autres</li>` : ''}</ul>`
        : `<p style="font-size:12px;color:#6b7280;margin:0;">Aucune anomalie corroborante : 0 pt. Un lien dofollow n'est pas toxique en soi.</p>`}`
    : '';

  const ind = t?.independence ?? null;
  const independenceHtml = ind
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
        ${card(nf(ind.apparent_backlinks), 'Apparente')}
        ${card(nf(ind.own_network_backlinks), 'Réseau propre')}
        ${card(nf(ind.repeated_third_party_backlinks), 'Tiers répétés')}
        ${card(nf(ind.estimated_independent_backlinks), 'Indépendante estimée')}
        ${card(pct(ind.dependency_share), 'Part dépendante')}
      </div>
      <p style="font-size:11.5px;color:#6b7280;margin:6px 0 0;">Simulation indicative, non équivalente au calcul de Google.</p>`
    : '';

  const h = a.own_network_hygiene;
  const hygieneHtml = h && h.verdict !== 'non_mesure'
    ? `<div style="font-size:12px;color:#374151;"><strong style="color:${h.verdict === 'a_corriger_a_la_source' ? '#b45309' : '#15803d'};">${h.verdict === 'a_corriger_a_la_source' ? 'À corriger à la source' : 'Sain'}</strong> — ${nf(h.domains)} domaines · ${nf(h.backlinks)} liens · ${h.links_per_domain} liens/domaine. Jamais de désaveu sur ces domaines.</div>`
    : '';

  const refs = a.top_referring_domains?.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:6px 10px;text-align:left;color:#6b7280;">Domaine</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Rank</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Liens</th>
        </tr></thead>
        <tbody>${a.top_referring_domains
          .slice(0, 5)
          .map(
            (d) => `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:6px 10px;">${esc(d.domain)}</td><td style="padding:6px 10px;text-align:right;">${d.rank}</td><td style="padding:6px 10px;text-align:right;">${nf(d.backlinks)}</td></tr>`,
          )
          .join('')}</tbody>
      </table>`
    : '';

  const anchors = a.top_anchors_detail?.length
    ? `<ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:1.6;">${a.top_anchors_detail
        .slice(0, 5)
        .map((x) => `<li>« ${esc(x.anchor)} » — ${nf(x.count)}</li>`)
        .join('')}</ul>`
    : '';

  const reliability = `<p style="font-size:11.5px;color:#6b7280;margin:0;line-height:1.6;">
      Échantillon ${nf(a.referring_domains_sampled)}/${nf(a.referring_domains)} domaines · ${nf(a.anchors_sampled)} ancres · fiabilité ${CONFIDENCE_LABEL[a.confidence] || a.confidence} · DataForSEO ${esc(a.fetched_at?.slice(0, 10) || 'n/d')}, calibration v${a.calibration_version}. Estimation Crawlers : signal d'investigation, pas preuve de pénalité.
    </p>`;

  return `<div data-marina-block="backlinks" style="margin-top:20px;padding:16px;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:4px;">Profil de backlinks — volumétrie, autorité et toxicité</h3>
    <p style="font-size:12px;color:#6b7280;margin:0 0 10px 0;">Liens externes vers ${esc(a.domain)}.</p>
    ${volumetry}
    ${sub('Score de toxicité — détail du calcul', toxTable)}
    ${sub('Segmentation du profil', segHtml)}
    ${sub(dctx ? `Dofollow (${Math.round(dctx.ratio)} %) — facteur contextuel` : 'Dofollow — facteur contextuel', dofollowHtml)}
    ${sub('Autorité apparente vs indépendante estimée', independenceHtml)}
    ${sub('Hygiène du réseau propre', hygieneHtml)}
    ${sub('Principaux domaines référents', refs)}
    ${sub('Ancres les plus fréquentes', anchors)}
    ${trendHtml}
    ${sub('Fiabilité et portée', reliability)}
  </div>`;
}

