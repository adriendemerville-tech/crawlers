/**
 * Détection de "shell HTML" (contenu non rendu côté serveur) et verdict racine.
 *
 * Problème corrigé : le crawler acceptait tout HTML de plus de 500 octets. Une
 * SPA sert 15 Ko de HTML pour 70 caractères de texte visible → le seuil était
 * franchi, aucun rendu JS n'était déclenché, et le rapport concluait
 * "thin content / H1 absente / Schema.org absent" alors que la cause réelle est
 * l'absence de rendu serveur. Un seul constat racine doit alors remplacer la
 * dizaine de symptômes.
 *
 * 100 % déterministe, aucun appel LLM.
 */

export interface ShellVerdict {
  isShell: boolean;
  visibleWords: number;
  hasH1: boolean;
  hasJsonLd: boolean;
  hasMain: boolean;
  emptyRoot: boolean;
  htmlBytes: number;
  reasons: string[];
}

/** Marqueur porté par PageAnalysis.issues (aucune migration nécessaire). */
export const SHELL_ISSUE_MARKER = 'bot_shell:no_ssr';

const SHELL_MIN_WORDS = 120;

/** Texte visible : scripts/styles/templates retirés. */
export function extractVisibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#\d+);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((w) => w.length > 1).length;
}

/**
 * Conteneur de montage vide : <div id="root"></div>, #app, [data-reactroot]…
 * On regarde le contenu immédiat du conteneur, pas tout le document.
 */
