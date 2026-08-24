/**
 * _shared/pillarSatelliteVerdict.ts — Lot B
 *
 * « Risque de cannibalisation : /a ↔ /b » n'est pas un constat exploitable :
 * le lecteur ne sait ni laquelle des deux pages garder, ni si le conflit est
 * réel. Ce module transforme chaque groupe de pages en conflit en un verdict
 * pilier / satellite déterministe (0 LLM) avec une action unique.
 *
 * Quatre verdicts possibles :
 *   pilier_net          — une page domine nettement : 301 des satellites vers elle.
 *   pilier_conteste     — deux pages d'autorité comparable se disputent l'intention :
 *                         choisir explicitement, fusionner, ne pas laisser en l'état.
 *   sans_pilier         — aucune page ne fait autorité : refonte en une page pilier.
 *   satellites_legitimes— les pages visent des intentions différentes : pas de 301,
 *                         seul le maillage et les titres doivent être différenciés.
 *
 * Consommateurs : marina (section cocon), copilot audit_internal_mesh, Parménion.
 */

export interface PsPage {
  url: string;
  path?: string | null;
  title?: string | null;
  seo_score?: number | null;
  word_count?: number | null;
  inbound?: number | null;
  depth?: number | null;
  intent?: string | null;
  /**
   * `false` = la page n'a pas été mesurée par le crawl (hors échantillon).
   * Son autorité vaut alors 0 par défaut d'information, jamais par constat :
   * on ne peut pas recommander de 301 sur cette base.
   */
  measured?: boolean;
}


export type PsVerdict = 'pilier_net' | 'pilier_conteste' | 'sans_pilier' | 'satellites_legitimes' | 'mesure_incomplete';

export interface PsGroupVerdict {
  theme: string;
  shared_keywords: string[];
  verdict: PsVerdict;
  label: string;
  action: string;
  /** Ratio autorité pilier / meilleur satellite (1 = strictement égaux). */
  dominance: number | null;
  pilier: PsPage & { authority: number };
  satellites: (PsPage & { authority: number })[];
}

function pathOf(p: PsPage): string {
  if (p.path) return String(p.path);
  try { return new URL(p.url).pathname.replace(/\/$/, '') || '/'; } catch { return p.url; }
}

/**
 * Autorité de page déterministe : score SEO, profondeur de contenu, liens
 * entrants internes, pénalité de profondeur de crawl. Même formule que le
 * clustering de cannibalisation, pour que les deux ne se contredisent pas.
 */
export function pageAuthority(p: PsPage): number {
  return (
    (Number(p.seo_score) || 0) * 1.0 +
    Math.min(40, (Number(p.word_count) || 0) / 50) +
    (Number(p.inbound) || 0) * 3 -
    (Number(p.depth) || 0) * 2
  );
}

/**
 * Critère de départage réellement mesuré entre deux pages d'autorité proche.
 * On prend l'écart relatif le plus marqué : sans cela, tous les verdicts
 * « pilier contesté » d'un rapport portaient la même phrase générique.
 */
function tieBreaker(
  a: PsPage & { authority: number; path?: string | null },
  b: PsPage & { authority: number; path?: string | null },
): string {
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const cands: Array<{ gap: number; text: string }> = [];

  const inA = num(a.inbound), inB = num(b.inbound);
  if (inA !== inB) {
    const [win, lose] = inA > inB ? [a, b] : [b, a];
    cands.push({
      gap: Math.abs(inA - inB) / Math.max(1, Math.max(inA, inB)),
      text: `Le maillage interne tranche déjà : ${win.path} reçoit ${Math.max(inA, inB)} lien(s) entrant(s) contre ${Math.min(inA, inB)} pour ${lose.path} — conserver ${win.path}.`,
    });
  }
  const wA = num(a.word_count), wB = num(b.word_count);
  if (wA !== wB) {
    const [win, lose] = wA > wB ? [a, b] : [b, a];
    cands.push({
      gap: Math.abs(wA - wB) / Math.max(1, Math.max(wA, wB)),
      text: `Le contenu tranche : ${win.path} compte ${Math.max(wA, wB)} mots contre ${Math.min(wA, wB)} pour ${lose.path} — garder ${win.path} comme base et y absorber ${lose.path}.`,
    });
  }
  const dA = num(a.depth), dB = num(b.depth);
  if (dA !== dB) {
    const [win, lose] = dA < dB ? [a, b] : [b, a];
    cands.push({
      gap: Math.abs(dA - dB) / Math.max(1, Math.max(dA, dB)),
      text: `La profondeur de clic tranche : ${win.path} est à ${Math.min(dA, dB)} clic(s) de l'accueil contre ${Math.max(dA, dB)} pour ${lose.path} — privilégier ${win.path}.`,
    });
  }
  const sA = num(a.seo_score), sB = num(b.seo_score);
  if (Math.abs(sA - sB) >= 3) {
    const [win, lose] = sA > sB ? [a, b] : [b, a];
    cands.push({
      gap: Math.abs(sA - sB) / Math.max(1, Math.max(sA, sB)),
      text: `La qualité on-page tranche : score SEO ${Math.max(sA, sB)}/100 pour ${win.path} contre ${Math.min(sA, sB)} pour ${lose.path} — conserver ${win.path}.`,
    });
  }

  cands.sort((x, y) => y.gap - x.gap);
  if (cands.length > 0 && cands[0].gap >= 0.1) return cands[0].text;
  // Aucun signal ne départage : le dire explicitement plutôt que de servir une
  // consigne générique présentée comme un diagnostic.
  return `Aucun signal mesuré ne départage ces deux pages (liens entrants, volume de contenu, profondeur et score on-page équivalents) : l'arbitrage doit être métier — conversions constatées ou historique de positions.`;
}

