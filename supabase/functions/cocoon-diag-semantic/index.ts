import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * cocoon-diag-semantic: Diagnostic Sémantique
 * 
 * 9 analyses:
 * 1. Duplicate titles (cannibalization)
 * 2. Title / H1 mismatch
 * 3. Low heading diversity
 * 4. Semantic depth
 * 5. Intent distribution
 * 6. Pages without clear keyword
 * 7. ★ Keyword gaps vs SERP (NEW)
 * 8. ★ Parent↔child semantic coherence (NEW)
 * 9. ★ Keyword vs content mismatch (NEW)
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
  keyword_gaps: {
    fr: 'Lacunes de mots-clés détectées',
    en: 'Keyword gaps detected',
    es: 'Brechas de palabras clave detectadas',
  },
  parent_child_incoherence: {
    fr: 'Incohérence sémantique parent↔enfant',
    en: 'Parent↔child semantic incoherence',
    es: 'Incoherencia semántica padre↔hijo',
  },
  keyword_content_mismatch: {
    fr: 'Décalage mot-clé / contenu de la page',
    en: 'Keyword vs page content mismatch',
    es: 'Desajuste entre palabra clave y contenido',
  },
};

function t(key: string, lang: string): string {
  return LABELS[key]?.[lang] || LABELS[key]?.['fr'] || key;
}

