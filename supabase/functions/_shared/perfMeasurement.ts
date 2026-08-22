/**
 * Mesure de performance mobile fiable (partagée audit-expert-seo / marina).
 *
 * Problème résolu : un run PageSpeed unique est bruité. Sur un même site, deux
 * runs consécutifs ont donné 2,0 s puis 11,3 s de LCP — et le plafond de
 * cohérence a bridé le score sur l'outlier. On ne peut pas retirer 34 points à
 * un audit sur une mesure non reproductible.
 *
 * Stratégie (dans cet ordre, la moins coûteuse en quota d'abord) :
 *  1. CrUX (Chrome UX Report) : données de terrain p75 réelles. Si disponibles,
 *     elles font autorité et aucun run PSI supplémentaire n'est déclenché.
 *  2. Un run PSI (labo). S'il est bon (LCP <= 4 s), on s'arrête : pas de plafond
 *     à appliquer, donc pas besoin de confirmer.
 *  3. Si le run 1 est mauvais (> 4 s) et qu'aucun terrain n'existe, on relance
 *     jusqu'à 2 runs de plus et on prend la MÉDIANE. Un plafond ne s'applique
 *     donc jamais sur un seul run dégradé.
 *
 * Le résultat expose toujours la provenance (`source`) et la dispersion
 * (`spreadMs`) pour que le rapport puisse dire d'où vient le chiffre.
 */

export type PerfSource =
  | 'field_crux_url'
  | 'field_crux_origin'
  | 'lab_median_3'
  | 'lab_median_2'
  | 'lab_single'
  | 'unavailable';

export interface PerfFieldData {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  scope: 'url' | 'origin';
}

export interface PerfMeasurement {
  /** Run PSI représentatif (celui dont le LCP est la médiane). */
  psiData: any | null;
  /** LCP retenu, en ms (terrain si disponible, sinon médiane labo). */
  lcpMs: number | null;
  /** LCP médian labo, conservé même quand le terrain fait autorité. */
  labLcpMs: number | null;
  /** Score performance Lighthouse 0..1 du run représentatif. */
  perfScore: number | null;
  source: PerfSource;
  /** Nombre de runs PSI réellement consommés. */
  runs: number;
  labLcpRuns: number[];
  /** Écart max-min entre les runs labo, en ms. */
  spreadMs: number | null;
  /** true quand le labo était mauvais mais le terrain bon : on n'a pas plafonné. */
  outlierDiscarded: boolean;
  field: PerfFieldData | null;
  measuredUrl: string;
  /** Phrase prête à afficher dans un rapport (méthode de mesure). */
  methodNote: string;
}

const PSI_TIMEOUT_MS = 30_000;
const POOR_LCP_MS = 4000;

function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

/** Suit les redirections et renvoie l'URL réellement servie (canonique de fait). */
export async function resolveFinalUrl(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersAI/2.0; +https://crawlers.fr)' },
    });
    clearTimeout(timeoutId);
    try { await res.body?.cancel(); } catch { /* noop */ }
    return res.url || url;
  } catch {
    return url;
  }
}