export function classifyPillarSatellite(
  pages: PsPage[],
  opts?: { theme?: string; sharedKeywords?: string[] },
): PsGroupVerdict | null {
  const list = (pages || []).filter((p) => p && p.url);
  if (list.length < 2) return null;

  const ranked = list
    .map((p) => ({ ...p, path: pathOf(p), authority: Math.round(pageAuthority(p) * 10) / 10 }))
    .sort((a, b) => b.authority - a.authority || String(a.path).localeCompare(String(b.path)));

  const pilier = ranked[0];
  const satellites = ranked.slice(1);
  const best = satellites[0];
  const dominance = best && best.authority > 0 ? Math.round((pilier.authority / best.authority) * 100) / 100 : null;

  const intents = new Set(ranked.map((p) => String(p.intent || '').toLowerCase()).filter((i) => i && i !== 'unknown'));
  const theme = opts?.theme || String(pilier.title || pilier.path || '').slice(0, 80);
  const shared = opts?.sharedKeywords || [];

  // Aucune redirection ne peut être prescrite si une des pages du groupe n'a
  // pas été mesurée : son autorité nulle est une absence de donnée, pas un
  // constat. C'est ce cas qui produisait des 301 recommandées vers un pilier
  // simplement parce que l'autre page était hors échantillon de crawl.
  const unmeasured = ranked.filter((p) => p.measured === false);
  if (unmeasured.length > 0) {
    return {
      theme, shared_keywords: shared,
      verdict: 'mesure_incomplete',
      label: 'Mesure incomplète — aucune redirection prescrite',
      action: `${unmeasured.length} page(s) de ce groupe (${unmeasured.map((p) => p.path).join(', ')}) n'ont pas été analysées lors de ce crawl : leur autorité interne est inconnue, pas nulle. Ne pas rediriger. Relancer un crawl couvrant ces URL, puis arbitrer sur des mesures complètes.`,
      dominance: null, pilier, satellites,
    };
  }


  // Intentions déclarées différentes sur toutes les pages : ce n'est pas un
  // doublon, c'est un maillage insuffisamment différencié.
  if (intents.size >= ranked.length && ranked.length <= 3) {
    return {
      theme, shared_keywords: shared,
      verdict: 'satellites_legitimes',
      label: 'Intentions distinctes — pas de fusion',
      action: `Ces ${ranked.length} pages partagent un vocabulaire proche mais visent des intentions différentes (${[...intents].join(', ')}). Ne pas rediriger : différencier les titres et les métadonnées, puis lier explicitement les satellites vers ${pilier.path} avec des ancres non identiques.`,
      dominance, pilier, satellites,
    };
  }

  if (pilier.authority < 35) {
    return {
      theme, shared_keywords: shared,
      verdict: 'sans_pilier',
      label: 'Aucun pilier — éclatement thématique',
      action: `Aucune de ces ${ranked.length} pages ne fait autorité sur le sujet (meilleure page : ${pilier.authority} points d’autorité interne). Fusionner l’ensemble en une seule page de référence, puis rediriger les URL absorbées en 301.`,
      dominance, pilier, satellites,
    };
  }

  if (dominance !== null && dominance < 1.25) {
    // Sans critère de départage mesuré, les cinq verdicts d'un même rapport
    // affichaient la même phrase. On cherche donc l'écart le plus marqué entre
    // les deux pages et on en fait la consigne d'arbitrage.
    const criterion = tieBreaker(pilier, best);
    return {
      theme, shared_keywords: shared,
      verdict: 'pilier_conteste',
      label: 'Pilier contesté — arbitrage nécessaire',
      action: `${pilier.path} (${pilier.authority}) et ${best.path} (${best.authority}) ont une autorité interne quasi identique : les moteurs alternent entre les deux et aucune ne capitalise. ${criterion} Fusionner ensuite le contenu utile de l’autre page, puis la rediriger en 301.`,
      dominance, pilier, satellites,
    };
  }

  return {
    theme, shared_keywords: shared,
    verdict: 'pilier_net',
    label: 'Pilier identifié — consolider les satellites',
    action: `${pilier.path} domine le groupe (${pilier.authority} contre ${best ? best.authority : 0}). Conserver cette page comme pilier, y reprendre les passages utiles des ${satellites.length} autre(s), puis les rediriger en 301 vers elle.`,
    dominance, pilier, satellites,
  };
}

