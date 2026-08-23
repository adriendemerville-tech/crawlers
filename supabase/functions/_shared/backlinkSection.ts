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
      measure: `« ${t.dominant_anchor ?? 'n/d'} » sur ${pct(t.dominant_anchor_ratio)} de l'échantillon`,
      rule: downgraded
        ? `au-delà de 30 % : 15 pts + 1 pt par point excédentaire (max 35), soit ${full} pts — divisé par 2 car ${pct(t.own_network_backlink_share || 0)} des liens viennent du réseau propre et la source ne rattache pas les ancres à leur domaine`
        : 'au-delà de 30 % : 15 pts + 1 pt par point de pourcentage excédentaire (max 35)',
      points: downgraded ? Math.round(full / 2) : full,
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
      label: 'Autorité des référents tiers',
      measure: `rank moyen ${t.avg_referrer_rank}/100 sur l'échantillon hors réseau propre`,
      rule: 'rank moyen < 15/100 : 20 pts',
      points: 20,
    });
  }
  if (t.links_per_domain >= 25) {
    rows.push({
      label: 'Liens par domaine tiers',
      measure: `${t.links_per_domain} liens par domaine référent hors réseau propre${typeof t.links_per_domain_all === 'number' ? ` (${t.links_per_domain_all} tous référents confondus)` : ''}`,
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
  const dc = t.dofollow_context;
  if (dc && dc.points > 0) {
    rows.push({
      label: 'Dofollow — facteur contextuel',
      measure: `${Math.round(dc.ratio)} % de liens dofollow, avec ${dc.corroborating.length} anomalie${dc.corroborating.length > 1 ? 's' : ''} structurelle${dc.corroborating.length > 1 ? 's' : ''} corroborante${dc.corroborating.length > 1 ? 's' : ''}`,
      rule: `un lien dofollow n'est pas toxique en soi : 0 pt sans corroboration, 3 pts avec 1 anomalie mesurée, 8 pts à partir de 2 (faisceau d'indices)`,
      points: dc.points,
    });
  } else if (!dc && dofollowRatio >= 98 && refDomains > 50) {
    rows.push({
      label: 'Ratio dofollow (calibrage antérieur)',
      measure: `${Math.round(dofollowRatio)} % de liens dofollow`,
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
      ${card(
        t ? String(t.links_per_domain_all ?? t.links_per_domain) : nf(a.referring_domains ? a.backlinks_total / a.referring_domains : 0),
        'Liens par domaine',
        t && typeof t.links_per_domain_all === 'number' && t.links_per_domain_all !== t.links_per_domain
          ? `${t.links_per_domain} hors réseau propre — un ratio élevé signe quelques sources massives`
          : 'un ratio élevé signe quelques sources massives',
      )}

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
      <div style="font-size:12px;color:#6b7280;margin-top:8px;">Périmètre du score : ${t.scope === 'third_party_only' ? 'liens tiers uniquement. Le réseau propre est mesuré séparément ci-dessous — le désaveu n’a de sens que sur des domaines que vous ne contrôlez pas.' : 'tous les référents de l’échantillon (aucun réseau propre détecté).'}</div>
      <div style="font-size:12.5px;color:#374151;margin-top:10px;"><strong>Lecture :</strong> ${esc(t.recommendation)}</div>`
    : '<p style="font-size:12.5px;color:#6b7280;margin:0;">Échantillon insuffisant pour calculer un score de toxicité : aucun verdict n’est émis.</p>';

  // Trois compartiments mesurés séparément : le lecteur voit d'où vient son
  // profil au lieu de découvrir qu'une partie a été retirée du calcul.
  const seg = a.segmentation;
  const COMPARTMENT_LABEL: Record<string, string> = {
    own_network: 'Réseau propre (vos domaines)',
    directory_platform: 'Annuaires et plateformes',
    third_party_editorial: 'Éditorial tiers',
  };
  const segRow = (c: { compartment: string; domains: number; backlinks: number; share_domains: number; avg_rank: number; top_domains: string[] }) =>
    `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:6px 10px;font-weight:600;color:#111827;">${COMPARTMENT_LABEL[c.compartment] || esc(c.compartment)}</td>
      <td style="padding:6px 10px;text-align:right;">${nf(c.domains)}</td>
      <td style="padding:6px 10px;text-align:right;">${pct(c.share_domains)}</td>
      <td style="padding:6px 10px;text-align:right;">${nf(c.backlinks)}</td>
      <td style="padding:6px 10px;text-align:right;">${c.avg_rank}/100</td>
      <td style="padding:6px 10px;color:#6b7280;">${c.top_domains.slice(0, 4).map((d) => esc(d)).join(', ') || '—'}</td>
    </tr>`;
  const segHtml = seg && seg.sampled > 0
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:6px 10px;text-align:left;color:#6b7280;">Compartiment</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Domaines</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Part</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Liens</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;">Rank moyen</th>
          <th style="padding:6px 10px;text-align:left;color:#6b7280;">Exemples</th>
        </tr></thead>
        <tbody>
          ${segRow(seg.own_network)}
          ${segRow(seg.directory_platform)}
          ${segRow(seg.third_party_editorial)}
        </tbody>
      </table>
      <div style="font-size:12px;color:#6b7280;margin-top:8px;">
        Classification « vos domaines » : ${seg.own_network_source === 'verified'
          ? 'propriété prouvée (accès Search Console, fiche établissement ou site suivi).'
          : seg.own_network_source === 'brand_token_suspected'
            ? 'rattachement par racine de marque commune — <strong>suggestion à confirmer</strong>, pas une preuve de propriété.'
            : seg.own_network_source === 'mixed'
              ? 'en partie prouvée, en partie déduite de la racine de marque (à confirmer).'
              : 'aucun domaine de votre réseau détecté dans l’échantillon.'}
        Le score de toxicité ne porte que sur les liens tiers ; les deux volumétries (avec et hors réseau propre) restent affichées pour que le calcul soit vérifiable.
      </div>`
    : '';

  // ── Dofollow lu en contexte, autorité indépendante, scénarios Google ───────
  const dctx = t?.dofollow_context ?? null;
  const dofollowHtml = dctx
    ? `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:700;color:${dctx.level === 'aggravant' ? '#b91c1c' : dctx.level === 'a_surveiller' ? '#b45309' : '#15803d'};">${DOFOLLOW_LEVEL_LABEL[dctx.level]}</div>
        <div style="font-size:12px;color:#6b7280;">${Math.round(dctx.ratio)} % de liens dofollow · ${dctx.points} pt${dctx.points > 1 ? 's' : ''} ajoutés au score de toxicité</div>
      </div>
      <p style="font-size:12.5px;color:#374151;margin:0 0 8px 0;line-height:1.7;">Un lien dofollow n’est pas intrinsèquement toxique : c’est le comportement normal d’un lien éditorial, et un profil naturel peut contenir une très forte proportion de liens dofollow. Le signal n’apparaît que lorsque ce caractère se combine à d’autres anomalies structurelles.</p>
      ${dctx.corroborating.length
        ? `<div style="font-size:12px;color:#111827;font-weight:600;margin-bottom:4px;">Anomalies mesurées qui corroborent la lecture</div>
           <ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:1.7;">${dctx.corroborating.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
           <p style="font-size:12.5px;color:#374151;margin:8px 0 0 0;line-height:1.7;">Dans ce contexte, les liens ne ressemblent plus nécessairement à autant de recommandations indépendantes : une partie de la volumétrie peut correspondre à quelques relations entre domaines, répétées sur un grand nombre de pages. Le caractère dofollow devient alors un facteur aggravant, car ces liens sont susceptibles de transmettre des signaux SEO, contrairement à des liens qualifiés <em>nofollow</em>, <em>ugc</em> ou <em>sponsored</em>. Cela ne permet pas de conclure qu’une pénalité Google existe : seul Google connaît le traitement réellement appliqué.</p>`
        : `<p style="font-size:12px;color:#6b7280;margin:0;">Aucune anomalie structurelle corroborante mesurée : le ratio dofollow n’ajoute aucun point.</p>`}`
    : '';

  const sitewideHtml = `<p style="font-size:12.5px;color:#374151;margin:0 0 8px 0;line-height:1.7;">
      La volumétrie brute doit être interprétée avec prudence. Si un site place un lien dans son pied de page et que ce pied de page est présent sur 1 300 pages, l’outil comptabilise environ 1 300 backlinks — mais il ne s’agit pas de 1 300 recommandations éditoriales indépendantes : c’est une seule relation entre deux sites, répétée techniquement.
    </p>
    <ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:1.7;">
      <li>liens réellement éditoriaux et contextuels ;</li>
      <li>liens sitewide (pied de page, en-tête, sidebar) ;</li>
      <li>liens de navigation et liens issus de templates ;</li>
      <li>liens de domaines indépendants ;</li>
      <li>liens d’un réseau contrôlé ou fortement apparenté.</li>
    </ul>`;

  const ind = t?.independence ?? null;
  const independenceHtml = ind
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:10px;">
        ${card(nf(ind.apparent_backlinks), 'Autorité apparente', 'backlinks externes bruts')}
        ${card(nf(ind.own_network_backlinks), 'Liens du réseau propre')}
        ${card(nf(ind.repeated_third_party_backlinks), 'Liens tiers répétés', 'au-delà de 3 liens par domaine')}
        ${card(nf(ind.estimated_independent_backlinks), 'Autorité indépendante estimée', `sur ${nf(ind.estimated_independent_domains)} domaines tiers`)}
        ${card(pct(ind.dependency_share), 'Part dépendante', 'réseau propre + répétition')}
      </div>
      <p style="font-size:12px;color:#6b7280;margin:0;line-height:1.7;">${esc(ind.method)}</p>`
    : '';

  // Les scénarios Google ne se lisent que si un risque est réellement mesuré :
  // sur un profil sain, ce bloc serait alarmiste sans fait qui le justifie.
  const googleScenariosRelevant = Boolean(
    (dctx && dctx.level !== 'faible') || (t && t.toxicity_score >= 40),
  );
  const googleHtml = googleScenariosRelevant
    ? `<p style="font-size:12.5px;color:#374151;margin:0;line-height:1.7;">
      Si les systèmes de Google relèvent les mêmes caractéristiques, plusieurs traitements sont possibles. Le premier scénario est la <strong>neutralisation</strong> de tout ou partie des liens : Google ne leur attribue simplement pas le poids attendu, et un volume important de backlinks disparaît de fait du calcul d’autorité sans qu’une pénalité du domaine soit nécessaire. Le deuxième est une <strong>dévaluation plus large</strong> des signaux issus du réseau, lorsque les liens ne sont pas considérés comme des recommandations éditoriales indépendantes. Dans les situations les plus problématiques, lorsqu’un schéma de liens destiné à manipuler les classements est établi, une <strong>action plus sévère</strong> reste envisageable. Ce rapport n’affirme jamais qu’une pénalité existe sur la seule base de l’analyse des backlinks.
    </p>`
    : '';


  const methodNoteHtml = `<p style="font-size:12px;color:#374151;margin:0;line-height:1.7;">
      <strong>Important :</strong> ce score est une estimation propriétaire du risque de profil de liens. Il ne correspond pas à une note Google et ne permet pas de conclure à l’existence d’une pénalité algorithmique ou manuelle.${t && t.toxicity_score >= 60 ? ' Un score élevé signifie que plusieurs caractéristiques du profil sont compatibles avec un schéma de liens artificiel ou sur-optimisé : c’est un signal d’investigation, pas une preuve de sanction.' : ''}
      Avant tout désaveu, vérifier que le domaine est réellement tiers, que les liens sont manifestement construits, et qu’il ne s’agit pas d’un annuaire ou d’une plateforme légitime. Sur les domaines du réseau propre : ne pas désavouer, corriger à la source. Un domaine n’est jamais déclaré rattaché au réseau propre sur la seule base d’une racine de marque commune — il est alors marqué « à confirmer ».
    </p>`;

  const h = a.own_network_hygiene;

  const hygieneHtml = h && h.verdict !== 'non_mesure'
    ? `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:700;color:${h.verdict === 'a_corriger_a_la_source' ? '#b45309' : '#15803d'};">${h.verdict === 'a_corriger_a_la_source' ? 'À corriger à la source' : 'Sain'}</div>
        <div style="font-size:12px;color:#6b7280;">${nf(h.domains)} domaines · ${nf(h.backlinks)} liens · ${h.links_per_domain} liens par domaine</div>
      </div>
      <ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:1.7;">${h.signals.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <div style="font-size:12.5px;color:#374151;margin-top:8px;"><strong>Lecture :</strong> ${esc(h.recommendation)}</div>`
    : '';


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
    ${sub('Segmentation du profil — trois compartiments', 'Vos propres domaines, les annuaires et l’éditorial tiers sont mesurés séparément : ils n’exposent pas aux mêmes risques et ne se corrigent pas de la même façon.', segHtml)}
    ${sub('Score de toxicité — détail du calcul', 'Risque de dévaluation sur les liens tiers. Le score est la conséquence du faisceau d’indices mesuré, pas son point de départ : chaque signal ajoute des points, le total borné à 100 donne le niveau de risque.', toxTable)}
    ${sub('Lecture méthodologique et règle de désaveu', 'Ce que ce score dit — et ce qu’il ne dit pas.', methodNoteHtml)}
    ${sub(dctx ? `Pourquoi ${Math.round(dctx.ratio)} % dofollow devient un signal dans ce contexte ?` : 'Dofollow — facteur contextuel', 'Le caractère dofollow est un facteur contextuel, jamais une preuve autonome de toxicité.', dofollowHtml)}
    ${sub('1 lien ne vaut pas nécessairement 1 recommandation', 'Pourquoi la volumétrie brute doit être segmentée avant d’être interprétée.', sitewideHtml)}
    ${sub('Autorité apparente vs autorité indépendante estimée', 'Simulation indicative — non équivalente au calcul de Google.', independenceHtml)}
    ${sub('Que se passerait-il si Google faisait le même constat ?', 'Scénarios possibles, du plus probable au plus sévère.', googleHtml)}
    ${sub('Hygiène du réseau propre', 'Indicateur distinct, jamais additionné à la toxicité : sur des domaines que vous contrôlez, un défaut se corrige à la source et jamais par un désaveu.', hygieneHtml)}

    ${sub('Répartition du profil de liens', 'D’où viennent les liens : extensions, pays et types de plateformes mesurés sur l’échantillon.', distHtml)}

    ${sub('Principaux domaines référents', 'Les dix sources les plus actives de l’échantillon, avec leur autorité mesurée.', refs)}
    ${sub('Ancres les plus fréquentes', 'Le texte cliquable des liens entrants : une ancre trop répétée est le premier marqueur d’achat de liens.', anchors)}
    ${sub('Pages les plus liées', 'Les pages du domaine qui concentrent les liens externes.', pages)}
    ${trendHtml}
    ${sub('Fiabilité et portée de la mesure', 'Taille de l’échantillon et limites à garder en tête avant toute action de désaveu.', reliability)}
  </div>`;
}
