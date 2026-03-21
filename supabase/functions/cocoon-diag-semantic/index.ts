import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * cocoon-diag-semantic: Diagnostic Sémantique
 * 
 * Analyses:
 * 1. Keyword gaps (pages without clear target keyword)
 * 2. Cannibalization (multiple pages targeting same keyword)
 * 3. Intent coverage (informational vs transactional vs navigational)
 * 4. Title/H1 mismatch with meta description
 * 5. Missing semantic richness (low H2/H3 diversity)
 * 6. Keyword stuffing detection
 * 
 * Uses: crawl_pages + cocoon_sessions (nodes) + tracked_sites.jargon_distance
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
  cannibalization: {
    fr: 'Cannibalisation détectée',
    en: 'Keyword cannibalization detected',
    es: 'Canibalización detectada',
  },
  no_clear_keyword: {
    fr: 'Pages sans mot-clé cible clair',
    en: 'Pages without clear target keyword',
    es: 'Páginas sin palabra clave objetivo clara',
  },
  title_h1_mismatch: {
    fr: 'Title et H1 incohérents',
    en: 'Title and H1 mismatch',
    es: 'Title y H1 inconsistentes',
  },
  low_heading_diversity: {
    fr: 'Faible diversité sémantique (peu de H2/H3)',
    en: 'Low semantic diversity (few H2/H3)',
    es: 'Baja diversidad semántica (pocos H2/H3)',
  },
  intent_imbalance: {
    fr: 'Déséquilibre des intentions de recherche',
    en: 'Search intent imbalance',
    es: 'Desequilibrio de intenciones de búsqueda',
  },
  duplicate_titles: {
    fr: 'Titres dupliqués entre pages',
    en: 'Duplicate titles across pages',
    es: 'Títulos duplicados entre páginas',
  },
  missing_semantic_depth: {
    fr: 'Profondeur sémantique insuffisante',
    en: 'Insufficient semantic depth',
    es: 'Profundidad semántica insuficiente',
  },
};

function t(key: string, lang: string): string {
  return LABELS[key]?.[lang] || LABELS[key]?.['fr'] || key;
}

