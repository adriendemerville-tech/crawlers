/**
 * trustClaims.ts — Lot A : audit déterministe des signaux de confiance machine.
 *
 * Deux modules, 0 token LLM :
 *
 * 1. Affirmations à risque (« surclaims ») : « 100 % conforme », « garanti »,
 *    « accepté par l'administration »… Ces formules sont pénalisantes pour la
 *    citabilité IA (un LLM évite de reprendre une promesse non sourçable) et
 *    juridiquement exposantes dans les secteurs régulés.
 *
 * 2. Autorité citée incohérente : citer l'URSSAF pour un barème kilométrique
 *    (compétence DGFiP) est un signal de confiance négatif très fort pour une
 *    machine. Table de confusions curée : sujet → institution compétente vs
 *    institutions fréquemment citées à tort.
 *
 * Règle dure : aucune détection floue. Un constat n'est émis que si le motif
 * exact est présent dans le texte servi, avec l'extrait et l'URL en preuve.
 */

import { normalizeSector, type SectorKey } from './sectorTaxonomy.ts';

// ─────────────────────────────────────────────────────────────
// 1. Affirmations à risque
// ─────────────────────────────────────────────────────────────

export type ClaimCategory =
  | 'conformite'      // conformité réglementaire absolue
  | 'garantie'        // promesse de résultat
  | 'validation'      // validation implicite par une autorité
  | 'superlatif'      // n°1, meilleur, leader
  | 'securite';       // « sans risque », « zéro risque »

interface ClaimRule {
  category: ClaimCategory;
  /** Motif recherché dans le texte normalisé (minuscules, accents conservés). */
  pattern: RegExp;
  label: string;
  /** Remédiation à afficher dans le constat. */
  fix: string;
}

