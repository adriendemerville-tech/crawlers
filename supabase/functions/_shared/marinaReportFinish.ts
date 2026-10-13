/**
 * Finition éditoriale des rapports Marina (0 token LLM).
 * - detectFounderFromCrawl : fondateur trouvé sur une page du domaine (À propos, équipe, schema Person).
 * - dropFalseAbsences : retire les constats « page service/offre absente » contredits par le crawl.
 * - decisionBlockHTML : page « Décision » — 3 alertes et 3 gains rapides.
 */

type CrawlPage = { url?: string; title?: string | null; h1?: string | null; meta_description?: string | null; schema_org_types?: unknown };

const ABOUT_RE = /(a-propos|about|qui-sommes|equipe|team|fondateur|founder|notre-histoire|agence)/i;
const ROLE_RE = /(fondat(?:eur|rice)|co-?fondat(?:eur|rice)|founder|ceo|g[ée]rant(?:e)?|dirigeant(?:e)?|pr[ée]sident(?:e)?)/i;
const NAME = "([A-ZÀ-Ý][a-zà-ÿ'-]+(?:\\s+[A-ZÀ-Ý][a-zà-ÿ'-]+){1,2})";
const NAME_THEN_ROLE = new RegExp(`${NAME}\\s*[,–—:-]?\\s*(?:\\(|,)?\\s*(?:le |la |notre |son |sa )?${ROLE_RE.source}`, 'u');
const ROLE_THEN_NAME = new RegExp(`${ROLE_RE.source}\\s*(?:de [^,:]{1,40})?\\s*[,:–—-]?\\s*${NAME}`, 'iu');
const STOP = /^(Notre|Votre|Nos|Vos|Le|La|Les|Un|Une|Qui|Accueil|Contact|Mentions|Agence|Equipe|Équipe)\b/;

export function detectFounderFromCrawl(pages: CrawlPage[] | null | undefined): { name: string; role: string; url: string } | null {
  if (!Array.isArray(pages)) return null;
  const ranked = [...pages].sort((a, b) => Number(ABOUT_RE.test(b.url || '')) - Number(ABOUT_RE.test(a.url || '')));
  for (const p of ranked) {
    const hasPerson = JSON.stringify(p.schema_org_types || '').includes('Person');
    if (!ABOUT_RE.test(p.url || '') && !hasPerson) continue;
    for (const txt of [p.h1, p.title, p.meta_description]) {
      if (!txt) continue;
      let m = String(txt).match(NAME_THEN_ROLE);
      let name = m?.[1]; let role = m?.[2];
      if (!name) { m = String(txt).match(ROLE_THEN_NAME); role = m?.[1]; name = m?.[2]; }
      if (name && role && !STOP.test(name)) return { name: name.trim(), role: role.toLowerCase(), url: p.url || '' };
    }
  }
  return null;
}

const ABSENCE_RE = /(page|pages)\s+(?:de\s+|d['’])?(service|offre|prestation|tarif|produit)s?[^.]{0,60}(absente|manquante|inexistante)|(cr[ée]er|ajouter)\s+(?:une\s+)?pages?\s+(?:de\s+|d['’])?(service|offre|prestation|tarif)/i;
const KIND_URL: Record<string, RegExp> = {
  service: /(service|prestation|expertise|solution)/i,
  prestation: /(service|prestation|expertise|solution)/i,
  offre: /(offre|tarif|prix|pricing|formule|abonnement)/i,
  tarif: /(offre|tarif|prix|pricing|formule)/i,
  produit: /(produit|product|boutique|shop)/i,
};

export function dropFalseAbsences<T extends { title?: string; description?: string }>(findings: T[], pages: CrawlPage[] | null | undefined): T[] {
  if (!Array.isArray(pages) || !pages.length) return findings;
  return findings.filter((f) => {
    const m = `${f.title || ''} ${f.description || ''}`.match(ABSENCE_RE);
    if (!m) return true;
    const kind = String(m[2] || m[5] || '').toLowerCase();
    const re = KIND_URL[kind];
    if (!re) return true;
    return !pages.some((p) => re.test(p.url || '') || re.test(p.h1 || '') || re.test(p.title || ''));
  });
}

type PlanItem = { severity?: string; title: string; roi?: { tier?: string; tier_label?: string; effort_label?: string } };

export function decisionBlockHTML(plan: PlanItem[] | null | undefined, lang: string): string {
  if (!Array.isArray(plan) || !plan.length) return '';
  const fr = lang !== 'en';
  const alerts = plan.filter((p) => p.severity === 'critical').slice(0, 3);
  const fill = alerts.length < 3 ? plan.filter((p) => p.severity === 'important' && !alerts.includes(p)).slice(0, 3 - alerts.length) : [];
  const top = [...alerts, ...fill];
  const quick = plan
    .filter((p) => !top.includes(p) && /quick|rapide/i.test(`${p.roi?.tier || ''} ${p.roi?.tier_label || ''}`))
    .slice(0, 3);
  const li = (i: PlanItem) => `<li style="margin:0 0 6px;">${i.title}${i.roi?.effort_label ? ` <span style="color:#6b7280;font-size:11.5px;">— ${i.roi.effort_label.toLowerCase()}</span>` : ''}</li>`;
  const col = (title: string, color: string, items: PlanItem[], empty: string) => `
    <div style="flex:1 1 260px;border:1px solid ${color};border-radius:8px;padding:12px 14px;">
      <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">${title}</div>
      ${items.length ? `<ol style="padding-left:18px;font-size:13px;line-height:1.6;margin:0;color:#111827;">${items.map(li).join('')}</ol>` : `<p style="font-size:12.5px;color:#6b7280;margin:0;">${empty}</p>`}
    </div>`;
  return `<div data-marina-block="decision" style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">
    ${col(fr ? '3 alertes' : '3 alerts', '#b91c1c', top, fr ? 'Aucun blocage critique ouvert.' : 'No open critical blocker.')}
    ${col(fr ? '3 gains rapides' : '3 quick wins', '#8a6d1f', quick, fr ? 'Aucun gain rapide isolé : voir le plan d’action.' : 'No isolated quick win: see the action plan.')}
  </div>`;
}

/** Allègement visuel : plus d'air, pastilles plus discrètes. */
export const LIGHTER_REPORT_CSS = `
  .section { padding: 28px 28px; margin-bottom: 28px; box-shadow: none; border: 1px solid #e5e7eb; }
  .section-title { margin-bottom: 20px; }
  .section p, .section li { line-height: 1.75; }
  .score-badge { font-size: 15px; padding: 4px 12px; }
  table { font-size: 12.5px; }
  td, th { padding: 7px 10px !important; }
`;