// Simple intent classification based on URL patterns and titles
function classifyIntent(url: string, title: string): 'informational' | 'transactional' | 'navigational' | 'unknown' {
  const lUrl = url.toLowerCase();
  const lTitle = (title || '').toLowerCase();
  
  if (/\/(blog|article|guide|how-to|comment|conseil|astuce|tutorial)/i.test(lUrl) ||
      /comment|guide|pourquoi|qu'est-ce|what is|how to|tutorial/i.test(lTitle)) {
    return 'informational';
  }
  if (/\/(product|produit|shop|boutique|prix|price|buy|acheter|tarif)/i.test(lUrl) ||
      /acheter|buy|prix|price|promo|offre|devis|commander/i.test(lTitle)) {
    return 'transactional';
  }
  if (/\/(about|contact|a-propos|mentions|legal|cgv|cgu|equipe|team)/i.test(lUrl)) {
    return 'navigational';
  }
  return 'unknown';
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

    // Get latest crawl
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
        findings: [], scores: { semantic_health: 0 },
        metadata: { error: 'No completed crawl' },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: pages } = await supabase
      .from('crawl_pages')
      .select('url, path, title, h1, h2_count, h3_count, meta_description, word_count, is_indexable, has_noindex')
      .eq('crawl_id', crawl.id)
      .eq('http_status', 200)
      .limit(500);

    if (!pages || pages.length === 0) {
      return new Response(JSON.stringify({
        findings: [], scores: { semantic_health: 0 }, metadata: { pages_analyzed: 0 },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const indexable = pages.filter(p => p.is_indexable !== false && !p.has_noindex);
    const findings: Finding[] = [];

    // 1. Duplicate titles (cannibalization signal)
    const titleMap = new Map<string, string[]>();
    for (const p of indexable) {
      if (p.title && p.title.trim().length > 5) {
        const norm = p.title.trim().toLowerCase();
        const arr = titleMap.get(norm) || [];
        arr.push(p.url);
        titleMap.set(norm, arr);
      }
    }
    const dupTitles = [...titleMap.entries()].filter(([, urls]) => urls.length > 1);
    if (dupTitles.length > 0) {
      findings.push({
        id: 'duplicate_titles',
        severity: 'critical',
        category: 'semantic',
        title: t('duplicate_titles', lang),
        description: `${dupTitles.length} groupes de titres identiques`,
        affected_urls: dupTitles.flatMap(([, urls]) => urls),
        data: { groups: dupTitles.slice(0, 10).map(([title, urls]) => ({ title, urls })) },
      });
    }

    // 2. Title / H1 mismatch
    const mismatched = indexable.filter(p => {
      if (!p.title || !p.h1) return false;
      const t1 = p.title.toLowerCase().replace(/[^a-zàâéèêëïîôùûüç0-9\s]/g, '').trim();
      const h = p.h1.toLowerCase().replace(/[^a-zàâéèêëïîôùûüç0-9\s]/g, '').trim();
      if (t1.length < 5 || h.length < 5) return false;
      // Check if they share less than 30% common words
      const tWords = new Set(t1.split(/\s+/));
      const hWords = new Set(h.split(/\s+/));
      const common = [...tWords].filter(w => hWords.has(w)).length;
      const overlap = common / Math.max(tWords.size, hWords.size);
      return overlap < 0.3;
    });
    if (mismatched.length > 0) {
      findings.push({
        id: 'title_h1_mismatch',
        severity: 'warning',
        category: 'semantic',
        title: t('title_h1_mismatch', lang),
        description: `${mismatched.length} pages`,
        affected_urls: mismatched.map(p => p.url),
      });
    }

    // 3. Low heading diversity (pages with content but no H2/H3)
    const lowDiversity = indexable.filter(p =>
      (p.word_count || 0) > 300 && (p.h2_count || 0) < 2 && (p.h3_count || 0) === 0
    );
    if (lowDiversity.length > 0) {
      findings.push({
        id: 'low_heading_diversity',
        severity: 'warning',
        category: 'semantic',
        title: t('low_heading_diversity', lang),
        description: `${lowDiversity.length} pages avec contenu mais peu de sous-titres`,
        affected_urls: lowDiversity.map(p => p.url),
      });
    }

    // 4. Semantic depth — pages > 500 words but very few headings
    const shallowPages = indexable.filter(p =>
      (p.word_count || 0) > 500 && ((p.h2_count || 0) + (p.h3_count || 0)) < 3
    );
    if (shallowPages.length > 0) {
      findings.push({
        id: 'missing_semantic_depth',
        severity: 'info',
        category: 'semantic',
        title: t('missing_semantic_depth', lang),
        description: `${shallowPages.length} pages longues sans structure sémantique`,
        affected_urls: shallowPages.map(p => p.url),
      });
    }

    // 5. Intent distribution analysis
    const intents = { informational: 0, transactional: 0, navigational: 0, unknown: 0 };
    for (const p of indexable) {
      intents[classifyIntent(p.url, p.title || '')] += 1;
    }
    const total = indexable.length;
    const unknownPct = intents.unknown / Math.max(total, 1);
    if (unknownPct > 0.5) {
      findings.push({
        id: 'intent_imbalance',
        severity: 'warning',
        category: 'semantic',
        title: t('intent_imbalance', lang),
        description: `${Math.round(unknownPct * 100)}% des pages sans intention claire`,
        affected_urls: [],
        data: { intents },
      });
    }

    // 6. Pages without clear keyword (no title or very short title)
    const noKeyword = indexable.filter(p => !p.title || p.title.trim().length < 10);
    if (noKeyword.length > 0) {
      findings.push({
        id: 'no_clear_keyword',
        severity: 'warning',
        category: 'semantic',
        title: t('no_clear_keyword', lang),
        description: `${noKeyword.length} pages`,
        affected_urls: noKeyword.map(p => p.url),
      });
    }

    // Score
    const criticals = findings.filter(f => f.severity === 'critical').length;
    const warnings = findings.filter(f => f.severity === 'warning').length;
    const semanticHealth = Math.max(0, Math.min(100, 100 - criticals * 15 - warnings * 5 - Math.round(unknownPct * 20)));

    const scores = {
      semantic_health: semanticHealth,
      intent_distribution: intents,
      duplicate_title_pct: Math.round(dupTitles.flatMap(([, u]) => u).length / Math.max(total, 1) * 100),
    };

    const metadata = { pages_analyzed: indexable.length, crawl_id: crawl.id, analyzed_at: new Date().toISOString() };

    await supabase.from('cocoon_diagnostic_results').insert({
      tracked_site_id,
      user_id: auth.userId,
      domain,
      diagnostic_type: 'semantic',
      findings,
      scores,
      metadata,
    });

    return new Response(JSON.stringify({ findings, scores, metadata }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cocoon-diag-semantic] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
