import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';

// ── Score SEO simplifié (sur 200) ──────────────────────────
function computePageScore(page: PageAnalysis): number {
  let score = 0;
  // Structure (max 60)
  if (page.title && page.title.length > 0 && page.title.length <= 60) score += 15;
  else if (page.title) score += 8;
  if (page.meta_description && page.meta_description.length >= 50 && page.meta_description.length <= 160) score += 15;
  else if (page.meta_description) score += 8;
  if (page.h1) score += 15;
  if (page.word_count >= 300) score += 15;
  else if (page.word_count >= 100) score += 8;
  // Technique (max 60)
  if (page.http_status === 200) score += 15;
  if (page.has_canonical) score += 15;
  if (page.has_schema_org) score += 15;
  if (page.has_og) score += 15;
  // Accessibilité images (max 30)
  if (page.images_total === 0 || page.images_without_alt === 0) score += 30;
  else score += Math.max(0, 30 - (page.images_without_alt / page.images_total) * 30);
  // Maillage (max 30)
  if (page.internal_links >= 3) score += 15;
  else if (page.internal_links >= 1) score += 8;
  if (page.external_links >= 1) score += 15;
  else score += 5;
  // Hreflang bonus (max 20)
  if (page.has_hreflang) score += 20;
  else score += 5;

  return Math.round(Math.min(200, score));
}

interface PageAnalysis {
  url: string;
  path: string;
  http_status: number;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  has_schema_org: boolean;
  has_canonical: boolean;
  has_hreflang: boolean;
  has_og: boolean;
  word_count: number;
  images_total: number;
  images_without_alt: number;
  internal_links: number;
  external_links: number;
  broken_links: string[];
  seo_score: number;
  issues: string[];
}

