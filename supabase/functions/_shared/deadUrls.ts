/**
 * deadUrls.ts — Lot A : URLs mortes exposées comme constats priorisés.
 *
 * Le crawl détecte déjà les statuts >= 400 et les liens cassés, mais rien ne
 * remontait dans le rapport. Trois constats déterministes, 0 token LLM :
 *
 * 1. Page morte encore liée depuis le site (lien interne vers 404/410/500).
 * 2. Canonical qui pointe vers une page morte (le signal d'indexation est perdu).
 * 3. Pages mortes découvertes au crawl (donc atteignables depuis le maillage).
 *
 * Priorité : un lien interne vers une page morte est plus grave qu'une page
 * morte orpheline, car il gaspille du crawl budget et casse la navigation.
 */

import { classifyLink, isFalsePositiveDomain, type LinkVerdict } from './linkVerdict.ts';

export interface DeadUrlPageInput {
  url: string;
  path?: string | null;
  http_status?: number | null;
  canonical_url?: string | null;
  anchor_texts?: Array<{ href: string; text?: string; type?: string }> | null;
  broken_links?: string[] | null;
}

export interface DeadUrlEntry {
  url: string;
  status: number;
  /** Verdict du juge unique partagé (`linkVerdict.ts`). */
  verdict: LinkVerdict;
  /** Libellé unifié, réutilisable tel quel dans le rapport. */
  label: string;
  /** URLs du site qui pointent encore vers cette page morte. */
  linked_from: string[];
  /** Pages dont le canonical désigne cette page morte. */
  canonical_from: string[];
}

export interface DeadUrlReport {
  analyzed_pages: number;
  dead_pages: number;
  linked_dead_pages: number;
  canonical_to_dead: number;
  broken_outbound_links: number;
  /** Pages en 5xx / 429 : indisponibilité, pas absence. Hors décompte « mortes ». */
  unstable_pages: number;
  /** Pages en 401/403/405/999 : protection serveur, jamais un défaut du site. */
  blocked_pages: number;
  entries: DeadUrlEntry[];
  /** Liens cassés relevés page par page (cible → sources), hors pages crawlées. */
  broken_targets: Array<{ target: string; sources: string[] }>;
}

function normalizeUrl(raw: string, base?: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, base);
    u.hash = '';
    const s = u.toString();
    return s.replace(/\/$/, '') || s;
  } catch {
    return null;
  }
}

const MAX_ENTRIES = 30;
const MAX_SOURCES = 5;

export function analyzeDeadUrls(pages: DeadUrlPageInput[]): DeadUrlReport {
  const byUrl = new Map<string, DeadUrlPageInput>();
  for (const p of pages) {
    const key = normalizeUrl(p.url);
    if (key) byUrl.set(key, p);
  }

  const dead = new Map<string, DeadUrlEntry>();
  let unstablePages = 0;
  let blockedPages = 0;
  for (const [key, page] of byUrl) {
    const status = Number(page.http_status || 0);
    if (status < 400) continue;
    // Juge unique : 404/410 = page morte ; 5xx = instable ; 403 = protection.
    const cls = classifyLink({ url: page.url, status });
    if (cls.verdict === 'blocked') {
      blockedPages++;
      continue;
    }
    if (cls.verdict === 'soft_broken') {
      unstablePages++;
      continue;
    }
    if (cls.verdict === 'hard_broken') {
      dead.set(key, {
        url: page.url,
        status,
        verdict: cls.verdict,
        label: cls.label,
        linked_from: [],
        canonical_from: [],
      });
    }
  }

  const brokenTargets = new Map<string, Set<string>>();

  for (const page of pages) {
    const status = Number(page.http_status || 200);
    // Liens internes vers une page morte connue
    for (const anchor of page.anchor_texts || []) {
      if (anchor?.type === 'external') continue;
      const target = normalizeUrl(anchor?.href || '', page.url);
      if (!target) continue;
      const entry = dead.get(target);
      if (entry && status < 400 && entry.linked_from.length < MAX_SOURCES) {
        if (!entry.linked_from.includes(page.url)) entry.linked_from.push(page.url);
      }
    }
    // Canonical vers une page morte
    const canonical = normalizeUrl(page.canonical_url || '', page.url);
    if (canonical) {
      const entry = dead.get(canonical);
      if (entry && canonical !== normalizeUrl(page.url) && entry.canonical_from.length < MAX_SOURCES) {
        if (!entry.canonical_from.includes(page.url)) entry.canonical_from.push(page.url);
      }
    }
    // Liens cassés relevés directement par l'analyseur (cibles non crawlées).
    // Les domaines qui refusent les robots (LinkedIn, Amazon…) sont écartés :
    // c'était la première source de faux positifs des rapports.
    for (const brokenRaw of page.broken_links || []) {
      const target = normalizeUrl(brokenRaw, page.url);
      if (!target || dead.has(target)) continue;
      if (isFalsePositiveDomain(target)) continue;
      if (!brokenTargets.has(target)) brokenTargets.set(target, new Set());
      const set = brokenTargets.get(target)!;
      if (set.size < MAX_SOURCES) set.add(page.url);
    }
  }

  const entries = [...dead.values()].sort((a, b) => {
    const score = (e: DeadUrlEntry) => e.linked_from.length * 10 + e.canonical_from.length * 20;
    return score(b) - score(a);
  }).slice(0, MAX_ENTRIES);

  return {
    analyzed_pages: pages.length,
    dead_pages: dead.size,
    linked_dead_pages: [...dead.values()].filter((e) => e.linked_from.length > 0).length,
    canonical_to_dead: [...dead.values()].filter((e) => e.canonical_from.length > 0).length,
    broken_outbound_links: brokenTargets.size,
    unstable_pages: unstablePages,
    blocked_pages: blockedPages,
    entries,
    broken_targets: [...brokenTargets.entries()]
      .map(([target, sources]) => ({ target, sources: [...sources] }))
      .slice(0, MAX_ENTRIES),
  };
}