function classifyIntent(url: string, title: string): 'informational' | 'transactional' | 'navigational' | 'unknown' {
  const lUrl = url.toLowerCase();
  const lTitle = (title || '').toLowerCase();
  if (/\/(blog|article|guide|how-to|comment|conseil|astuce|tutorial)/i.test(lUrl) ||
      /comment|guide|pourquoi|qu'est-ce|what is|how to|tutorial/i.test(lTitle)) return 'informational';
  if (/\/(product|produit|shop|boutique|prix|price|buy|acheter|tarif)/i.test(lUrl) ||
      /acheter|buy|prix|price|promo|offre|devis|commander/i.test(lTitle)) return 'transactional';
  if (/\/(about|contact|a-propos|mentions|legal|cgv|cgu|equipe|team)/i.test(lUrl)) return 'navigational';
  return 'unknown';
}

// ── Helpers ──

const STOP_WORDS = new Set([
  'le','la','les','de','du','des','un','une','et','en','au','aux','à','ce','que',
  'qui','dans','pour','par','sur','avec','pas','est','sont','nous','vous','il',
  'the','a','an','of','to','in','for','on','is','are','and','or','with','by','at',
  'el','los','las','del','un','una','en','con','por','es','son','para','que',
]);

/** Extract meaningful words from a string */
function extractWords(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  return new Set(
    text.toLowerCase()
      .replace(/[^a-zàâéèêëïîôùûüçñ0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/** Jaccard similarity between two word sets */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter(w => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

/** Get parent path from a URL path: /a/b/c → /a/b/ */
function getParentPath(path: string): string | null {
  const clean = path.replace(/\/$/, '');
  const idx = clean.lastIndexOf('/');
  if (idx <= 0) return '/';
  return clean.substring(0, idx + 1);
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

    // ── Fetch latest crawl ──
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

    // ── Fetch pages + cocoon nodes + SERP keywords in parallel ──
    const [pagesRes, nodesRes, serpRes] = await Promise.all([
      supabase
        .from('crawl_pages')
        .select('url, path, title, h1, h2_count, h3_count, meta_description, word_count, is_indexable, has_noindex, anchor_texts')
        .eq('crawl_id', crawl.id)
        .eq('http_status', 200)
        .limit(500),
      supabase
        .from('cocoon_nodes')
        .select('url, title, keywords, parent_node_id, id, intent')
        .eq('tracked_site_id', tracked_site_id)
        .eq('status', 'active')
        .limit(500),
      supabase
        .from('serp_snapshots')
        .select('sample_keywords')
        .eq('tracked_site_id', tracked_site_id)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const pages = pagesRes.data || [];
    const nodes = nodesRes.data || [];
    const serpKeywords: any[] = (serpRes.data?.sample_keywords as any[]) || [];

    if (pages.length === 0) {
      return new Response(JSON.stringify({
        findings: [], scores: { semantic_health: 0 }, metadata: { pages_analyzed: 0 },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const indexable = pages.filter(p => p.is_indexable !== false && !p.has_noindex);
    const findings: Finding[] = [];

    // ══════════════════════════════════════════
    // 1. Duplicate titles (cannibalization)
    // ══════════════════════════════════════════
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
        description: `${dupTitles.length} ${lang === 'en' ? 'groups of identical titles' : lang === 'es' ? 'grupos de títulos idénticos' : 'groupes de titres identiques'}`,
        affected_urls: dupTitles.flatMap(([, urls]) => urls),
        data: { groups: dupTitles.slice(0, 10).map(([title, urls]) => ({ title, urls })) },
      });
    }

    // ══════════════════════════════════════════
    // 2. Title / H1 mismatch
    // ══════════════════════════════════════════
    const mismatched = indexable.filter(p => {
      if (!p.title || !p.h1) return false;
      const tWords = extractWords(p.title);
      const hWords = extractWords(p.h1);
      if (tWords.size < 2 || hWords.size < 2) return false;
      return jaccardSimilarity(tWords, hWords) < 0.2;
    });
    if (mismatched.length > 0) {
      findings.push({
        id: 'title_h1_mismatch',
        severity: 'warning',
        category: 'semantic',
        title: t('title_h1_mismatch', lang),
        description: `${mismatched.length} pages`,
        affected_urls: mismatched.map(p => p.url),
        data: { examples: mismatched.slice(0, 5).map(p => ({ url: p.url, title: p.title, h1: p.h1 })) },
      });
    }

    // ══════════════════════════════════════════
    // 3. Low heading diversity
    // ══════════════════════════════════════════
    const lowDiversity = indexable.filter(p =>
      (p.word_count || 0) > 300 && (p.h2_count || 0) < 2 && (p.h3_count || 0) === 0
    );
    if (lowDiversity.length > 0) {
      findings.push({
        id: 'low_heading_diversity',
        severity: 'warning',
        category: 'semantic',
        title: t('low_heading_diversity', lang),
        description: `${lowDiversity.length} pages`,
        affected_urls: lowDiversity.map(p => p.url),
      });
    }

    // ══════════════════════════════════════════
    // 4. Semantic depth
    // ══════════════════════════════════════════
    const shallowPages = indexable.filter(p =>
      (p.word_count || 0) > 500 && ((p.h2_count || 0) + (p.h3_count || 0)) < 3
    );
    if (shallowPages.length > 0) {
      findings.push({
        id: 'missing_semantic_depth',
        severity: 'info',
        category: 'semantic',
        title: t('missing_semantic_depth', lang),
        description: `${shallowPages.length} pages`,
        affected_urls: shallowPages.map(p => p.url),
      });
    }

    // ══════════════════════════════════════════
    // 5. Intent distribution
    // ══════════════════════════════════════════
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
        description: `${Math.round(unknownPct * 100)}% ${lang === 'en' ? 'of pages without clear intent' : lang === 'es' ? 'de páginas sin intención clara' : 'des pages sans intention claire'}`,
        affected_urls: [],
        data: { intents },
      });
    }

    // ══════════════════════════════════════════
    // 6. Pages without clear keyword
    // ══════════════════════════════════════════
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

    // ══════════════════════════════════════════
    // 7. ★ KEYWORD GAPS vs SERP
    // ══════════════════════════════════════════
    if (serpKeywords.length > 0) {
      // Build a set of words the site already targets (from all titles + H1)
      const siteWords = new Set<string>();
      for (const p of indexable) {
        for (const w of extractWords(p.title)) siteWords.add(w);
        for (const w of extractWords(p.h1)) siteWords.add(w);
      }

      // Find SERP keywords where the site ranks but has no dedicated page
      const gaps: { keyword: string; position: number }[] = [];
      for (const kw of serpKeywords) {
        const kwText = typeof kw === 'string' ? kw : kw?.keyword;
        const kwPos = typeof kw === 'object' ? kw?.position : null;
        if (!kwText) continue;
        const kwWords = extractWords(kwText);
        // Check if any page title substantially matches this keyword
        const hasPage = indexable.some(p => {
          const titleWords = extractWords(p.title);
          return jaccardSimilarity(titleWords, kwWords) > 0.4;
        });
        if (!hasPage && kwWords.size > 0) {
          gaps.push({ keyword: kwText, position: kwPos ?? 0 });
        }
      }

      if (gaps.length > 0) {
        findings.push({
          id: 'keyword_gaps',
          severity: gaps.length >= 5 ? 'critical' : 'warning',
          category: 'semantic',
          title: t('keyword_gaps', lang),
          description: `${gaps.length} ${lang === 'en' ? 'keywords with no dedicated page' : lang === 'es' ? 'palabras clave sin página dedicada' : 'mots-clés sans page dédiée'}`,
          affected_urls: [],
          data: { gaps: gaps.slice(0, 15) },
        });
      }
    }

    // Also use cocoon nodes' keywords for gap detection
    if (nodes.length > 0) {
      const nodeKeywords = new Map<string, string[]>(); // keyword → urls that claim it
      for (const n of nodes) {
        const kws = Array.isArray(n.keywords) ? n.keywords : [];
        for (const kw of kws) {
          const kwStr = typeof kw === 'string' ? kw : (kw as any)?.keyword;
          if (!kwStr) continue;
          const norm = kwStr.toLowerCase().trim();
          if (norm.length < 3) continue;
          const arr = nodeKeywords.get(norm) || [];
          arr.push(n.url);
          nodeKeywords.set(norm, arr);
        }
      }
      // Detect cannibalization from cocoon nodes (multiple pages target same keyword)
      const cannibalizedKws = [...nodeKeywords.entries()].filter(([, urls]) => urls.length > 1);
      if (cannibalizedKws.length > 0 && !findings.some(f => f.id === 'duplicate_titles')) {
        findings.push({
          id: 'cannibalization',
          severity: 'critical',
          category: 'semantic',
          title: t('cannibalization', lang),
          description: `${cannibalizedKws.length} ${lang === 'en' ? 'keywords targeted by multiple pages' : lang === 'es' ? 'palabras clave con varias páginas' : 'mots-clés ciblés par plusieurs pages'}`,
          affected_urls: cannibalizedKws.flatMap(([, urls]) => urls),
          data: { cannibalized: cannibalizedKws.slice(0, 10).map(([kw, urls]) => ({ keyword: kw, urls })) },
        });
      }
    }

    // ══════════════════════════════════════════
    // 8. ★ PARENT↔CHILD SEMANTIC COHERENCE
    // ══════════════════════════════════════════
    {
      // Build path → page map
      const pathMap = new Map<string, typeof indexable[0]>();
      for (const p of indexable) {
        const normPath = p.path?.replace(/\/$/, '') || '/';
        pathMap.set(normPath, p);
        pathMap.set(normPath + '/', p);
      }

      const incoherent: { child_url: string; parent_url: string; similarity: number }[] = [];

      for (const p of indexable) {
        const parentPath = getParentPath(p.path || '/');
        if (!parentPath || parentPath === p.path) continue;

        // Find parent page
        const parent = pathMap.get(parentPath) || pathMap.get(parentPath.replace(/\/$/, ''));
        if (!parent || parent.url === p.url) continue;

        const childWords = extractWords(p.title);
        const parentWords = extractWords(parent.title);
        if (childWords.size < 2 || parentWords.size < 2) continue;

        const sim = jaccardSimilarity(childWords, parentWords);
        // If similarity < 10%, the child's topic is completely unrelated to parent
        if (sim < 0.1) {
          incoherent.push({
            child_url: p.url,
            parent_url: parent.url,
            similarity: Math.round(sim * 100),
          });
        }
      }

      // Also check via cocoon nodes parent_node_id
      if (nodes.length > 0) {
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        for (const n of nodes) {
          if (!n.parent_node_id) continue;
          const parent = nodeById.get(n.parent_node_id);
          if (!parent) continue;
          const childW = extractWords(n.title);
          const parentW = extractWords(parent.title);
          if (childW.size < 2 || parentW.size < 2) continue;
          const sim = jaccardSimilarity(childW, parentW);
          if (sim < 0.1 && !incoherent.some(i => i.child_url === n.url)) {
            incoherent.push({
              child_url: n.url,
              parent_url: parent.url,
              similarity: Math.round(sim * 100),
            });
          }
        }
      }

      if (incoherent.length > 0) {
        findings.push({
          id: 'parent_child_incoherence',
          severity: incoherent.length >= 5 ? 'critical' : 'warning',
          category: 'semantic',
          title: t('parent_child_incoherence', lang),
          description: `${incoherent.length} ${lang === 'en' ? 'pages semantically disconnected from parent' : lang === 'es' ? 'páginas desconectadas semánticamente del padre' : 'pages sémantiquement déconnectées de leur parent'}`,
          affected_urls: incoherent.map(i => i.child_url),
          data: { pairs: incoherent.slice(0, 10) },
        });
      }
    }

    // ══════════════════════════════════════════
    // 9. ★ KEYWORD vs CONTENT MISMATCH
    // ══════════════════════════════════════════
    {
      // Cross-check title keywords vs meta_description + H1 + anchor texts
      const misaligned: { url: string; title: string; issue: string }[] = [];

      for (const p of indexable) {
        if (!p.title || p.title.length < 10) continue;
        const titleWords = extractWords(p.title);
        if (titleWords.size < 2) continue;

        // Combine all "content signals": H1 + meta_description + inbound anchor texts
        const contentWords = new Set<string>();
        for (const w of extractWords(p.h1)) contentWords.add(w);
        for (const w of extractWords(p.meta_description)) contentWords.add(w);

        // Parse anchor texts if available
        if (p.anchor_texts && Array.isArray(p.anchor_texts)) {
          for (const anchor of p.anchor_texts) {
            const text = typeof anchor === 'string' ? anchor : (anchor as any)?.text;
            for (const w of extractWords(text)) contentWords.add(w);
          }
        }

        if (contentWords.size < 3) continue;

        const sim = jaccardSimilarity(titleWords, contentWords);
        // Title talks about something the rest of the page doesn't reflect
        if (sim < 0.15) {
          misaligned.push({
            url: p.url,
            title: p.title,
            issue: lang === 'en'
              ? `Title keywords not reflected in content (${Math.round(sim * 100)}% overlap)`
              : lang === 'es'
                ? `Palabras del título no reflejadas en el contenido (${Math.round(sim * 100)}%)`
                : `Mots-clés du title absents du contenu (${Math.round(sim * 100)}% overlap)`,
          });
        }
      }

      if (misaligned.length > 0) {
        findings.push({
          id: 'keyword_content_mismatch',
          severity: misaligned.length >= 5 ? 'critical' : 'warning',
          category: 'semantic',
          title: t('keyword_content_mismatch', lang),
          description: `${misaligned.length} pages`,
          affected_urls: misaligned.map(m => m.url),
          data: { examples: misaligned.slice(0, 10) },
        });
      }
    }

    // ══════════════════════════════════════════
    // Score
    // ══════════════════════════════════════════
    const criticals = findings.filter(f => f.severity === 'critical').length;
    const warnings = findings.filter(f => f.severity === 'warning').length;
    const semanticHealth = Math.max(0, Math.min(100, 100 - criticals * 15 - warnings * 5 - Math.round(unknownPct * 20)));

    const scores = {
      semantic_health: semanticHealth,
      intent_distribution: intents,
      duplicate_title_pct: Math.round(dupTitles.flatMap(([, u]) => u).length / Math.max(total, 1) * 100),
      keyword_gap_count: findings.find(f => f.id === 'keyword_gaps')?.data?.gaps?.length || 0,
      parent_child_issues: findings.find(f => f.id === 'parent_child_incoherence')?.affected_urls?.length || 0,
      keyword_mismatch_count: findings.find(f => f.id === 'keyword_content_mismatch')?.affected_urls?.length || 0,
    };

    const metadata = {
      pages_analyzed: indexable.length,
      cocoon_nodes_used: nodes.length,
      serp_keywords_checked: serpKeywords.length,
      crawl_id: crawl.id,
      analyzed_at: new Date().toISOString(),
    };

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
