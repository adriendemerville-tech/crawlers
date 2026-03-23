import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * cocoon-diag-structure: Diagnostic Structure
 * 
 * Analyses:
 * 1. Crawl depth (pages > 3 clics de la Home)
 * 2. Orphan pages (0 internal links pointing to them)
 * 3. Redirect chains (301/302 chains)
 * 4. Broken links (404, 5xx)
 * 5. Index bloat (noindex pages in sitemap)
 * 6. URL structure quality
 * 7. Canonical issues
 * 
 * Input: { tracked_site_id, domain, lang?: 'fr'|'en'|'es' }
 */

interface Finding {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  affected_urls: string[];
  data?: Record<string, any>;
}

const LABELS: Record<string, Record<string, string>> = {
  deep_pages: {
    fr: 'Pages trop profondes (> 3 clics)',
    en: 'Deep pages (> 3 clicks from home)',
    es: 'Páginas demasiado profundas (> 3 clics)',
  },
  orphan_pages: {
    fr: 'Pages orphelines (0 lien interne entrant)',
    en: 'Orphan pages (0 internal incoming links)',
    es: 'Páginas huérfanas (0 enlaces internos entrantes)',
  },
  broken_links: {
    fr: 'Liens cassés (404/5xx)',
    en: 'Broken links (404/5xx)',
    es: 'Enlaces rotos (404/5xx)',
  },
  redirect_chains: {
    fr: 'Chaînes de redirections',
    en: 'Redirect chains',
    es: 'Cadenas de redirecciones',
  },
  canonical_issues: {
    fr: 'Problèmes de balise canonical',
    en: 'Canonical tag issues',
    es: 'Problemas de etiqueta canonical',
  },
  long_urls: {
    fr: 'URLs trop longues (> 100 caractères)',
    en: 'URLs too long (> 100 characters)',
    es: 'URLs demasiado largas (> 100 caracteres)',
  },
  noindex_in_sitemap: {
    fr: 'Pages noindex présentes dans le sitemap',
    en: 'Noindex pages found in sitemap',
    es: 'Páginas noindex encontradas en el sitemap',
  },
  low_internal_links: {
    fr: 'Pages avec très peu de liens internes sortants',
    en: 'Pages with very few outgoing internal links',
    es: 'Páginas con muy pocos enlaces internos salientes',
  },
};