/** CrUX : données de terrain p75 (PHONE). Une seule requête, quota distinct de PSI. */
export async function fetchCruxField(
  url: string,
  apiKey: string,
): Promise<PerfFieldData | null> {
  if (!apiKey) return null;
  const endpoint = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`;
  let origin = '';
  try { origin = new URL(url).origin; } catch { /* noop */ }

  const attempts: Array<{ body: Record<string, unknown>; scope: 'url' | 'origin' }> = [
    { body: { url, formFactor: 'PHONE' }, scope: 'url' },
  ];
  if (origin) attempts.push({ body: { origin, formFactor: 'PHONE' }, scope: 'origin' });

  for (const attempt of attempts) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt.body),
      });
      if (!res.ok) {
        // 404 = pas assez de trafic pour cette URL/origine : on tente le cran suivant.
        continue;
      }
      const data = await res.json();
      const metrics = data?.record?.metrics || {};
      const lcp = Number(metrics?.largest_contentful_paint?.percentiles?.p75);
      const inp = Number(metrics?.interaction_to_next_paint?.percentiles?.p75);
      const cls = Number(metrics?.cumulative_layout_shift?.percentiles?.p75);
      if (!Number.isFinite(lcp)) continue;
      console.log(`[CrUX] terrain ${attempt.scope} → LCP p75 ${(lcp / 1000).toFixed(2)}s`);
      return {
        lcpMs: Math.round(lcp),
        inpMs: Number.isFinite(inp) ? Math.round(inp) : null,
        cls: Number.isFinite(cls) ? cls : null,
        scope: attempt.scope,
      };
    } catch (e) {
      console.warn('[CrUX] échec:', e instanceof Error ? e.message : e);
    }
  }
  return null;
}

/** Un run PageSpeed mobile, avec un retry réseau. */
export async function fetchPageSpeedRun(url: string, apiKey: string): Promise<any | null> {
  const apiUrl =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}` +
    `&strategy=mobile&category=PERFORMANCE&category=SEO&category=BEST_PRACTICES&key=${apiKey}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`[PSI] HTTP ${response.status} (tentative ${attempt}):`, error?.error?.message || response.status);
        if (response.status === 429 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        if (attempt < 2) continue;
        return null;
      }

      const data = await response.json();
      if (!data?.lighthouseResult?.categories?.performance) {
        if (attempt < 2) continue;
        return null;
      }
      return data;
    } catch (error) {
      console.error(`[PSI] erreur (tentative ${attempt}):`, error instanceof Error ? error.message : error);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return null;
    }
  }
  return null;
}

function lcpOf(psi: any): number | null {
  const v = Number(psi?.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

export interface MeasurePerfOptions {
  /** Désactive les runs de confirmation (contextes très contraints en temps). */
  maxRuns?: number;
  /** Terrain CrUX déjà connu (évite un appel réseau). */
  field?: PerfFieldData | null;
}

export async function measurePerformance(
  url: string,
  apiKey: string,
  opts: MeasurePerfOptions = {},
): Promise<PerfMeasurement> {
  const maxRuns = Math.max(1, Math.min(3, opts.maxRuns ?? 3));

  const base: PerfMeasurement = {
    psiData: null,
    lcpMs: null,
    labLcpMs: null,
    perfScore: null,
    source: 'unavailable',
    runs: 0,
    labLcpRuns: [],
    spreadMs: null,
    outlierDiscarded: false,
    field: null,
    measuredUrl: url,
    methodNote: 'Performance mobile non mesurable (PageSpeed indisponible).',
  };

  if (!apiKey) return base;

  // 1. Terrain CrUX (une requête, quota séparé) + 1er run labo en parallèle.
  const [field, run1] = await Promise.all([
    opts.field !== undefined ? Promise.resolve(opts.field) : fetchCruxField(url, apiKey),
    fetchPageSpeedRun(url, apiKey),
  ]);

  const runs: any[] = run1 ? [run1] : [];
  let lab = lcpOf(run1);

  // 2. Confirmation : uniquement si le labo est mauvais ET qu'aucun terrain ne
  //    tranche. Sans cela on plafonnerait un score sur un run isolé.
  const needsConfirmation = lab !== null && lab > POOR_LCP_MS && !field && maxRuns > 1;
  if (needsConfirmation) {
    console.log(`[PERF] LCP labo ${(lab! / 1000).toFixed(2)}s > 4s et aucun terrain CrUX → runs de confirmation`);
    const run2 = await fetchPageSpeedRun(url, apiKey);
    if (run2) runs.push(run2);
    const l2 = lcpOf(run2);
    // 3e run seulement si les deux premiers divergent de plus de 30 %.
    if (maxRuns > 2 && l2 !== null && lab !== null) {
      const diverges = Math.abs(l2 - lab) / Math.max(l2, lab) > 0.3;
      if (diverges) {
        const run3 = await fetchPageSpeedRun(url, apiKey);
        if (run3) runs.push(run3);
      }
    }
  }

  const labLcpRuns = runs.map(lcpOf).filter((v): v is number => v !== null);
  lab = median(labLcpRuns);
  const spreadMs = labLcpRuns.length > 1 ? Math.max(...labLcpRuns) - Math.min(...labLcpRuns) : null;

  // Run représentatif = celui dont le LCP est le plus proche de la médiane.
  let representative: any | null = runs[0] ?? null;
  if (lab !== null && runs.length > 1) {
    representative = runs.reduce((best, cur) => {
      const bl = lcpOf(best), cl = lcpOf(cur);
      if (bl === null) return cur;
      if (cl === null) return best;
      return Math.abs(cl - lab!) < Math.abs(bl - lab!) ? cur : best;
    }, runs[0]);
  }

  const perfScore = Number(representative?.lighthouseResult?.categories?.performance?.score);
  const fieldLcp = field?.lcpMs ?? null;

  let source: PerfSource = 'unavailable';
  if (fieldLcp !== null) source = field!.scope === 'url' ? 'field_crux_url' : 'field_crux_origin';
  else if (labLcpRuns.length >= 3) source = 'lab_median_3';
  else if (labLcpRuns.length === 2) source = 'lab_median_2';
  else if (labLcpRuns.length === 1) source = 'lab_single';

  const lcpMs = fieldLcp !== null ? fieldLcp : lab;
  const outlierDiscarded = fieldLcp !== null && lab !== null && lab > POOR_LCP_MS && fieldLcp <= POOR_LCP_MS;

  const methodNote = (() => {
    if (fieldLcp !== null) {
      const scope = field!.scope === 'url' ? 'cette URL' : 'ce domaine';
      const labPart = lab !== null ? ` (labo PageSpeed : ${(lab / 1000).toFixed(2)} s)` : '';
      return `LCP ${(fieldLcp / 1000).toFixed(2)} s — données de terrain CrUX (p75 utilisateurs réels, mobile, ${scope})${labPart}.`;
    }
    if (labLcpRuns.length > 1) {
      return `LCP ${(lab! / 1000).toFixed(2)} s — médiane de ${labLcpRuns.length} runs PageSpeed mobile (dispersion ${(spreadMs! / 1000).toFixed(2)} s), aucune donnée de terrain CrUX disponible.`;
    }
    if (labLcpRuns.length === 1) {
      return `LCP ${(lab! / 1000).toFixed(2)} s — un run PageSpeed mobile, aucune donnée de terrain CrUX disponible.`;
    }
    return 'Performance mobile non mesurable (PageSpeed indisponible).';
  })();

  console.log(`[PERF] source=${source} lcp=${lcpMs ?? 'n/a'}ms labRuns=[${labLcpRuns.join(', ')}] outlierDiscarded=${outlierDiscarded}`);

  return {
    psiData: representative,
    lcpMs,
    labLcpMs: lab,
    perfScore: Number.isFinite(perfScore) ? perfScore : null,
    source,
    runs: runs.length,
    labLcpRuns,
    spreadMs,
    outlierDiscarded,
    field: field ?? null,
    measuredUrl: url,
    methodNote,
  };
}