const CLAIM_RULES: ClaimRule[] = [
  {
    category: 'conformite',
    pattern: /\b(100\s*%|totalement|parfaitement|entièrement)\s+(conforme|légal|en\s+règle)\b/i,
    label: 'Conformité présentée comme absolue',
    fix: 'Remplacer par une formulation vérifiable et datée (« conforme au BOFiP BOI-BAREME-000001 au 01/2026 »), avec lien vers le texte de référence.',
  },
  {
    category: 'conformite',
    pattern: /\bconforme\s+(à|a)\s+la\s+(loi|réglementation|législation)\b(?![^.]{0,60}(article|décret|arrêté|n°|bofip|code))/i,
    label: 'Conformité affirmée sans texte de référence',
    fix: 'Citer le texte exact (article, décret, arrêté, référence BOFiP) et sa date d\'entrée en vigueur.',
  },
  {
    category: 'garantie',
    pattern: /\b(résultats?|remboursement|succès|positionnement|économies?)\s+garanti/i,
    label: 'Promesse de résultat garanti',
    fix: 'Remplacer par un résultat mesuré et attribué (étude de cas chiffrée, période, périmètre) plutôt qu\'une garantie.',
  },
  {
    category: 'garantie',
    pattern: /\bnous\s+(garantissons|vous\s+garantissons)\b/i,
    label: 'Garantie explicite non encadrée',
    fix: 'Préciser l\'engagement contractuel exact (conditions, limites, durée) ou retirer la garantie.',
  },
  {
    category: 'validation',
    pattern: /\b(accept[ée]|valid[ée]|reconnu[e]?|approuv[ée])\s+(par\s+)?(l['’]?\s*)?(administration|fisc|urssaf|dgfip|impôts|cnil|état)\b/i,
    label: 'Validation par une autorité publique suggérée',
    fix: 'Une administration ne valide pas un outil ou un prestataire : reformuler en « produit des justificatifs conformes aux exigences de X » avec la référence exacte.',
  },
  {
    category: 'securite',
    pattern: /\b(sans|z[ée]ro|aucun)\s+risque\b|\bz[ée]ro\s+redressement\b/i,
    label: 'Absence de risque affirmée',
    fix: 'Reformuler en réduction de risque documentée (« réduit les motifs de rejet les plus fréquents : … »).',
  },
  {
    category: 'superlatif',
    pattern: /\b(n°\s*1|numéro\s+1|le\s+meilleur|la\s+meilleure|leader\s+(du|de\s+la|français|européen))\b/i,
    label: 'Superlatif de marché non sourcé',
    fix: 'Sourcer le classement (organisme, année, méthodologie) ou remplacer par un fait différenciant vérifiable.',
  },
];

/** Secteurs où une affirmation de conformité engage juridiquement. */
const REGULATED_SECTORS = new Set<SectorKey>([
  'finance_assurance',
  'juridique',
  'sante_medical',
  'immobilier',
  'education_formation',
  'energie_environnement',
]);

export interface ClaimHit {
  url: string;
  category: ClaimCategory;
  label: string;
  phrase: string;
  snippet: string;
  fix: string;
}

export interface RiskClaimReport {
  analyzed_pages: number;
  regulated_sector: boolean;
  sector: SectorKey;
  count: number;
  pages_affected: number;
  by_category: Record<string, number>;
  hits: ClaimHit[];
}

const MAX_HITS = 25;

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + length + 90);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

export function detectRiskClaims(
  pages: Array<{ url: string; text?: string | null }>,
  sectorRaw?: string | null,
): RiskClaimReport {
  const sector = normalizeSector(sectorRaw);
  const regulated = REGULATED_SECTORS.has(sector);
  const hits: ClaimHit[] = [];
  const affected = new Set<string>();
  const byCategory: Record<string, number> = {};
  let analyzed = 0;

  for (const page of pages) {
    const text = String(page?.text || '');
    if (text.length < 120) continue;
    analyzed++;
    for (const rule of CLAIM_RULES) {
      const match = rule.pattern.exec(text);
      if (!match) continue;
      byCategory[rule.category] = (byCategory[rule.category] || 0) + 1;
      affected.add(page.url);
      if (hits.length < MAX_HITS) {
        hits.push({
          url: page.url,
          category: rule.category,
          label: rule.label,
          phrase: match[0].replace(/\s+/g, ' ').trim(),
          snippet: snippetAround(text, match.index, match[0].length),
          fix: rule.fix,
        });
      }
    }
  }

  return {
    analyzed_pages: analyzed,
    regulated_sector: regulated,
    sector,
    count: Object.values(byCategory).reduce((a, b) => a + b, 0),
    pages_affected: affected.size,
    by_category: byCategory,
    hits,
  };
}

// ─────────────────────────────────────────────────────────────
// 2. Autorité citée incohérente
// ─────────────────────────────────────────────────────────────

interface AuthorityRule {
  /** Sujet traité par la page (motif obligatoire). */
  topic: RegExp;
  topicLabel: string;
  /** Institution réellement compétente. */
  expected: string;
  /** Institutions couramment citées à tort sur ce sujet. */
  wrong: Array<{ pattern: RegExp; name: string }>;
  rationale: string;
}

const AUTHORITY_RULES: AuthorityRule[] = [
  {
    topic: /\b(bar[èe]me\s+kilom[ée]trique|indemnit[ée]s?\s+kilom[ée]triques?|frais\s+kilom[ée]triques?)\b/i,
    topicLabel: 'barème kilométrique',
    expected: 'DGFiP / BOFiP (impots.gouv.fr)',
    wrong: [{ pattern: /\bURSSAF\b/i, name: 'URSSAF' }],
    rationale: 'Le barème kilométrique est publié par la DGFiP au BOFiP. L\'URSSAF ne publie que les limites d\'exonération de cotisations, qui ne fixent pas le barème.',
  },
  {
    topic: /\b(donn[ée]es\s+personnelles|RGPD|consentement\s+cookies?)\b/i,
    topicLabel: 'protection des données personnelles',
    expected: 'CNIL',
    wrong: [
      { pattern: /\bANSSI\b/i, name: 'ANSSI' },
      { pattern: /\bDGCCRF\b/i, name: 'DGCCRF' },
    ],
    rationale: 'L\'autorité compétente sur les données personnelles est la CNIL ; l\'ANSSI traite la sécurité des systèmes et la DGCCRF les pratiques commerciales.',
  },
  {
    topic: /\b(arr[êe]t\s+de\s+travail|indemnit[ée]s?\s+journali[èe]res|feuille\s+de\s+soins)\b/i,
    topicLabel: 'prestations maladie',
    expected: 'Assurance Maladie (CPAM / ameli.fr)',
    wrong: [{ pattern: /\bURSSAF\b/i, name: 'URSSAF' }],
    rationale: 'Les prestations maladie relèvent de l\'Assurance Maladie ; l\'URSSAF collecte les cotisations mais ne verse pas ces prestations.',
  },
  {
    topic: /\b(DPE|diagnostic\s+de\s+performance\s+[ée]nerg[ée]tique|MaPrimeR[ée]nov)\b/i,
    topicLabel: 'rénovation énergétique',
    expected: 'ADEME / ANAH',
    wrong: [{ pattern: /\bDGCCRF\b/i, name: 'DGCCRF' }],
    rationale: 'Les référentiels de rénovation énergétique et les aides relèvent de l\'ADEME et de l\'ANAH.',
  },
  {
    topic: /\b(pratiques?\s+commerciales?\s+trompeuses?|garantie\s+l[ée]gale\s+de\s+conformit[ée]|droit\s+de\s+r[ée]tractation)\b/i,
    topicLabel: 'droit de la consommation',
    expected: 'DGCCRF',
    wrong: [{ pattern: /\bCNIL\b/i, name: 'CNIL' }],
    rationale: 'Le droit de la consommation est contrôlé par la DGCCRF, pas par la CNIL.',
  },
];

export interface AuthorityMismatch {
  url: string;
  topic: string;
  cited: string;
  expected: string;
  rationale: string;
  snippet: string;
}

export interface AuthorityMismatchReport {
  analyzed_pages: number;
  count: number;
  mismatches: AuthorityMismatch[];
}

export function detectAuthorityMismatch(
  pages: Array<{ url: string; text?: string | null }>,
): AuthorityMismatchReport {
  const mismatches: AuthorityMismatch[] = [];
  let analyzed = 0;

  for (const page of pages) {
    const text = String(page?.text || '');
    if (text.length < 120) continue;
    analyzed++;
    for (const rule of AUTHORITY_RULES) {
      const topicMatch = rule.topic.exec(text);
      if (!topicMatch) continue;
      // L'institution compétente est-elle citée ? Si oui, pas de constat.
      if (new RegExp(rule.expected.split(/[\s/]/)[0], 'i').test(text)) continue;
      for (const wrong of rule.wrong) {
        const wrongMatch = wrong.pattern.exec(text);
        if (!wrongMatch) continue;
        if (mismatches.length >= 15) break;
        mismatches.push({
          url: page.url,
          topic: rule.topicLabel,
          cited: wrong.name,
          expected: rule.expected,
          rationale: rule.rationale,
          snippet: snippetAround(text, wrongMatch.index, wrongMatch[0].length),
        });
      }
    }
  }

  return { analyzed_pages: analyzed, count: mismatches.length, mismatches };
}

// ─────────────────────────────────────────────────────────────
// 3. Constats prêts pour le rapport (Marina / Workbench)
// ─────────────────────────────────────────────────────────────

export function riskClaimsFinding(report: RiskClaimReport | null) {
  if (!report || report.count === 0) return null;
  const sample = report.hits.slice(0, 3).map((h) => `« ${h.phrase} » (${h.url})`).join(' ; ');
  const critical = report.regulated_sector
    && Boolean(report.by_category.conformite || report.by_category.validation || report.by_category.garantie);
  return {
    id: 'risk_claims',
    title: `Affirmations à risque détectées sur ${report.pages_affected} page(s)`,
    description:
      `${report.count} formulation(s) non sourçable(s) relevée(s) dans le HTML servi : ${sample}. `
      + `Une machine ne reprend pas une promesse qu'elle ne peut pas rattacher à une source : ces phrases abaissent la citabilité et, en secteur régulé, engagent la responsabilité de l'éditeur. `
      + `Remédiation : ${report.hits[0]?.fix || 'remplacer chaque affirmation par un fait daté et sourcé.'}`,
    priority: critical ? ('critical' as const) : ('important' as const),
    category: 'eeat',
    gap_ratio: Math.min(1, report.count / 6),
  };
}

export function authorityMismatchFinding(report: AuthorityMismatchReport | null) {
  if (!report || report.count === 0) return null;
  const first = report.mismatches[0];
  const sample = report.mismatches.slice(0, 3)
    .map((m) => `${m.cited} cité pour « ${m.topic} » au lieu de ${m.expected} (${m.url})`)
    .join(' ; ');
  return {
    id: 'authority_mismatch',
    title: `Autorité citée incohérente avec le sujet traité (${report.count} cas)`,
    description:
      `${sample}. ${first.rationale} `
      + `Citer la mauvaise institution est un signal de confiance négatif fort pour un moteur IA, qui recoupe le nom de l'autorité avec sa compétence réelle. `
      + `Remédiation : remplacer la mention par l'institution compétente et lier la source officielle correspondante.`,
    priority: 'critical' as const,
    category: 'eeat',
    gap_ratio: 1,
  };
}

/** Encart lisible pour la section E-E-A-T du rapport. */
export function trustSignalsBlockHTML(
  claims: RiskClaimReport | null,
  authority: AuthorityMismatchReport | null,
): string {
  if (!claims?.count && !authority?.count) return '';
  const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const rows: string[] = [];
  for (const hit of (claims?.hits || []).slice(0, 6)) {
    rows.push(`<tr><td style="padding:6px 8px;font-size:12px;">${esc(hit.label)}</td><td style="padding:6px 8px;font-size:12px;">« ${esc(hit.phrase)} »</td><td style="padding:6px 8px;font-size:11px;color:#6b7280;">${esc(hit.url)}</td></tr>`);
  }
  for (const m of (authority?.mismatches || []).slice(0, 6)) {
    rows.push(`<tr><td style="padding:6px 8px;font-size:12px;">Autorité citée incohérente</td><td style="padding:6px 8px;font-size:12px;">${esc(m.cited)} au lieu de ${esc(m.expected)} — ${esc(m.topic)}</td><td style="padding:6px 8px;font-size:11px;color:#6b7280;">${esc(m.url)}</td></tr>`);
  }
  return `
    <div style="margin:16px 0;padding:14px 16px;background:#fffbeb;border-left:4px solid #d4a017;border-radius:6px;">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;">Signaux de confiance machine</div>
      <div style="font-size:13px;color:#374151;line-height:1.55;margin-bottom:8px;">
        Constats déterministes relevés dans le HTML servi (aucune interprétation) : affirmations non sourçables et autorités citées hors de leur domaine de compétence.
        Un moteur IA évite de citer une page dont il ne peut pas rattacher les affirmations à une source vérifiable.
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#fef3c7;"><th style="text-align:left;padding:6px 8px;font-size:12px;">Type</th><th style="text-align:left;padding:6px 8px;font-size:12px;">Extrait</th><th style="text-align:left;padding:6px 8px;font-size:12px;">URL</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

