/**
 * expertAuditWorkbench.ts
 *
 * Propage les recommandations d'expert-audit dans architect_workbench,
 * côté serveur et de façon idempotente (contrairement à l'insert client
 * autoSaveActionPlan qui dédupliquait par titre et créait des doublons
 * dès qu'un libellé changeait).
 *
 * Clé stable : source_record_id = expert_<domain>_<recommendation_id>
 *   → onConflict 'source_type,source_record_id' (index NON partiel requis).
 *
 * Fournit aussi target_selector / target_operation pour que Parménion et
 * Code Architect puissent cibler la correction sans inférence.
 */

export interface ExpertRecommendation {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  fixes?: string[];
}

const SEVERITY_MAP: Record<string, string> = {
  critical: 'critical',
  important: 'high',
  high: 'high',
  medium: 'medium',
  optional: 'low',
  low: 'low',
};

/** id de recommandation → (sélecteur CMS/DOM, opération) */
const TARGET_MAP: Record<string, { selector: string; operation: string }> = {
  missing_title: { selector: 'title', operation: 'create' },
  title_too_long: { selector: 'title', operation: 'replace' },
  missing_meta_desc: { selector: 'meta_description', operation: 'create' },
  short_meta_desc: { selector: 'meta_description', operation: 'replace' },
  missing_h1: { selector: 'h1', operation: 'create' },
  multiple_h1: { selector: 'h1', operation: 'replace' },
  no_schema_org: { selector: 'schema_org', operation: 'create' },
  jsonld_errors: { selector: 'schema_org', operation: 'replace' },
  low_content: { selector: 'content', operation: 'append' },
  thin_content: { selector: 'content', operation: 'append' },
  broken_links: { selector: 'a[href]', operation: 'replace' },
  canonical_missing: { selector: 'canonical_url', operation: 'create' },
  canonical_issues: { selector: 'canonical_url', operation: 'replace' },
  missing_sitemap: { selector: 'sitemap_xml', operation: 'create' },
  robots_restrictive: { selector: 'robots_txt', operation: 'replace' },
  not_https: { selector: 'performance_config', operation: 'replace' },
  performance_critical: { selector: 'performance_config', operation: 'replace' },
  missing_llms_txt: { selector: 'llms_txt', operation: 'create' },
  missing_alt: { selector: 'img[alt]', operation: 'replace' },
};

/** Inférence de repli sur la catégorie / le titre. */
function inferTarget(rec: ExpertRecommendation): { selector: string | null; operation: string | null } {
  const known = TARGET_MAP[rec.id];
  if (known) return { selector: known.selector, operation: known.operation };

  const k = `${rec.id} ${rec.title} ${rec.category}`.toLowerCase();
  if (/meta ?desc/.test(k)) return { selector: 'meta_description', operation: 'replace' };
  if (/\btitle\b|balise titre/.test(k)) return { selector: 'title', operation: 'replace' };
  if (/\bh1\b/.test(k)) return { selector: 'h1', operation: 'create' };
  if (/\bh2\b|hiérarchie/.test(k)) return { selector: 'h2', operation: 'create' };
  if (/schema|json-?ld|donnees structur|données structur/.test(k)) return { selector: 'schema_org', operation: 'create' };
  if (/canonical/.test(k)) return { selector: 'canonical_url', operation: 'replace' };
  if (/sitemap/.test(k)) return { selector: 'sitemap_xml', operation: 'create' };
  if (/robots/.test(k)) return { selector: 'robots_txt', operation: 'replace' };
  if (/lien|link|404/.test(k)) return { selector: 'a[href]', operation: 'replace' };
  if (/alt|image/.test(k)) return { selector: 'img[alt]', operation: 'replace' };
  if (/lcp|cls|tbt|perf|vitesse|speed/.test(k)) return { selector: 'performance_config', operation: 'replace' };
  if (/contenu|content|mots/.test(k)) return { selector: 'content', operation: 'append' };
  return { selector: null, operation: null };
}

export interface ExpertWorkbenchOptions {
  domain: string;
  url: string;
  userId: string;
  trackedSiteId?: string | null;
  sourceFunction?: string;
  maxRows?: number;
}

export async function writeExpertAuditFindingsToWorkbench(
  sb: any,
  recommendations: ExpertRecommendation[],
  opts: ExpertWorkbenchOptions,
): Promise<{ attempted: number; written: number }> {
  if (!sb || !opts.userId || !opts.domain || !Array.isArray(recommendations) || recommendations.length === 0) {
    return { attempted: 0, written: 0 };
  }

  const seen = new Set<string>();
  const rows: any[] = [];

  for (const rec of recommendations.slice(0, opts.maxRows ?? 60)) {
    const title = (rec.title || '').trim();
    const recId = (rec.id || '').trim();
    if (!title || !recId || seen.has(recId)) continue;
    seen.add(recId);

    const { selector, operation } = inferTarget(rec);

    rows.push({
      domain: opts.domain,
      tracked_site_id: opts.trackedSiteId || null,
      user_id: opts.userId,
      source_type: 'audit_tech',
      source_function: opts.sourceFunction || 'expert-audit',
      source_record_id: `expert_${opts.domain}_${recId}`,
      finding_category: rec.category || 'seo',
      severity: SEVERITY_MAP[(rec.priority || '').toLowerCase()] || 'medium',
      title: title.slice(0, 280),
      description: (rec.description || '').slice(0, 2000),
      target_url: opts.url || null,
      target_selector: selector,
      target_operation: operation,
      payload: {
        expert_recommendation_id: recId,
        original_priority: rec.priority || null,
        fixes: Array.isArray(rec.fixes) ? rec.fixes.slice(0, 5) : undefined,
      },
    });
  }

  if (rows.length === 0) return { attempted: 0, written: 0 };

  let written = 0;
  for (const row of rows) {
    try {
      const { error } = await sb
        .from('architect_workbench')
        .upsert(row, { onConflict: 'source_type,source_record_id' });
      if (!error) written++;
      else console.warn(`[expertWorkbench] upsert failed (${row.source_record_id}):`, error.message);
    } catch (e) {
      console.warn('[expertWorkbench] upsert exception:', (e as Error).message);
    }
  }

  console.log(`[expertWorkbench] ${written}/${rows.length} constats écrits dans architect_workbench`);
  return { attempted: rows.length, written };
}
