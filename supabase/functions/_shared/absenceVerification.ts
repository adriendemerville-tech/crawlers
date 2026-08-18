/**
 * absenceVerification.ts — Lot 3 : contre-vérification des absences.
 *
 * Problème corrigé : le rapport affirmait « pas de H1 », « pas de JSON-LD »,
 * « pas de meta description » à partir du seul HTML servi. Sur un site rendu
 * côté client, ces balises existent bel et bien après exécution du JavaScript :
 * l'absence mesurée n'est alors pas un défaut éditorial mais un symptôme de
 * rendu. On ne peut donc pas conclure sans re-tester un échantillon en rendu
 * complet.
 *
 * Sortie : pour chaque signal, un verdict explicite
 *   - `absent_partout`        → constat réel (provenance « Mesuré »)
 *   - `absent_pour_les_bots`  → symptôme de rendu (provenance « Testé »)
 *
 * 100 % déterministe, aucun appel LLM. Coût borné : 3 pages re-rendues au plus.
 */

import { extractVisibleText, SHELL_ISSUE_MARKER } from './botRenderingShell.ts';

export type AbsenceSignal = 'h1' | 'json_ld' | 'meta_description';

export const ABSENCE_LABELS: Record<AbsenceSignal, string> = {
  h1: 'balise H1',
  json_ld: 'données structurées JSON-LD',
  meta_description: 'meta description',
};

export interface AbsenceCheck {
  url: string;
  signal: AbsenceSignal;
  in_served_html: boolean;
  in_rendered_html: boolean;
  verdict: 'absent_partout' | 'absent_pour_les_bots' | 'present';
}

export interface AbsenceVerificationReport {
  /** Pages effectivement re-rendues. */
  verified_pages: number;
  /** Pages candidates (au moins une absence dans le HTML servi). */
  candidate_pages: number;
  /** Moteur de rendu utilisé (renderPage / browserless / spider). */
  engines: string[];
  checks: AbsenceCheck[];
  /** Signaux présents après rendu → à ne PAS restituer comme manque éditorial. */
  bot_only_signals: AbsenceSignal[];
  /** Signaux absents même après rendu → constats confirmés. */
  confirmed_signals: AbsenceSignal[];
  skipped_reason?: string;
}

const MAX_VERIFIED_PAGES = 3;

