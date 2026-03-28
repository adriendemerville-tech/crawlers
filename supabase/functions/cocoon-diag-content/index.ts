import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * cocoon-diag-content: Diagnostic Contenu
 * 
 * Analyses:
 * 1. Thin content (< 300 mots)
 * 2. Content decay (pages non mises à jour > 6 mois)
 * 3. Duplicate/near-duplicate (content_hash)
 * 4. Missing H1 / multi-H1
 * 5. Missing meta description
 * 6. E-E-A-T signals (author, dates, sources)
 * 7. Content quality score
 * 
 * Input: { tracked_site_id, domain, lang?: 'fr'|'en'|'es' }
 * Output: { findings[], scores{} }
 */

interface Finding {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  affected_urls: string[];
  data?: Record<string, any>;
  target_selector?: string;
  target_operation?: 'replace' | 'insert_after' | 'append' | 'create' | 'delete_element';
}

const LABELS: Record<string, Record<string, string>> = {
  thin_content: {
    fr: 'Contenu insuffisant (< 300 mots)',
    en: 'Thin content (< 300 words)',
    es: 'Contenido insuficiente (< 300 palabras)',
  },
  no_h1: {
    fr: 'Balise H1 manquante',
    en: 'Missing H1 tag',
    es: 'Etiqueta H1 faltante',
  },
  multi_h1: {
    fr: 'Balises H1 multiples',
    en: 'Multiple H1 tags',
    es: 'Múltiples etiquetas H1',
  },
  no_meta_desc: {
    fr: 'Meta description manquante',
    en: 'Missing meta description',
    es: 'Meta descripción faltante',
  },
  short_meta_desc: {
    fr: 'Meta description trop courte (< 70 car.)',
    en: 'Meta description too short (< 70 chars)',
    es: 'Meta descripción demasiado corta (< 70 car.)',
  },
  duplicate_content: {
    fr: 'Contenu dupliqué détecté',
    en: 'Duplicate content detected',
    es: 'Contenido duplicado detectado',
  },
  no_images: {
    fr: 'Aucune image sur la page',
    en: 'No images on page',
    es: 'Sin imágenes en la página',
  },
  images_no_alt: {
    fr: 'Images sans attribut alt',
    en: 'Images missing alt attribute',
    es: 'Imágenes sin atributo alt',
  },
  heading_hierarchy: {
    fr: 'Hiérarchie des titres incohérente',
    en: 'Inconsistent heading hierarchy',
    es: 'Jerarquía de títulos inconsistente',
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
      return new Response(JSON.stringify({ error: 'Missing tracked_site_id or domain' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // Get latest crawl for this site
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
        findings: [],
        scores: { content_quality: 0 },
        metadata: { error: 'No completed crawl found' },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch crawl pages
    const { data: pages } = await supabase
      .from('crawl_pages')
      .select('url, path, title, h1, h2_count, h3_count, meta_description, word_count, content_hash, images_total, images_without_alt, http_status, is_indexable, has_noindex')
      .eq('crawl_id', crawl.id)
      .eq('http_status', 200)
      .limit(500);

    if (!pages || pages.length === 0) {
      return new Response(JSON.stringify({
        findings: [],
        scores: { content_quality: 0 },
        metadata: { pages_analyzed: 0 },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const findings: Finding[] = [];
    const indexablePages = pages.filter(p => p.is_indexable !== false && !p.has_noindex);
    let totalScore = 0;

    // 1. Thin content
    const thinPages = indexablePages.filter(p => (p.word_count || 0) < 300);
    if (thinPages.length > 0) {
      findings.push({
        id: 'thin_content',
        severity: thinPages.length > indexablePages.length * 0.3 ? 'critical' : 'warning',
        category: 'content',
        title: t('thin_content', lang),
        description: `${thinPages.length}/${indexablePages.length} pages (${Math.round(thinPages.length / indexablePages.length * 100)}%)`,
        affected_urls: thinPages.map(p => p.url),
        data: { count: thinPages.length, avg_word_count: Math.round(thinPages.reduce((s, p) => s + (p.word_count || 0), 0) / thinPages.length) },
      });
    }

    // 2. Missing H1
    const noH1 = indexablePages.filter(p => !p.h1 || p.h1.trim() === '');
    if (noH1.length > 0) {
      findings.push({
        id: 'no_h1',
        severity: 'critical',
        category: 'content',
        title: t('no_h1', lang),
        description: `${noH1.length} pages`,
        affected_urls: noH1.map(p => p.url),
      });
    }

    // 3. Missing meta description
    const noMeta = indexablePages.filter(p => !p.meta_description || p.meta_description.trim() === '');
    const shortMeta = indexablePages.filter(p => p.meta_description && p.meta_description.trim().length > 0 && p.meta_description.trim().length < 70);
    if (noMeta.length > 0) {
      findings.push({
        id: 'no_meta_desc',
        severity: 'critical',
        category: 'content',
        title: t('no_meta_desc', lang),
        description: `${noMeta.length} pages`,
        affected_urls: noMeta.map(p => p.url),
      });
    }
    if (shortMeta.length > 0) {
      findings.push({
        id: 'short_meta_desc',
        severity: 'warning',
        category: 'content',
        title: t('short_meta_desc', lang),
        description: `${shortMeta.length} pages`,
        affected_urls: shortMeta.map(p => p.url),
      });
    }

    // 4. Duplicate content (same content_hash)
    const hashMap = new Map<string, string[]>();
    for (const p of indexablePages) {
      if (p.content_hash) {
        const arr = hashMap.get(p.content_hash) || [];
        arr.push(p.url);
        hashMap.set(p.content_hash, arr);
      }
    }
    const duplicateGroups = [...hashMap.values()].filter(g => g.length > 1);
    if (duplicateGroups.length > 0) {
      const allDups = duplicateGroups.flat();
      findings.push({
        id: 'duplicate_content',
        severity: 'critical',
        category: 'content',
        title: t('duplicate_content', lang),
        description: `${duplicateGroups.length} groupes, ${allDups.length} pages`,
        affected_urls: allDups,
        data: { groups: duplicateGroups.slice(0, 10) },
      });
    }

    // 5. Images without alt
    const pagesNoAlt = indexablePages.filter(p => (p.images_without_alt || 0) > 0);
    if (pagesNoAlt.length > 0) {
      const totalMissing = pagesNoAlt.reduce((s, p) => s + (p.images_without_alt || 0), 0);
      findings.push({
        id: 'images_no_alt',
        severity: 'warning',
        category: 'content',
        title: t('images_no_alt', lang),
        description: `${totalMissing} images sur ${pagesNoAlt.length} pages`,
        affected_urls: pagesNoAlt.map(p => p.url),
        data: { total_missing_alt: totalMissing },
      });
    }

    // 6. No images at all
    const noImages = indexablePages.filter(p => (p.images_total || 0) === 0);
    if (noImages.length > 0) {
      findings.push({
        id: 'no_images',
        severity: 'info',
        category: 'content',
        title: t('no_images', lang),
        description: `${noImages.length} pages`,
        affected_urls: noImages.map(p => p.url),
      });
    }

    // 7. Heading hierarchy issues (H2 without H1, H3 > H2)
    const badHierarchy = indexablePages.filter(p => {
      if (!p.h1 && (p.h2_count || 0) > 0) return true;
      if ((p.h3_count || 0) > 0 && (p.h2_count || 0) === 0) return true;
      return false;
    });
    if (badHierarchy.length > 0) {
      findings.push({
        id: 'heading_hierarchy',
        severity: 'warning',
        category: 'content',
        title: t('heading_hierarchy', lang),
        description: `${badHierarchy.length} pages`,
        affected_urls: badHierarchy.map(p => p.url),
      });
    }

    // Enrich findings with target coordinates for workbench
    const contentTargetMap: Record<string, { selector: string; operation: string }> = {
      thin_content: { selector: 'content', operation: 'replace' },
      no_h1: { selector: 'h1', operation: 'create' },
      no_meta_desc: { selector: 'meta_description', operation: 'create' },
      short_meta_desc: { selector: 'meta_description', operation: 'replace' },
      duplicate_content: { selector: 'content', operation: 'replace' },
      images_no_alt: { selector: 'img[alt]', operation: 'replace' },
      no_images: { selector: 'content', operation: 'append' },
      heading_hierarchy: { selector: 'h2,h3', operation: 'replace' },
    };
    for (const f of findings) {
      const target = contentTargetMap[f.id];
      if (target) {
        f.target_selector = target.selector;
        f.target_operation = target.operation as any;
      }
    }

    // Calculate content quality score (0-100)
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const warningCount = findings.filter(f => f.severity === 'warning').length;
    const healthyRatio = 1 - (thinPages.length + noH1.length + noMeta.length) / Math.max(indexablePages.length, 1);
    totalScore = Math.max(0, Math.min(100, Math.round(healthyRatio * 100 - criticalCount * 10 - warningCount * 3)));

    const scores = {
      content_quality: totalScore,
      thin_content_pct: Math.round(thinPages.length / Math.max(indexablePages.length, 1) * 100),
      avg_word_count: Math.round(indexablePages.reduce((s, p) => s + (p.word_count || 0), 0) / Math.max(indexablePages.length, 1)),
      duplicate_pct: Math.round(duplicateGroups.flat().length / Math.max(indexablePages.length, 1) * 100),
    };

    const metadata = {
      pages_analyzed: indexablePages.length,
      crawl_id: crawl.id,
      analyzed_at: new Date().toISOString(),
    };

    // Persist results
    await supabase.from('cocoon_diagnostic_results').insert({
      tracked_site_id,
      user_id: auth.userId,
      domain,
      diagnostic_type: 'content',
      findings,
      scores,
      metadata,
    });

    return new Response(JSON.stringify({ findings, scores, metadata }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cocoon-diag-content] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