function t(key: string, lang: string): string {
  return LABELS[key]?.[lang] || LABELS[key]?.['fr'] || key;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tracked_site_id, domain, lang = 'fr' } = await req.json();
    if (!tracked_site_id || !domain) {
      return new Response(JSON.stringify({ error: 'Missing params' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    const { data: crawl } = await supabase
      .from('site_crawls')
      .select('id')
      .eq('tracked_site_id', tracked_site_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!crawl) {
      return new Response(JSON.stringify({
        findings: [], scores: { structure_health: 0 },
        metadata: { error: 'No completed crawl' },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: pages } = await supabase
      .from('crawl_pages')
      .select('url, path, http_status, crawl_depth, internal_links, external_links, has_canonical, canonical_url, has_noindex, is_indexable, redirect_url, broken_links')
      .eq('crawl_id', crawl.id)
      .limit(500);

    if (!pages || pages.length === 0) {
      return new Response(JSON.stringify({
        findings: [], scores: { structure_health: 0 }, metadata: { pages_analyzed: 0 },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const findings: Finding[] = [];
    const okPages = pages.filter(p => p.http_status === 200);

    // 1. Deep pages (crawl_depth > 3)
    const deepPages = okPages.filter(p => (p.crawl_depth || 0) > 3);
    if (deepPages.length > 0) {
      findings.push({
        id: 'deep_pages',
        severity: deepPages.length > okPages.length * 0.3 ? 'critical' : 'warning',
        category: 'structure',
        title: t('deep_pages', lang),
        description: `${deepPages.length} pages à profondeur > 3`,
        affected_urls: deepPages.map(p => p.url),
        data: { max_depth: Math.max(...deepPages.map(p => p.crawl_depth || 0)) },
      });
    }

    // 2. Orphan pages — use semantic_nodes internal_links_in (computed by cocoon-logic from real crawl anchors)
    const { data: semanticNodes } = await supabase
      .from('semantic_nodes' as any)
      .select('url, internal_links_in')
      .eq('tracked_site_id', tracked_site_id)
      .limit(500);

    let orphanPages: typeof okPages = [];
    if (semanticNodes && semanticNodes.length > 0) {
      const inMap = new Map(semanticNodes.map((n: any) => [n.url, n.internal_links_in || 0]));
      orphanPages = okPages.filter(p => {
        const inLinks = inMap.get(p.url) ?? inMap.get(p.url.replace(/\/+$/, ''));
        return (inLinks === undefined || inLinks === 0) && p.crawl_depth !== 0;
      });
    } else {
      // Fallback: approximate from crawl_depth (pages found only via sitemap, not linked)
      orphanPages = okPages.filter(p => (p.crawl_depth || 0) === 0 && p.url !== pages[0]?.url);
    }

    if (orphanPages.length > 0) {
      findings.push({
        id: 'orphan_pages',
        severity: orphanPages.length > 5 ? 'critical' : 'warning',
        category: 'structure',
        title: t('orphan_pages', lang),
        description: `${orphanPages.length} pages sans lien interne entrant`,
        affected_urls: orphanPages.map(p => p.url),
      });
    }

    // 3. Broken links
    const brokenPages = pages.filter(p => p.http_status && (p.http_status >= 400));
    if (brokenPages.length > 0) {
      findings.push({
        id: 'broken_links',
        severity: brokenPages.length > 10 ? 'critical' : 'warning',
        category: 'structure',
        title: t('broken_links', lang),
        description: `${brokenPages.length} URLs en erreur`,
        affected_urls: brokenPages.map(p => p.url),
        data: {
          by_status: brokenPages.reduce((acc, p) => {
            acc[p.http_status || 0] = (acc[p.http_status || 0] || 0) + 1;
            return acc;
          }, {} as Record<number, number>),
        },
      });
    }

    // 4. Redirect chains
    const redirectPages = pages.filter(p => p.redirect_url && (p.http_status === 301 || p.http_status === 302));
    if (redirectPages.length > 0) {
      findings.push({
        id: 'redirect_chains',
        severity: redirectPages.length > 20 ? 'critical' : 'warning',
        category: 'structure',
        title: t('redirect_chains', lang),
        description: `${redirectPages.length} redirections`,
        affected_urls: redirectPages.map(p => p.url),
      });
    }

    // 5. Canonical issues (self-referencing missing or pointing elsewhere)
    const canonicalIssues = okPages.filter(p => {
      if (!p.has_canonical) return false;
      if (p.canonical_url && p.canonical_url !== p.url) return true; // points elsewhere
      return false;
    });
    if (canonicalIssues.length > 0) {
      findings.push({
        id: 'canonical_issues',
        severity: 'warning',
        category: 'structure',
        title: t('canonical_issues', lang),
        description: `${canonicalIssues.length} pages avec canonical vers une autre URL`,
        affected_urls: canonicalIssues.map(p => p.url),
      });
    }

    // 6. Long URLs
    const longUrls = okPages.filter(p => p.url.length > 100);
    if (longUrls.length > 0) {
      findings.push({
        id: 'long_urls',
        severity: 'info',
        category: 'structure',
        title: t('long_urls', lang),
        description: `${longUrls.length} URLs`,
        affected_urls: longUrls.map(p => p.url),
      });
    }

    // 7. Noindex pages (index bloat check)
    const noindexPages = pages.filter(p => p.has_noindex);
    if (noindexPages.length > okPages.length * 0.2 && noindexPages.length > 5) {
      findings.push({
        id: 'noindex_in_sitemap',
        severity: 'warning',
        category: 'structure',
        title: t('noindex_in_sitemap', lang),
        description: `${noindexPages.length} pages noindex (${Math.round(noindexPages.length / pages.length * 100)}%)`,
        affected_urls: noindexPages.map(p => p.url),
      });
    }

    // 8. Low internal links
    const lowLinks = okPages.filter(p => (p.internal_links || 0) < 3 && (p.crawl_depth || 0) > 0);
    if (lowLinks.length > 5) {
      findings.push({
        id: 'low_internal_links',
        severity: 'info',
        category: 'structure',
        title: t('low_internal_links', lang),
        description: `${lowLinks.length} pages avec < 3 liens internes`,
        affected_urls: lowLinks.map(p => p.url),
      });
    }

    // Score
    const criticals = findings.filter(f => f.severity === 'critical').length;
    const warnings = findings.filter(f => f.severity === 'warning').length;
    const avgDepth = okPages.reduce((s, p) => s + (p.crawl_depth || 0), 0) / Math.max(okPages.length, 1);
    const structureHealth = Math.max(0, Math.min(100,
      100 - criticals * 15 - warnings * 5 - Math.round(Math.max(0, avgDepth - 2) * 5)
    ));

    const scores = {
      structure_health: structureHealth,
      avg_crawl_depth: Math.round(avgDepth * 10) / 10,
      broken_pct: Math.round(brokenPages.length / Math.max(pages.length, 1) * 100),
      redirect_pct: Math.round(redirectPages.length / Math.max(pages.length, 1) * 100),
    };

    const metadata = { pages_analyzed: pages.length, crawl_id: crawl.id, analyzed_at: new Date().toISOString() };

    await supabase.from('cocoon_diagnostic_results').insert({
      tracked_site_id,
      user_id: auth.userId,
      domain,
      diagnostic_type: 'structure',
      findings,
      scores,
      metadata,
    });

    return new Response(JSON.stringify({ findings, scores, metadata }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cocoon-diag-structure] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