// ── Détection des signaux dans un HTML ──────────────────────
export function detectSignals(html: string): Record<AbsenceSignal, boolean> {
  const safe = typeof html === 'string' ? html : '';
  const h1Match = safe.match(/<h1\b[^>]*>([\s\S]{0,600}?)<\/h1>/i);
  const h1HasText = Boolean(h1Match && extractVisibleText(h1Match[1] || '').length >= 3);
  const metaMatch = safe.match(/<meta[^>]+name=["']description["'][^>]*>/i);
  const metaContent = metaMatch?.[0]?.match(/content=["']([^"']*)["']/i)?.[1] || '';
  return {
    h1: h1HasText,
    json_ld: /type=["']application\/ld\+json["']/i.test(safe),
    meta_description: metaContent.trim().length >= 20,
  };
}

interface PageLike {
  url?: string | null;
  path?: string | null;
  h1?: string | null;
  meta_description?: string | null;
  schema_org_types?: string[] | null;
  crawl_depth?: number | null;
  issues?: string[] | null;
  http_status?: number | null;
}

function servedSignals(page: PageLike): Record<AbsenceSignal, boolean> {
  return {
    h1: Boolean((page.h1 || '').trim()),
    json_ld: Array.isArray(page.schema_org_types) && page.schema_org_types.length > 0,
    meta_description: (page.meta_description || '').trim().length >= 20,
  };
}

function missingSignals(page: PageLike): AbsenceSignal[] {
  const s = servedSignals(page);
  return (Object.keys(s) as AbsenceSignal[]).filter((k) => !s[k]);
}

/**
 * Échantillon : accueil d'abord, puis les pages les plus profondes présentant
 * une absence. Les pages déjà identifiées comme coquille JS sont exclues :
 * leur cause racine est traitée par botRenderingShell, inutile de payer un
 * rendu de plus.
 */
export function selectVerificationSample(pages: PageLike[], max = MAX_VERIFIED_PAGES): PageLike[] {
  const eligible = pages.filter((p) => {
    if (!p.url) return false;
    const status = p.http_status ?? 200;
    if (status >= 400) return false;
    if (Array.isArray(p.issues) && p.issues.some((i) => String(i).startsWith(SHELL_ISSUE_MARKER))) return false;
    return missingSignals(p).length > 0;
  });
  if (!eligible.length) return [];

  const isHome = (p: PageLike) => {
    const path = (p.path || '').replace(/\/+$/, '');
    return path === '' || path === '/';
  };
  const home = eligible.find(isHome);
  const rest = eligible
    .filter((p) => p !== home)
    .sort((a, b) => {
      const gap = missingSignals(b).length - missingSignals(a).length;
      if (gap !== 0) return gap;
      return (b.crawl_depth ?? 0) - (a.crawl_depth ?? 0);
    });

  return [...(home ? [home] : []), ...rest].slice(0, Math.max(1, max));
}

export type RenderFn = (url: string) => Promise<{ html: string | null; engine: string }>;

/**
 * Re-teste l'échantillon en rendu complet et tranche chaque absence.
 * Ne lève jamais : un échec de rendu se traduit par un rapport `skipped_reason`.
 */
export async function verifyAbsences(
  pages: PageLike[],
  render: RenderFn,
  max = MAX_VERIFIED_PAGES,
): Promise<AbsenceVerificationReport> {
  const sample = selectVerificationSample(pages, max);
  const candidatePages = pages.filter((p) => p.url && missingSignals(p).length > 0).length;

  const report: AbsenceVerificationReport = {
    verified_pages: 0,
    candidate_pages: candidatePages,
    engines: [],
    checks: [],
    bot_only_signals: [],
    confirmed_signals: [],
  };

  if (!sample.length) {
    report.skipped_reason = candidatePages === 0
      ? 'aucune absence à contre-vérifier'
      : 'absences déjà expliquées par le verdict de rendu';
    return report;
  }

  for (const page of sample) {
    let rendered: { html: string | null; engine: string };
    try {
      rendered = await render(page.url as string);
    } catch (e) {
      console.warn('[absenceVerification] rendu échoué', page.url, (e as Error).message);
      continue;
    }
    if (!rendered?.html || rendered.html.length < 500) continue;

    report.verified_pages += 1;
    if (rendered.engine && !report.engines.includes(rendered.engine)) report.engines.push(rendered.engine);

    const after = detectSignals(rendered.html);
    const served = servedSignals(page);
    for (const signal of missingSignals(page)) {
      report.checks.push({
        url: page.url as string,
        signal,
        in_served_html: served[signal],
        in_rendered_html: after[signal],
        verdict: after[signal] ? 'absent_pour_les_bots' : 'absent_partout',
      });
    }
  }

  if (report.verified_pages === 0) {
    report.skipped_reason = 'rendu complet indisponible sur l’échantillon';
    return report;
  }

  const signals = Array.from(new Set(report.checks.map((c) => c.signal)));
  for (const signal of signals) {
    const rows = report.checks.filter((c) => c.signal === signal);
    // Dès qu'une seule page révèle la balise après rendu, l'absence mesurée sur
    // le HTML servi décrit le rendu, pas l'éditorial.
    if (rows.some((r) => r.verdict === 'absent_pour_les_bots')) report.bot_only_signals.push(signal);
    else report.confirmed_signals.push(signal);
  }

  return report;
}

// ── Restitution dans le rapport ─────────────────────────────

/** Un constat portant sur ce signal est-il un symptôme de rendu ? */
export function isBotOnlyAbsence(report: AbsenceVerificationReport | null, title: string, description = ''): boolean {
  if (!report || !report.bot_only_signals.length) return false;
  const text = `${title} ${description}`.toLowerCase();
  const absent = /(absen|manquant|introuvable|inexistant|à ajouter|aucune?)/.test(text);
  if (!absent) return false;
  return report.bot_only_signals.some((s) => {
    if (s === 'h1') return /\bh1\b/.test(text);
    if (s === 'json_ld') return /(json-?ld|schema\.org|donn[ée]es structur[ée]es)/.test(text);
    return /meta[\s-]?description/.test(text);
  });
}

export function absenceVerificationFinding(report: AbsenceVerificationReport | null) {
  if (!report || !report.bot_only_signals.length) return null;
  const labels = report.bot_only_signals.map((s) => ABSENCE_LABELS[s]).join(', ');
  return {
    id: 'absence_bot_only',
    title: `Balises présentes après rendu mais absentes du HTML servi (${labels})`,
    description:
      `Contre-vérification sur ${report.verified_pages} page(s) en rendu complet : ${labels} ${report.bot_only_signals.length > 1 ? 'apparaissent' : 'apparaît'} `
      + `uniquement après exécution du JavaScript. Les robots qui ne l'exécutent pas — dont la majorité des crawlers de moteurs IA — ne les voient jamais. `
      + `Le correctif n'est pas d'ajouter ces balises (elles existent) mais de les émettre côté serveur dans le HTML initial.`,
    priority: 'critical' as const,
    category: 'technical',
    gap_ratio: 1,
  };
}

/** Encart « fiabilité des constats de contenu » à insérer en tête de section. */
export function absenceReliabilityBlockHTML(report: AbsenceVerificationReport | null): string {
  if (!report) return '';
  const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

  if (!report.verified_pages) {
    if (!report.candidate_pages) return '';
    return `
    <div style="margin:14px 0;padding:12px 14px;background:#f9fafb;border-left:4px solid #9ca3af;border-radius:6px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;">Fiabilité des constats de contenu</div>
      <div style="font-size:12.5px;color:#374151;line-height:1.55;">
        Les absences de balises relevées ci-dessous portent sur le HTML servi et n'ont pas pu être contre-vérifiées en rendu complet
        ${report.skipped_reason ? `(${esc(report.skipped_reason)})` : ''} : à lire comme des mesures du HTML servi, non comme un verdict éditorial définitif.
      </div>
    </div>`;
  }

  const confirmed = report.confirmed_signals.map((s) => ABSENCE_LABELS[s]);
  const botOnly = report.bot_only_signals.map((s) => ABSENCE_LABELS[s]);

  return `
    <div style="margin:14px 0;padding:12px 14px;background:#f9fafb;border-left:4px solid #7c3aed;border-radius:6px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;">Fiabilité des constats de contenu</div>
      <div style="font-size:12.5px;color:#374151;line-height:1.55;">
        ${report.verified_pages} page(s) ont été re-testées en rendu complet${report.engines.length ? ` (${esc(report.engines.join(', '))})` : ''}
        avant de conclure à une absence de balise.
        ${botOnly.length
          ? `<br/><strong>Absent uniquement pour les robots</strong> (présent après exécution du JavaScript) : ${esc(botOnly.join(', '))} — à corriger côté rendu serveur, pas côté rédaction.`
          : ''}
        ${confirmed.length
          ? `<br/><strong>Absent partout</strong> (constat confirmé, HTML servi et HTML rendu) : ${esc(confirmed.join(', '))}.`
          : ''}
      </div>
    </div>`;
}
