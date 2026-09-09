/**
 * Pondération des Core Web Vitals par les données de terrain CrUX.
 *
 * Principe : le labo (PageSpeed/Lighthouse) mesure une page dans des conditions
 * synthétiques ; CrUX mesure ce que vivent réellement les utilisateurs Chrome
 * (p75 sur 28 jours). CrUX n'est donc pas une source principale — il n'a ni
 * mot-clé, ni trafic, ni granularité garantie — mais c'est le seul signal de
 * terrain disponible : il doit pondérer l'axe performance à la hausse quand le
 * vécu réel est bon, et à la baisse quand il est mauvais.
 *
 * Règles :
 *  - Aucun terrain (URL/origine sous le seuil de trafic CrUX) → pondération
 *    neutre (1,0). On n'invente jamais une pondération sans donnée.
 *  - Terrain sur l'URL → effet plein. Terrain sur l'origine seulement → effet
 *    amorti à 60 %, car la mesure ne porte pas sur la page auditée.
 *  - Bonus borné à +12 %, malus borné à −18 % : la pondération corrige la
 *    mesure, elle ne la remplace pas.
 */

export interface CruxField {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  scope: 'url' | 'origin';
}

export type CruxVerdict = 'good' | 'mixed' | 'poor' | 'unknown';

export interface CruxWeighting {
  available: boolean;
  scope: 'url' | 'origin' | null;
  verdict: CruxVerdict;
  /** Multiplicateur à appliquer à l'axe performance (0,82 à 1,12). */
  multiplier: number;
  /** Score de terrain normalisé, −1 (tout « poor ») à +1 (tout « good »). */
  fieldRatio: number | null;
  metrics: {
    lcp: { valueMs: number | null; band: CruxVerdict };
    inp: { valueMs: number | null; band: CruxVerdict };
    cls: { value: number | null; band: CruxVerdict };
  };
  /** Le terrain contredit le labo (labo mauvais / terrain bon, ou l'inverse). */
  contradictsLab: boolean;
  /** Phrase prête à afficher dans un rapport. */
  note: string;
}

const BAND_LCP = { good: 2500, poor: 4000 };
const BAND_INP = { good: 200, poor: 500 };
const BAND_CLS = { good: 0.1, poor: 0.25 };

function band(value: number | null, good: number, poor: number): CruxVerdict {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  if (value <= good) return 'good';
  if (value <= poor) return 'mixed';
  return 'poor';
}

function bandScore(b: CruxVerdict): number | null {
  if (b === 'good') return 1;
  if (b === 'mixed') return 0;
  if (b === 'poor') return -1;
  return null;
}

export function computeCruxWeighting(
  field: CruxField | null | undefined,
  labLcpMs: number | null = null,
): CruxWeighting {
  const lcpBand = band(field?.lcpMs ?? null, BAND_LCP.good, BAND_LCP.poor);
  const inpBand = band(field?.inpMs ?? null, BAND_INP.good, BAND_INP.poor);
  const clsBand = band(field?.cls ?? null, BAND_CLS.good, BAND_CLS.poor);

  const metrics = {
    lcp: { valueMs: field?.lcpMs ?? null, band: lcpBand },
    inp: { valueMs: field?.inpMs ?? null, band: inpBand },
    cls: { value: field?.cls ?? null, band: clsBand },
  };

  if (!field || lcpBand === 'unknown') {
    return {
      available: false,
      scope: null,
      verdict: 'unknown',
      multiplier: 1,
      fieldRatio: null,
      metrics,
      contradictsLab: false,
      note:
        'Aucune donnée de terrain CrUX pour cette page (trafic Chrome insuffisant) : les Core Web Vitals ne sont pas pondérés, le score repose sur la mesure laboratoire.',
    };
  }

  // LCP pèse double : c'est la métrique de terrain la plus stable et la seule
  // toujours présente quand un enregistrement CrUX existe.
  const weighted: Array<[number, number]> = [];
  const lcpScore = bandScore(lcpBand);
  if (lcpScore !== null) weighted.push([lcpScore, 2]);
  const inpScore = bandScore(inpBand);
  if (inpScore !== null) weighted.push([inpScore, 1]);
  const clsScore = bandScore(clsBand);
  if (clsScore !== null) weighted.push([clsScore, 1]);

  const totalWeight = weighted.reduce((s, [, w]) => s + w, 0) || 1;
  const fieldRatio = weighted.reduce((s, [v, w]) => s + v * w, 0) / totalWeight;

  // L'origine n'est pas la page : effet amorti.
  const damping = field.scope === 'url' ? 1 : 0.6;
  const rawEffect = fieldRatio >= 0 ? fieldRatio * 0.12 : fieldRatio * 0.18;
  const multiplier = Math.max(0.82, Math.min(1.12, 1 + rawEffect * damping));

  const verdict: CruxVerdict = fieldRatio >= 0.5 ? 'good' : fieldRatio <= -0.34 ? 'poor' : 'mixed';

  const labPoor = labLcpMs !== null && Number.isFinite(labLcpMs) && labLcpMs > BAND_LCP.poor;
  const fieldPoor = lcpBand === 'poor';
  const contradictsLab = (labPoor && lcpBand === 'good') || (!labPoor && fieldPoor);

  const scopeLabel = field.scope === 'url' ? 'cette URL' : 'ce domaine';
  const parts: string[] = [];
  if (field.lcpMs !== null) parts.push(`LCP ${(field.lcpMs / 1000).toFixed(2)} s`);
  if (field.inpMs !== null) parts.push(`INP ${Math.round(field.inpMs)} ms`);
  if (field.cls !== null) parts.push(`CLS ${field.cls.toFixed(2)}`);

  const pct = Math.round((multiplier - 1) * 100);
  const direction = pct > 0
    ? `pondération de l'axe performance à la hausse (+${pct} %)`
    : pct < 0
      ? `pondération de l'axe performance à la baisse (${pct} %)`
      : 'pondération neutre de l\'axe performance';

  const note =
    `Terrain CrUX (p75 utilisateurs réels Chrome, mobile, ${scopeLabel}) : ${parts.join(' · ')} → ${direction}.` +
    (field.scope === 'origin' ? ' Effet amorti : la mesure porte sur le domaine, pas sur la page.' : '') +
    (contradictsLab
      ? labPoor
        ? ' Le vécu réel contredit le run laboratoire dégradé : c\'est le terrain qui fait foi.'
        : ' Le vécu réel est dégradé alors que le laboratoire est correct : la pénalité vient du terrain.'
      : '');

  return {
    available: true,
    scope: field.scope,
    verdict,
    multiplier: Math.round(multiplier * 1000) / 1000,
    fieldRatio: Math.round(fieldRatio * 100) / 100,
    metrics,
    contradictsLab,
    note,
  };
}