function hasEmptyMountRoot(html: string): boolean {
  const re = /<div[^>]+(?:id|class)=["'][^"']*\b(root|app|__next|__nuxt|application)\b[^"']*["'][^>]*>([\s\S]{0,400}?)<\/div>/i;
  const m = html.match(re);
  if (!m) return false;
  return countWords(extractVisibleText(m[2] || '')) < 15;
}

export function detectShellHtml(html: string): ShellVerdict {
  const safe = typeof html === 'string' ? html : '';
  const visible = extractVisibleText(safe);
  const visibleWords = countWords(visible);
  const hasH1 = /<h1\b/i.test(safe);
  const hasJsonLd = /type=["']application\/ld\+json["']/i.test(safe);
  const hasMain = /<(main|article)\b/i.test(safe);
  const emptyRoot = hasEmptyMountRoot(safe);

  const reasons: string[] = [];
  if (visibleWords < SHELL_MIN_WORDS) reasons.push(`${visibleWords} mots visibles dans le HTML servi`);
  if (!hasH1) reasons.push('aucune balise H1 dans le HTML servi');
  if (!hasMain) reasons.push('aucun conteneur <main>/<article>');
  if (emptyRoot) reasons.push('conteneur de montage JS vide');

  // Un shell se reconnaît à la conjonction : peu de texte ET absence de
  // structure. Une page réellement pauvre garde en général son H1 et son <main>.
  const isShell = visibleWords < SHELL_MIN_WORDS && (emptyRoot || !hasH1 || !hasMain);

  return { isShell, visibleWords, hasH1, hasJsonLd, hasMain, emptyRoot, htmlBytes: safe.length, reasons };
}

/**
 * Le rendu JS a-t-il fait apparaître le contenu ? Si oui, le site n'est pas
 * pauvre : il n'est simplement pas rendu pour les robots qui n'exécutent pas JS.
 */
export function renderRevealedContent(rawWords: number, renderedWords: number): boolean {
  return renderedWords >= 120 && renderedWords > Math.max(rawWords * 2, rawWords + 60);
}

// ── Agrégat au niveau site ───────────────────────────────────
export interface BotRenderingReport {
  blocked: boolean;
  shell_pages: number;
  analyzed_pages: number;
  ratio: number;
  sample_urls: string[];
  reasons: string[];
}

export function aggregateBotRendering(
  pages: Array<{ url?: string; issues?: string[] | null }>,
): BotRenderingReport {
  const shell = pages.filter((p) => Array.isArray(p.issues) && p.issues.some((i) => String(i).startsWith(SHELL_ISSUE_MARKER)));
  const analyzed = pages.length;
  const ratio = analyzed > 0 ? shell.length / analyzed : 0;
  const reasons = Array.from(
    new Set(
      shell.flatMap((p) => (p.issues || [])
        .filter((i) => String(i).startsWith(SHELL_ISSUE_MARKER))
        .map((i) => String(i).slice(SHELL_ISSUE_MARKER.length + 1))
        .filter(Boolean)),
    ),
  ).slice(0, 4);

  return {
    // Un shell isolé n'est pas un défaut d'architecture ; à partir de 40 % des
    // pages analysées, c'est le mode de rendu du site.
    blocked: analyzed >= 3 && ratio >= 0.4,
    shell_pages: shell.length,
    analyzed_pages: analyzed,
    ratio: Math.round(ratio * 100) / 100,
    sample_urls: shell.slice(0, 5).map((p) => p.url || '').filter(Boolean),
    reasons,
  };
}

/**
 * Constats de contenu à neutraliser quand le HTML servi est un shell : ils ne
 * mesurent alors que l'absence de rendu, pas la qualité éditoriale.
 */
const SUPPRESSED_PATTERNS = [
  /thin[\s-]?content/i,
  /contenu (?:faible|pauvre|insuffisant|trop court)/i,
  /h1\b.*(absente?|manquante?|introuvable)/i,
  /(absente?|manquante?).*\bh1\b/i,
  /(schema\.org|json-?ld|donn[ée]es structur[ée]es).*(absent|manquant|à ajouter|inexistant)/i,
  /densit[ée] s[ée]mantique/i,
  /nombre de mots/i,
  /structure (?:de |des )?titres? (?:absente|insuffisante)/i,
];

export function isSuppressedByShell(title: string, description = ''): boolean {
  const text = `${title} ${description}`;
  return SUPPRESSED_PATTERNS.some((re) => re.test(text));
}

/** Constat racine, priorité 1, qui remplace les symptômes neutralisés. */
export function botRenderingFinding(report: BotRenderingReport, domain: string) {
  const pct = Math.round(report.ratio * 100);
  return {
    id: 'bot_rendering_shell',
    title: `Contenu non rendu pour les robots (${pct} % des pages analysées)`,
    description:
      `Le HTML servi par ${domain} ne contient pas le contenu de la page : ${report.shell_pages}/${report.analyzed_pages} pages ne livrent qu'une coquille JavaScript`
      + `${report.reasons.length ? ` (${report.reasons.join(' ; ')})` : ''}. `
      + `Le contenu n'apparaît qu'après exécution du JavaScript : Google le rend en général, mais les crawlers des moteurs IA ne l'exécutent pas — d'où l'absence de citations. `
      + `Ce point conditionne simultanément la présence de H1, la profondeur de contenu perçue, la lecture du Schema.org, le LCP et la citabilité IA : le corriger (rendu serveur / SSR, ou pré-rendu dédié aux robots) rend inutile la majorité des constats de contenu de ce rapport, qui mesurent tous cette même cause.`,
    priority: 'critical' as const,
    category: 'technical',
    gap_ratio: 1,
  };
}

/** Encart lisible inséré en tête des sections de contenu du rapport. */
export function botRenderingBlockHTML(report: BotRenderingReport, domain: string): string {
  if (!report.blocked) return '';
  const pct = Math.round(report.ratio * 100);
  const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  return `
    <div style="margin:16px 0;padding:14px 16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;">Constat racine : contenu non rendu côté serveur</div>
      <div style="font-size:13px;color:#374151;line-height:1.55;">
        ${esc(domain)} sert un HTML sans contenu sur ${report.shell_pages}/${report.analyzed_pages} pages analysées (${pct} %)
        ${report.reasons.length ? ` — ${esc(report.reasons.join(' ; '))}` : ''}.
        Les mesures de contenu ci-dessous (volume de texte, H1, données structurées, densité sémantique) portent sur le HTML servi
        et sont donc <strong>suspendues</strong> : elles décriraient l'absence de rendu, pas la qualité éditoriale réelle.
        Corriger le rendu serveur (SSR ou pré-rendu robots) est l'action n°1 ; les constats de contenu devront être re-mesurés ensuite.
      </div>
      ${report.sample_urls.length ? `<div style="font-size:12px;color:#6b7280;margin-top:8px;">Exemples : ${report.sample_urls.map((u) => esc(u)).join(' · ')}</div>` : ''}
    </div>`;
}
