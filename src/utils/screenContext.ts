/**
 * Captures a text snapshot of what's visible in the viewport.
 * Used by Felix to understand what the user is currently seeing.
 * 
 * Targets audit pages (/audit-expert, /matrice) and strategic results.
 * Returns a compact string (max ~2000 chars) for LLM context injection.
 */

const AUDIT_ROUTES = ['/audit-expert', '/matrice', '/cocoon', '/site-crawl', '/console'];

/** Check if current route is an audit-related page */
export function isAuditPage(pathname: string): boolean {
  return AUDIT_ROUTES.some(r => pathname.startsWith(r));
}

/** Estimate scroll position as percentage */
function getScrollPosition(): { percent: number; atTop: boolean; atBottom: boolean } {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const percent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
  return {
    percent,
    atTop: scrollTop < 100,
    atBottom: docHeight - scrollTop < 100,
  };
}

/** Extract visible text content from the viewport */
function getVisibleContent(): string {
  const viewportTop = window.scrollY;
  const viewportBottom = viewportTop + window.innerHeight;

  // Target meaningful content elements
  const selectors = [
    'h1', 'h2', 'h3',
    '[class*="score"]', '[class*="Score"]',
    '[class*="gauge"]', '[class*="Gauge"]',
    '[class*="metric"]', '[class*="Metric"]',
    '[class*="card"]', '[class*="Card"]',
    '[class*="badge"]', '[class*="Badge"]',
    'table', 'th', 'td',
    '[class*="category"]', '[class*="Category"]',
    '[class*="insight"]', '[class*="Insight"]',
    '[class*="recommendation"]',
    '[class*="action-plan"]', '[class*="ActionPlan"]',
    '[class*="narrative"]', '[class*="Narrative"]',
    '[class*="result"]', '[class*="Result"]',
  ];

  const seen = new Set<string>();
  const lines: string[] = [];

  for (const sel of selectors) {
    try {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        // Only capture elements visible in viewport
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        if (rect.height < 5 || rect.width < 5) continue;

        // Skip the chat window itself
        if (el.closest('.fixed.bottom-20')) continue;

        const text = (el as HTMLElement).innerText?.trim();
        if (!text || text.length < 3 || text.length > 500) continue;
        if (seen.has(text)) continue;
        seen.add(text);

        const tag = el.tagName.toLowerCase();
        if (tag.startsWith('h')) {
          lines.push(`## ${text}`);
        } else if (tag === 'th') {
          lines.push(`[col] ${text}`);
        } else if (tag === 'td') {
          lines.push(`  ${text}`);
        } else {
          lines.push(text);
        }
      }
    } catch {
      // selector may be invalid, skip
    }
  }

  return lines.join('\n').slice(0, 2000);
}

/** Get the page title / main heading */
function getPageTitle(): string {
  const h1 = document.querySelector('h1');
  return h1?.innerText?.trim() || document.title || '';
}

/** Main function: capture screen context for Felix */
export function captureScreenContext(pathname: string): string | null {
  if (!isAuditPage(pathname)) return null;

  const scroll = getScrollPosition();
  const title = getPageTitle();
  const content = getVisibleContent();

  if (!content || content.length < 20) return null;

  let context = `[Page: ${pathname}] ${title}\n`;
  context += `[Scroll: ${scroll.percent}%${scroll.atTop ? ' — haut de page' : ''}${scroll.atBottom ? ' — bas de page' : ''}]\n`;
  context += content;

  return context.slice(0, 2500);
}