/** Constats priorisés pour le rapport (Marina / Workbench). */
export function deadUrlFindings(report: DeadUrlReport | null) {
  if (!report) return [];
  const findings: any[] = [];
  const linked = report.entries.filter((e) => e.linked_from.length > 0);
  const canonical = report.entries.filter((e) => e.canonical_from.length > 0);

  if (canonical.length > 0) {
    findings.push({
      id: 'canonical_to_dead',
      title: `Canonical pointant vers une page morte (${canonical.length} cas)`,
      description:
        canonical.slice(0, 3).map((e) => `${e.canonical_from[0]} → ${e.url} (HTTP ${e.status})`).join(' ; ')
        + `. Le signal d'indexation est envoyé vers une URL inexistante : la page source devient non indexable de fait. `
        + `Remédiation : corriger le canonical vers l'URL vivante équivalente, ou le rendre auto-référent.`,
      priority: 'critical',
      category: 'technical',
      gap_ratio: 1,
    });
  }

  if (linked.length > 0) {
    findings.push({
      id: 'internal_links_to_dead',
      title: `Liens internes vers des pages mortes (${linked.length} URL(s) concernée(s))`,
      description:
        linked.slice(0, 3).map((e) => `${e.url} (HTTP ${e.status}) lié depuis ${e.linked_from.slice(0, 2).join(', ')}`).join(' ; ')
        + `. Ces liens gaspillent du budget de crawl, cassent la navigation et diluent le maillage interne. `
        + `Remédiation : rediriger en 301 vers l'équivalent vivant et mettre à jour les liens sources.`,
      priority: 'important',
      category: 'technical',
      gap_ratio: Math.min(1, linked.length / 5),
    });
  }

  const orphanDead = report.dead_pages - linked.length;
  if (orphanDead > 0) {
    findings.push({
      id: 'dead_pages_crawled',
      title: `${orphanDead} page(s) morte(s) atteignable(s) au crawl`,
      description:
        `Ces URLs répondent en erreur mais restent découvertes par le crawl (sitemap, redirection ou lien externe). `
        + `Remédiation : 301 vers l'équivalent, ou 410 explicite et retrait du sitemap si la page est définitivement supprimée.`,
      priority: 'suggestion',
      category: 'technical',
      gap_ratio: Math.min(1, orphanDead / 10),
    });
  }

  if (report.broken_outbound_links > 0) {
    findings.push({
      id: 'broken_links',
      title: `${report.broken_outbound_links} lien(s) cassé(s) relevé(s) dans les pages`,
      description:
        report.broken_targets.slice(0, 3).map((b) => `${b.target} (depuis ${b.sources[0]})`).join(' ; ')
        + `. Remédiation : corriger ou retirer ces liens ; un lien mort est un signal de maintenance faible pour un moteur comme pour un lecteur.`,
      priority: 'suggestion',
      category: 'technical',
      gap_ratio: Math.min(1, report.broken_outbound_links / 10),
    });
  }

  return findings;
}