// ═══════════════════════════════════════════════
// Rendu HTML (charte Crawlers — bordure, pas de fond plein)
// ═══════════════════════════════════════════════

const VIOLET = '#6d28d9';
const GOLD = '#8a6d1f';

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ACCENT: Record<PsVerdict, string> = {
  pilier_net: VIOLET,
  pilier_conteste: GOLD,
  sans_pilier: '#111827',
  satellites_legitimes: '#6b7280',
};

export function pillarSatelliteBlockHTML(verdicts: PsGroupVerdict[]): string {
  const list = (verdicts || []).filter(Boolean);
  if (list.length === 0) return '';
  const cards = list.map((v) => `
    <div style="padding:12px;margin-bottom:8px;border:1px solid #e5e7eb;border-left:3px solid ${ACCENT[v.verdict]};border-radius:8px;background:#ffffff;page-break-inside:avoid;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:4px;">${esc(v.label)}</div>
      <div style="font-size:13px;font-weight:600;color:#111827;">Pilier : ${esc(v.pilier.path)}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px;">Satellites : ${v.satellites.map((s) => esc(s.path)).join(' · ') || '-'}${v.shared_keywords.length ? ` — vocabulaire partagé : ${v.shared_keywords.slice(0, 6).map(esc).join(', ')}` : ''}</div>
      <p style="font-size:12px;color:#374151;line-height:1.6;margin:6px 0 0;">${esc(v.action)}</p>
    </div>`).join('');

  return `<div style="margin-top:16px;">
    <h3 style="font-size:14px;font-weight:600;margin-bottom:6px;">Cannibalisation : verdict pilier / satellite (${list.length})</h3>
    <p style="font-size:12px;color:#374151;line-height:1.6;margin:0 0 10px;">Chaque groupe de pages en conflit reçoit un verdict unique. L’autorité interne est déduite du score SEO, de la profondeur de contenu, des liens entrants internes et de la profondeur de crawl : elle sert uniquement à désigner la page à conserver.</p>
    ${cards}
  </div>`;
}

/**
 * Adaptateur pour Marina : les risques de cannibalisation du cocon ne portent
 * que des URL, les métriques vivent dans les nœuds du graphe.
 */
export function verdictsFromCocoonRisks(
  risks: any[],
  nodes: any[],
  maxGroups = 5,
): PsGroupVerdict[] {
  const byUrl = new Map<string, any>();
  const norm = (u: string) => { try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return String(u || ''); } };
  for (const n of nodes || []) {
    if (n?.url) { byUrl.set(String(n.url), n); byUrl.set(norm(String(n.url)), n); }
  }

  const out: PsGroupVerdict[] = [];
  for (const risk of (risks || []).slice(0, maxGroups)) {
    const urls: string[] = Array.isArray(risk?.urls) ? risk.urls.filter((u: any) => typeof u === 'string') : [];
    if (urls.length < 2) continue;
    const pages: PsPage[] = urls.map((u) => {
      const n = byUrl.get(u) || byUrl.get(norm(u)) || {};
      return {
        url: u,
        path: norm(u),
        title: n.title ?? null,
        seo_score: n.seo_score ?? n.page_authority ?? null,
        word_count: n.word_count ?? null,
        inbound: n.internal_links_in ?? null,
        depth: n.crawl_depth ?? n.depth ?? null,
        intent: n.intent ?? n.page_intent ?? null,
      };
    });
    const v = classifyPillarSatellite(pages, {
      theme: Array.isArray(risk?.shared_keywords) ? risk.shared_keywords.slice(0, 3).join(' ') : undefined,
      sharedKeywords: Array.isArray(risk?.shared_keywords) ? risk.shared_keywords : [],
    });
    if (v) out.push(v);
  }
  return out;
}
