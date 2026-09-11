/**
 * Qualité de la mise en exergue (<strong>/<b>) — signal GEO déterministe.
 *
 * Mesure trois choses, sans LLM ni appel réseau :
 *  1. Présence  : la page met-elle quelque chose en exergue ?
 *  2. Nombre    : ni zéro, ni sur-balisage décoratif (fenêtre 2–3 pour ~600 mots).
 *  3. Qualité sémantique : les termes mis en valeur portent-ils l'intention
 *     (mots-clés du title/H1/univers, chiffres, définitions) ou sont-ils
 *     décoratifs (mots vides, « cliquez ici », phrases entières) ?
 *
 * Utilisé par l'audit STRATÉGIQUE GEO (pas l'audit technique SEO) : la mise en
 * exergue sert d'abord aux moteurs génératifs pour repérer les passages
 * citables. Aucune incidence sur le score.
 */

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'à', 'au', 'aux',
  'en', 'pour', 'par', 'sur', 'avec', 'sans', 'dans', 'ce', 'cet', 'cette', 'ces',
  'nous', 'vous', 'ils', 'elles', 'est', 'sont', 'plus', 'très', 'ici', 'cliquez',
  'lire', 'suite', 'savoir', 'the', 'and', 'for', 'with', 'you', 'your', 'our',
]);

const NUMBER_RE = /\d/;

export interface EmphasisPageInput {
  url?: string | null;
  title?: string | null;
  h1?: string | null;
  word_count?: number | null;
  strong_count?: number | null;
  strong_terms?: unknown;
}

export interface EmphasisQualityReport {
  measured: boolean;
  pagesAnalyzed: number;
  pagesWithEmphasis: number;
  pagesWithoutEmphasis: number;
  /** Pages où la densité dépasse la fenêtre utile (sur-balisage décoratif). */
  pagesOverEmphasized: number;
  avgPerThousandWords: number | null;
  /** 0–100 : part des termes mis en exergue porteurs d'intention. */
  semanticQualityScore: number | null;
  termsAnalyzed: number;
  qualityTerms: string[];
  weakTerms: string[];
  verdict: 'absent' | 'faible' | 'correct' | 'excessif' | 'non_mesure';
}

function tokenize(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function asTerms(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
    } catch { return []; }
  }
  return [];
}

/**
 * Un terme est « porteur d'intention » s'il est court (1–6 mots), non réduit à
 * des mots vides, et qu'il recoupe le vocabulaire d'intention de la page
 * (title, H1, mots-clés fournis) ou porte un fait chiffré.
 */
function isQualityTerm(term: string, intentTokens: Set<string>): boolean {
  const words = term.trim().split(/\s+/);
  if (words.length > 6) return false; // phrase entière mise en gras : bruit
  const tokens = tokenize(term);
  if (tokens.length === 0) return false;
  if (NUMBER_RE.test(term) && tokens.length <= 6) return true;
  return tokens.some((t) => intentTokens.has(t));
}

export function computeEmphasisQuality(
  pages: EmphasisPageInput[],
  extraKeywords: string[] = [],
): EmphasisQualityReport {
  const empty: EmphasisQualityReport = {
    measured: false, pagesAnalyzed: 0, pagesWithEmphasis: 0, pagesWithoutEmphasis: 0,
    pagesOverEmphasized: 0, avgPerThousandWords: null, semanticQualityScore: null,
    termsAnalyzed: 0, qualityTerms: [], weakTerms: [], verdict: 'non_mesure',
  };
  const list = (pages || []).filter((p) => Number(p?.word_count || 0) > 300);
  if (list.length === 0) return empty;

  // Crawls antérieurs à la mesure : tous les compteurs à 0 → non mesuré.
  const anyMeasured = (pages || []).some((p) => Number(p?.strong_count || 0) > 0 || asTerms(p?.strong_terms).length > 0);
  if (!anyMeasured) return empty;

  const globalIntent = new Set<string>(extraKeywords.flatMap((k) => tokenize(k)));

  let withEmphasis = 0;
  let over = 0;
  let densitySum = 0;
  let densityCount = 0;
  const quality: string[] = [];
  const weak: string[] = [];

  for (const page of list) {
    const words = Number(page.word_count || 0);
    const terms = asTerms(page.strong_terms);
    const count = Number(page.strong_count || 0) || terms.length;
    if (count > 0) withEmphasis++;
    if (words > 0) {
      const per1000 = (count / words) * 1000;
      densitySum += per1000;
      densityCount++;
      // Fenêtre utile : au-delà de ~8 exergues / 1000 mots, le signal se dilue.
      if (per1000 > 8) over++;
    }
    const intent = new Set<string>([
      ...globalIntent,
      ...tokenize(page.title || ''),
      ...tokenize(page.h1 || ''),
    ]);
    for (const term of terms) {
      if (isQualityTerm(term, intent)) { if (quality.length < 12) quality.push(term); }
      else if (weak.length < 12) weak.push(term);
    }
  }

  const termsAnalyzed = list.reduce((acc, p) => acc + asTerms(p.strong_terms).length, 0);
  let qualityCount = 0;
  for (const page of list) {
    const intent = new Set<string>([
      ...globalIntent,
      ...tokenize(page.title || ''),
      ...tokenize(page.h1 || ''),
    ]);
    for (const term of asTerms(page.strong_terms)) {
      if (isQualityTerm(term, intent)) qualityCount++;
    }
  }

  const semanticQualityScore = termsAnalyzed > 0 ? Math.round((qualityCount / termsAnalyzed) * 100) : null;
  const avgPerThousandWords = densityCount > 0 ? Math.round((densitySum / densityCount) * 10) / 10 : null;

  let verdict: EmphasisQualityReport['verdict'];
  if (withEmphasis === 0) verdict = 'absent';
  else if (over > list.length / 3) verdict = 'excessif';
  else if (withEmphasis < list.length / 2 || (semanticQualityScore ?? 0) < 40) verdict = 'faible';
  else verdict = 'correct';

  return {
    measured: true,
    pagesAnalyzed: list.length,
    pagesWithEmphasis: withEmphasis,
    pagesWithoutEmphasis: list.length - withEmphasis,
    pagesOverEmphasized: over,
    avgPerThousandWords,
    semanticQualityScore,
    termsAnalyzed,
    qualityTerms: quality,
    weakTerms: weak,
    verdict,
  };
}