// ── Extraction des métriques SEO depuis le HTML ────────────
function analyzeHtml(html: string, pageUrl: string, domain: string): Omit<PageAnalysis, 'seo_score'> {
  const url = pageUrl;
  let path = '/';
  try { path = new URL(pageUrl).pathname; } catch {}

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  const meta_description = metaDescMatch ? metaDescMatch[1].trim() : null;

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null;

  const has_schema_org = /application\/ld\+json/i.test(html);
  const has_canonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const has_hreflang = /<link[^>]+hreflang/i.test(html);
  const has_og = /<meta[^>]+property=["']og:/i.test(html);

  // Word count from body text
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyText = bodyMatch ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').trim() : '';
  const word_count = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // Images
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const images_total = imgMatches.length;
  const images_without_alt = imgMatches.filter(img => !(/alt=["'][^"']+["']/i.test(img))).length;

  // Links
  const linkMatches = html.match(/<a[^>]+href=["']([^"'#]+)["']/gi) || [];
  let internal_links = 0;
  let external_links = 0;
  for (const link of linkMatches) {
    const hrefMatch = link.match(/href=["']([^"'#]+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (href.startsWith('/') || href.includes(domain)) internal_links++;
    else if (href.startsWith('http')) external_links++;
  }

  // HTTP status from meta (fallback, real status comes from Firecrawl metadata)
  const http_status = 200;

  // Issues detection
  const issues: string[] = [];
  if (!title) issues.push('missing_title');
  else if (title.length > 60) issues.push('title_too_long');
  if (!meta_description) issues.push('missing_meta_description');
  else if (meta_description.length > 160) issues.push('meta_description_too_long');
  if (!h1) issues.push('missing_h1');
  if (word_count < 100) issues.push('thin_content');
  if (!has_schema_org) issues.push('missing_schema_org');
  if (!has_canonical) issues.push('missing_canonical');
  if (!has_og) issues.push('missing_og');
  if (images_without_alt > 0) issues.push(`${images_without_alt}_images_without_alt`);

  return {
    url, path, http_status, title, meta_description, h1,
    has_schema_org, has_canonical, has_hreflang, has_og,
    word_count, images_total, images_without_alt,
    internal_links, external_links, broken_links: [], issues,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

  if (!firecrawlKey) {
    return new Response(JSON.stringify({ success: false, error: 'Firecrawl non configuré' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { url, maxPages = 50, userId } = await req.json();
    if (!url || !userId) {
      return new Response(JSON.stringify({ success: false, error: 'URL et userId requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;
    const domain = new URL(normalizedUrl).hostname;
    const pageLimit = Math.min(maxPages, 200);

    // Calculer le coût en crédits (5 pour 50 pages, 15 pour 200, etc.)
    const creditCost = pageLimit <= 50 ? 5 : pageLimit <= 100 ? 10 : pageLimit <= 200 ? 15 : 30;

    // Vérifier les crédits via RPC
    const { data: creditResult } = await supabase.rpc('use_credit', {
      p_user_id: userId,
      p_amount: creditCost,
      p_description: `Crawl multi-pages: ${domain} (${pageLimit} pages max)`,
    });

    if (!creditResult?.success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Crédits insuffisants',
        required: creditCost,
        balance: creditResult?.balance || 0,
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Créer l'entrée crawl
    const { data: crawl, error: crawlError } = await supabase
      .from('site_crawls')
      .insert({
        user_id: userId,
        domain,
        url: normalizedUrl,
        status: 'crawling',
        total_pages: pageLimit,
        credits_used: creditCost,
      })
      .select('id')
      .single();

    if (crawlError || !crawl) {
      console.error('Erreur création crawl:', crawlError);
      return new Response(JSON.stringify({ success: false, error: 'Erreur création crawl' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const crawlId = crawl.id;
    console.log(`[${crawlId}] Crawl démarré: ${domain} (max ${pageLimit} pages)`);

    // ── Phase 1: Map du site via Firecrawl ──
    console.log(`[${crawlId}] Phase 1: Mapping...`);
    const mapResponse = await fetch(`${FIRECRAWL_API}/map`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl, limit: pageLimit, includeSubdomains: false }),
    });

    const mapData = await mapResponse.json();
    if (!mapResponse.ok || !mapData.links?.length) {
      await supabase.from('site_crawls').update({ status: 'error', error_message: 'Impossible de mapper le site' }).eq('id', crawlId);
      return new Response(JSON.stringify({ success: false, error: 'Map échoué', crawlId }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const urls: string[] = mapData.links.slice(0, pageLimit);
    await supabase.from('site_crawls').update({ total_pages: urls.length }).eq('id', crawlId);
    console.log(`[${crawlId}] ${urls.length} URLs découvertes`);

    // ── Phase 2: Scrape par batch de 10 ──
    console.log(`[${crawlId}] Phase 2: Scraping...`);
    const allPages: PageAnalysis[] = [];
    const batchSize = 10;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const scrapePromises = batch.map(async (pageUrl) => {
        try {
          const res = await fetch(`${FIRECRAWL_API}/scrape`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: pageUrl, formats: ['html'], onlyMainContent: false, waitFor: 3000 }),
          });
          const data = await res.json();
          const html = data?.data?.html || data?.html || '';
          const statusCode = data?.data?.metadata?.statusCode || 200;

          if (!html) return null;

          const analysis = analyzeHtml(html, pageUrl, domain);
          analysis.http_status = statusCode;
          const seo_score = computePageScore(analysis);
          return { ...analysis, seo_score } as PageAnalysis;
        } catch (e) {
          console.warn(`[${crawlId}] Erreur scrape ${pageUrl}:`, e);
          return null;
        }
      });

      const results = await Promise.all(scrapePromises);
      const validResults = results.filter(Boolean) as PageAnalysis[];
      allPages.push(...validResults);

      // Sauvegarder en batch dans crawl_pages
      if (validResults.length > 0) {
        const rows = validResults.map(p => ({ crawl_id: crawlId, ...p }));
        await supabase.from('crawl_pages').insert(rows);
      }

      // Mettre à jour le compteur
      await supabase.from('site_crawls').update({ crawled_pages: allPages.length }).eq('id', crawlId);
      console.log(`[${crawlId}] ${allPages.length}/${urls.length} pages analysées`);
    }

    // ── Phase 3: Calcul des métriques globales ──
    const avgScore = allPages.length > 0
      ? Math.round(allPages.reduce((s, p) => s + p.seo_score, 0) / allPages.length)
      : 0;

    // ── Phase 4: Synthèse IA ──
    let aiSummary = '';
    let aiRecommendations: any[] = [];

    if (openrouterKey && allPages.length > 0) {
      console.log(`[${crawlId}] Phase 3: Synthèse IA...`);
      await supabase.from('site_crawls').update({ status: 'analyzing' }).eq('id', crawlId);

      const issuesSummary: Record<string, number> = {};
      allPages.forEach(p => p.issues.forEach(issue => {
        issuesSummary[issue] = (issuesSummary[issue] || 0) + 1;
      }));

      const topIssues = Object.entries(issuesSummary)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([issue, count]) => `${issue}: ${count} pages`);

      const bestPages = [...allPages].sort((a, b) => b.seo_score - a.seo_score).slice(0, 5);
      const worstPages = [...allPages].sort((a, b) => a.seo_score - b.seo_score).slice(0, 5);

      const prompt = `Tu es un expert SEO senior. Analyse ce crawl de ${domain} (${allPages.length} pages, score moyen: ${avgScore}/200).

PROBLÈMES DÉTECTÉS:
${topIssues.join('\n')}

MEILLEURES PAGES:
${bestPages.map(p => `- ${p.path} (${p.seo_score}/200)`).join('\n')}

PIRES PAGES:
${worstPages.map(p => `- ${p.path} (${p.seo_score}/200) — Problèmes: ${p.issues.join(', ')}`).join('\n')}

STATS:
- Pages avec Schema.org: ${allPages.filter(p => p.has_schema_org).length}/${allPages.length}
- Pages avec canonical: ${allPages.filter(p => p.has_canonical).length}/${allPages.length}
- Pages avec OG: ${allPages.filter(p => p.has_og).length}/${allPages.length}
- Contenu fin (<100 mots): ${allPages.filter(p => p.word_count < 100).length}
- Images sans alt: ${allPages.reduce((s, p) => s + p.images_without_alt, 0)}

Réponds en JSON STRICT:
{
  "summary": "Synthèse narrative en 3-4 phrases (en français), couvrant les forces et faiblesses du site.",
  "recommendations": [
    {"priority": "critical|high|medium", "title": "Titre court", "description": "Détail actionnable", "affected_pages": 12}
  ]
}
Donne 5-8 recommandations max, classées par impact.`;

      try {
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
        });

        const aiData = await aiRes.json();
        const aiContent = aiData.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(aiContent);
        aiSummary = parsed.summary || '';
        aiRecommendations = parsed.recommendations || [];
      } catch (e) {
        console.warn(`[${crawlId}] Synthèse IA échouée:`, e);
        aiSummary = `Crawl terminé: ${allPages.length} pages analysées, score moyen ${avgScore}/200.`;
      }
    }

    // ── Finalisation ──
    await supabase.from('site_crawls').update({
      status: 'completed',
      crawled_pages: allPages.length,
      avg_score: avgScore,
      ai_summary: aiSummary,
      ai_recommendations: aiRecommendations,
      completed_at: new Date().toISOString(),
    }).eq('id', crawlId);

    console.log(`[${crawlId}] ✅ Crawl terminé: ${allPages.length} pages, score moyen ${avgScore}/200`);

    return new Response(JSON.stringify({
      success: true,
      crawlId,
      totalPages: allPages.length,
      avgScore,
      aiSummary,
      recommendations: aiRecommendations,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Erreur crawl-site:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
