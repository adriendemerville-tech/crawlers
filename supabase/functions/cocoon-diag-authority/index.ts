import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * cocoon-diag-authority: Diagnostic Autorité
 * 
 * Analyses:
 * 1. Internal PageRank distribution (concentration, pages sans PR)
 * 2. Backlink profile health (referring domains trend)
 * 3. Anchor text diversity
 * 4. Domain rank evolution
 * 5. Lost referring domains
 * 6. Link equity leaks (external links without nofollow)
 * 
 * Uses: backlink_snapshots + crawl_pages + cocoon_sessions
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
  low_domain_rank: {
    fr: 'Domain Rank faible',
    en: 'Low Domain Rank',
    es: 'Domain Rank bajo',
  },
  losing_backlinks: {
    fr: 'Perte de domaines référents',
    en: 'Losing referring domains',
    es: 'Pérdida de dominios referentes',
  },
  low_referring_domains: {
    fr: 'Peu de domaines référents',
    en: 'Few referring domains',
    es: 'Pocos dominios referentes',
  },
  anchor_over_optimization: {
    fr: 'Sur-optimisation des ancres',
    en: 'Anchor text over-optimization',
    es: 'Sobre-optimización de anclas',
  },
  high_external_links: {
    fr: 'Trop de liens externes sortants',
    en: 'Too many outgoing external links',
    es: 'Demasiados enlaces externos salientes',
  },
  pagerank_concentration: {
    fr: 'PageRank concentré sur peu de pages',
    en: 'PageRank concentrated on few pages',
    es: 'PageRank concentrado en pocas páginas',
  },
  no_backlink_data: {
    fr: 'Aucune donnée de backlinks disponible',
    en: 'No backlink data available',
    es: 'Sin datos de backlinks disponibles',
  },
  pages_with_external_authority: {
    fr: 'Pages recevant de l\'autorité externe',
    en: 'Pages receiving external authority',
    es: 'Páginas recibiendo autoridad externa',
  },
  pages_without_backlinks: {
    fr: 'Pages piliers sans backlinks externes',
    en: 'Pillar pages without external backlinks',
    es: 'Páginas pilares sin backlinks externos',
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

    // Fetch backlink snapshots and crawl data in parallel
    const [backlinkRes, crawlRes, cocoonRes] = await Promise.all([
      supabase
        .from('backlink_snapshots')
        .select('*')
        .eq('tracked_site_id', tracked_site_id)
        .order('measured_at', { ascending: false })
        .limit(12),
      supabase
        .from('site_crawls')
        .select('id')
        .eq('tracked_site_id', tracked_site_id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('cocoon_sessions')
        .select('nodes_snapshot')
        .eq('tracked_site_id', tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const snapshots = backlinkRes.data || [];
    const findings: Finding[] = [];

    // --- Backlink analysis ---
    if (snapshots.length === 0) {
      findings.push({
        id: 'no_backlink_data',
        severity: 'info',
        category: 'authority',
        title: t('no_backlink_data', lang),
        description: '',
        affected_urls: [],
      });
    } else {
      const latest = snapshots[0];

      // 1. Low domain rank
      if (latest.domain_rank !== null && latest.domain_rank < 20) {
        findings.push({
          id: 'low_domain_rank',
          severity: latest.domain_rank < 10 ? 'critical' : 'warning',
          category: 'authority',
          title: t('low_domain_rank', lang),
          description: `Domain Rank: ${latest.domain_rank}/100`,
          affected_urls: [],
          data: { domain_rank: latest.domain_rank },
        });
      }

      // 2. Low referring domains
      if ((latest.referring_domains || 0) < 20) {
        findings.push({
          id: 'low_referring_domains',
          severity: (latest.referring_domains || 0) < 5 ? 'critical' : 'warning',
          category: 'authority',
          title: t('low_referring_domains', lang),
          description: `${latest.referring_domains || 0} domaines référents`,
          affected_urls: [],
          data: { referring_domains: latest.referring_domains },
        });
      }

      // 3. Losing backlinks (compare last 2 snapshots)
      if (snapshots.length >= 2) {
        const prev = snapshots[1];
        const lost = latest.referring_domains_lost || 0;
        const gained = latest.referring_domains_new || 0;
        if (lost > gained && lost > 5) {
          findings.push({
            id: 'losing_backlinks',
            severity: lost > 20 ? 'critical' : 'warning',
            category: 'authority',
            title: t('losing_backlinks', lang),
            description: `−${lost} / +${gained} domaines référents`,
            affected_urls: [],
            data: { lost, gained, net: gained - lost },
          });
        }
      }

      // 4. Anchor diversity
      if (latest.anchor_distribution) {
        const anchors = latest.anchor_distribution as Record<string, number>;
        const total = Object.values(anchors).reduce((s, v) => s + v, 0);
        const topAnchorPct = total > 0 ? Math.max(...Object.values(anchors)) / total : 0;
        if (topAnchorPct > 0.5 && total > 10) {
          findings.push({
            id: 'anchor_over_optimization',
            severity: topAnchorPct > 0.7 ? 'critical' : 'warning',
            category: 'authority',
            title: t('anchor_over_optimization', lang),
            description: `${Math.round(topAnchorPct * 100)}% des ancres identiques`,
            affected_urls: [],
            data: { top_anchor_pct: Math.round(topAnchorPct * 100), total_anchors: total },
          });
        }
      }
    }

    // --- Internal link analysis from crawl ---
    let externalLinkPages: string[] = [];
    if (crawlRes.data) {
      const { data: pages } = await supabase
        .from('crawl_pages')
        .select('url, external_links, internal_links')
        .eq('crawl_id', crawlRes.data.id)
        .eq('http_status', 200)
        .limit(500);

      if (pages) {
        // 5. Pages with high external links (link equity leak)
        externalLinkPages = pages.filter(p => (p.external_links || 0) > 20).map(p => p.url);
        if (externalLinkPages.length > 0) {
          findings.push({
            id: 'high_external_links',
            severity: 'warning',
            category: 'authority',
            title: t('high_external_links', lang),
            description: `${externalLinkPages.length} pages avec > 20 liens externes`,
            affected_urls: externalLinkPages,
          });
        }
      }
    }

    // --- PageRank concentration from Cocoon ---
    if (cocoonRes.data?.nodes_snapshot) {
      const nodes = cocoonRes.data.nodes_snapshot as any[];
      if (Array.isArray(nodes) && nodes.length > 5) {
        const prs = nodes.map(n => n.pageRank || n.pagerank || 0).filter(v => v > 0).sort((a, b) => b - a);
        if (prs.length > 0) {
          const top10pct = prs.slice(0, Math.max(1, Math.ceil(prs.length * 0.1)));
          const totalPR = prs.reduce((s, v) => s + v, 0);
          const top10share = top10pct.reduce((s, v) => s + v, 0) / totalPR;
          if (top10share > 0.7) {
            findings.push({
              id: 'pagerank_concentration',
              severity: top10share > 0.85 ? 'critical' : 'warning',
              category: 'authority',
              title: t('pagerank_concentration', lang),
              description: `Top 10% des pages captent ${Math.round(top10share * 100)}% du PageRank`,
              affected_urls: [],
              data: { top10_share: Math.round(top10share * 100), total_nodes: nodes.length },
            });
          }
        }
      }
    }

    // --- Per-page backlinks from semantic_nodes.external_backlinks ---
    const { data: nodesWithBl } = await supabase
      .from('semantic_nodes')
      .select('url, page_authority, external_backlinks')
      .eq('tracked_site_id', tracked_site_id)
      .order('page_authority', { ascending: false })
      .limit(50);

    if (nodesWithBl && nodesWithBl.length > 0) {
      const withBl = nodesWithBl.filter((n: any) => n.external_backlinks?.referring_domains > 0);
      const topWithout = nodesWithBl
        .slice(0, 20) // top 20 by authority
        .filter((n: any) => !n.external_backlinks?.referring_domains);

      if (withBl.length > 0) {
        findings.push({
          id: 'pages_with_external_authority',
          severity: 'info',
          category: 'backlink_health',
          title: t('pages_with_external_authority', lang),
          description: `${withBl.length} pages reçoivent des backlinks externes (total: ${withBl.reduce((s: number, n: any) => s + (n.external_backlinks?.referring_domains || 0), 0)} domaines référents)`,
          affected_urls: withBl.map((n: any) => n.url),
          data: {
            pages_with_backlinks: withBl.length,
            total_referring_domains: withBl.reduce((s: number, n: any) => s + (n.external_backlinks?.referring_domains || 0), 0),
            top_pages: withBl.slice(0, 5).map((n: any) => ({
              url: n.url,
              referring_domains: n.external_backlinks?.referring_domains,
              top_sources: n.external_backlinks?.top_sources?.slice(0, 3),
            })),
          },
        });
      }

      if (topWithout.length > 3) {
        findings.push({
          id: 'pillar_pages_no_backlinks',
          severity: 'warning',
          category: 'backlink_health',
          title: t('pages_without_backlinks', lang),
          description: `${topWithout.length} pages à forte autorité interne n'ont aucun backlink externe`,
          affected_urls: topWithout.map((n: any) => n.url),
        });
      }
    }
    // Score
    const criticals = findings.filter(f => f.severity === 'critical').length;
    const warnings = findings.filter(f => f.severity === 'warning').length;
    const latestSnap = snapshots[0];
    const drBonus = latestSnap?.domain_rank ? Math.min(20, latestSnap.domain_rank / 5) : 0;
    const authorityHealth = Math.max(0, Math.min(100,
      60 + drBonus - criticals * 15 - warnings * 5
    ));

    const scores = {
      authority_health: Math.round(authorityHealth),
      domain_rank: latestSnap?.domain_rank || null,
      referring_domains: latestSnap?.referring_domains || 0,
      backlinks_total: latestSnap?.backlinks_total || 0,
    };

    const metadata = {
      snapshots_analyzed: snapshots.length,
      analyzed_at: new Date().toISOString(),
    };

    await supabase.from('cocoon_diagnostic_results').insert({
      tracked_site_id,
      user_id: auth.userId,
      domain,
      diagnostic_type: 'authority',
      findings,
      scores,
      metadata,
    });

    return new Response(JSON.stringify({ findings, scores, metadata }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cocoon-diag-authority] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