const VERDICT_LABEL: Record<EmphasisQualityReport['verdict'], string> = {
  absent: 'Aucune mise en exergue',
  faible: 'Mise en exergue faible ou peu ciblée',
  correct: 'Mise en exergue pertinente',
  excessif: 'Sur-balisage décoratif',
  non_mesure: 'Non mesuré',
};

/** Bloc HTML pour l'audit stratégique GEO. Sans incidence sur le score. */
export function renderEmphasisQualityHtml(report: EmphasisQualityReport | null): string {
  if (!report?.measured) return '';
  const q = report.semanticQualityScore;
  return `<div data-marina-block="geo-emphasis" style="margin-top:16px;padding:14px;background:#faf9ff;border:1px solid #ede9fe;border-left:4px solid #6d28d9;border-radius:8px;">
    <h3 style="font-size:14px;font-weight:600;margin:0 0 6px;color:#111827;">Mise en exergue (&lt;strong&gt;/&lt;b&gt;) — signal de citabilité IA</h3>
    <p style="font-size:12px;color:#374151;margin:0 0 8px;line-height:1.5;">Les moteurs génératifs s'appuient sur le balisage sémantique pour repérer les passages citables. Indicateur éditorial : <strong>sans incidence sur le score</strong>.</p>
    <ul style="font-size:12px;color:#374151;margin:0 0 8px;padding-left:18px;line-height:1.6;">
      <li>Présence : <strong>${report.pagesWithEmphasis}/${report.pagesAnalyzed}</strong> pages de plus de 300 mots avec au moins une mise en exergue</li>
      <li>Nombre : <strong>${report.avgPerThousandWords ?? 'n/d'}</strong> exergues pour 1 000 mots en moyenne${report.pagesOverEmphasized > 0 ? ` — <strong>${report.pagesOverEmphasized}</strong> page(s) en sur-balisage` : ''}</li>
      <li>Qualité sémantique : <strong>${q != null ? `${q}/100` : 'n/d'}</strong> (part des termes portant l'intention ou un fait chiffré, sur ${report.termsAnalyzed} termes)</li>
      <li>Verdict : <strong>${VERDICT_LABEL[report.verdict]}</strong></li>
    </ul>
    ${report.qualityTerms.length ? `<p style="font-size:12px;color:#374151;margin:0 0 4px;">Termes bien ciblés : ${report.qualityTerms.slice(0, 6).map((t) => `« ${t.replace(/[<>&]/g, '')} »`).join(', ')}</p>` : ''}
    ${report.weakTerms.length ? `<p style="font-size:12px;color:#374151;margin:0 0 4px;">Termes peu utiles : ${report.weakTerms.slice(0, 6).map((t) => `« ${t.replace(/[<>&]/g, '')} »`).join(', ')}</p>` : ''}
    <p style="font-size:12px;color:#374151;margin:6px 0 0;line-height:1.5;"><strong>Conseil :</strong> une balise &lt;strong&gt; mal placée n'apporte rien. Mieux vaut 2–3 mises en exergue pertinentes sur les mots-clés d'intention que 15 &lt;strong&gt; décoratifs.</p>
  </div>`;
}
