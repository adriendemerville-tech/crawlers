import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'

/**
 * Agent SEO Autonome v1
 * 
 * Parcourt les articles de blog et les landing pages autorisées,
 * analyse le contenu, et propose des améliorations SEO incrémentales.
 * 
 * - Blog articles: carte blanche (modifications directes)
 * - Landing pages: mode prudent (max 10% de modification)
 * - Pages interdites: /, /audit-expert, /site-crawl, /audit-compare, /console
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || ''

// ─── Allowed targets ─────────────────────────────────────────────────
const FORBIDDEN_ROUTES = ['/', '/audit-expert', '/site-crawl', '/audit-compare', '/console', '/profil']

const LANDING_PAGES = [
  { slug: 'generative-engine-optimization', url: '/generative-engine-optimization', type: 'landing' as const },
  { slug: 'pro-agency', url: '/pro-agency', type: 'landing' as const },
  { slug: 'tarifs', url: '/tarifs', type: 'landing' as const },
  { slug: 'methodologie', url: '/methodologie', type: 'landing' as const },
  { slug: 'audit-seo-gratuit', url: '/audit-seo-gratuit', type: 'landing' as const },
  { slug: 'analyse-site-web-gratuit', url: '/analyse-site-web-gratuit', type: 'landing' as const },
  { slug: 'indice-alignement-strategique', url: '/indice-alignement-strategique', type: 'landing' as const },
  { slug: 'guide-audit-seo', url: '/guide-audit-seo', type: 'landing' as const },
  { slug: 'faq', url: '/faq', type: 'landing' as const },
  { slug: 'observatoire', url: '/observatoire', type: 'landing' as const },
  { slug: 'integration-gtm', url: '/integration-gtm', type: 'landing' as const },
  { slug: 'lexique', url: '/lexique', type: 'landing' as const },
]

interface PageTarget {
  slug: string
  url: string
  type: 'blog' | 'landing'
}

interface SeoScore {
  overall: number
  keyword_density: number
  structure: number
  meta_quality: number
  internal_links: number
  content_length: number
  details: string[]
}

// ─── Fetch page HTML for analysis ────────────────────────────────────
async function fetchPageContent(baseUrl: string, path: string): Promise<string | null> {
  try {
    const url = `${baseUrl}${path}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CrawlersBot/SEO-Agent/1.0' },
    })
    if (!response.ok) return null
    const html = await response.text()
    // Extract text content (strip HTML tags for analysis)
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000) // Limit to 15k chars for LLM context
  } catch (e) {
    console.error(`[AGENT-SEO] Erreur fetch ${path}:`, e)
    return null
  }
}

// ─── SEO scoring heuristic ───────────────────────────────────────────
function computeSeoScore(html: string, pageType: 'blog' | 'landing'): SeoScore {
  const details: string[] = []
  const wordCount = html.split(/\s+/).length

  // Content length score
  const idealLength = pageType === 'blog' ? 1500 : 800
  const lengthRatio = Math.min(wordCount / idealLength, 1.5)
  const contentLengthScore = Math.min(100, Math.round(lengthRatio * 70))
  if (wordCount < idealLength * 0.5) details.push(`Contenu trop court: ${wordCount} mots (cible: ${idealLength})`)

  // Structure (H2/H3 proxy via keyword patterns)
  const h2Count = (html.match(/\b[A-Z][a-zéèêëàâäùûüôöîïç]{2,}\s[a-zéèêëàâäùûüôöîïç]+\b/g) || []).length
  const structureScore = Math.min(100, h2Count * 8)

  // Keyword density (check for SEO/GEO related terms)
  const seoTerms = ['seo', 'geo', 'audit', 'crawler', 'llm', 'ia', 'google', 'optimisation', 'référencement', 'visibilité', 'contenu', 'stratégie']
  const lowerHtml = html.toLowerCase()
  const termHits = seoTerms.filter(t => lowerHtml.includes(t)).length
  const keywordScore = Math.min(100, Math.round((termHits / seoTerms.length) * 100))

  // Meta quality (heuristic - check for common patterns)
  const hasNumbers = /\d+%|\d+x|\d+\s/.test(html)
  const hasCallToAction = /découvr|essayer|commencer|lancer|gratuit|obtenez/i.test(html)
  const metaScore = (hasNumbers ? 40 : 0) + (hasCallToAction ? 30 : 0) + (wordCount > 300 ? 30 : 0)

  // Internal links (check for / paths)
  const internalLinkCount = (html.match(/\/(audit|blog|lexique|geo|tarif|crawl|methodologie|faq)/gi) || []).length
  const linksScore = Math.min(100, internalLinkCount * 15)

  const overall = Math.round(
    contentLengthScore * 0.3 +
    structureScore * 0.2 +
    keywordScore * 0.2 +
    metaScore * 0.15 +
    linksScore * 0.15
  )

  return {
    overall,
    keyword_density: keywordScore,
    structure: structureScore,
    meta_quality: metaScore,
    internal_links: linksScore,
    content_length: contentLengthScore,
    details,
  }
}

// ─── LLM call for improvements ───────────────────────────────────────
async function generateImprovements(
  pageContent: string,
  target: PageTarget,
  seoScore: SeoScore,
): Promise<{ improvements: string; confidence: number; tokens: { input: number; output: number } }> {
  const prudenceLevel = target.type === 'landing'
    ? `MODE PRUDENT : Tu ne peux modifier que 10% maximum du contenu. Concentre-toi sur les micro-optimisations : 
       titres plus percutants, ajout de 1-2 mots-clés naturels, amélioration d'un CTA. NE CHANGE PAS la structure globale.`
    : `MODE LIBRE : Tu as carte blanche pour améliorer le contenu de cet article de blog. Tu peux réécrire des paragraphes, 
       ajouter des sections, enrichir les données, améliorer la structure H2/H3, densifier le maillage interne.`

  const systemPrompt = `Tu es un Agent SEO expert autonome pour le site crawlers.fr, plateforme SaaS de SEO et GEO.
  
${prudenceLevel}

SCORES SEO ACTUELS de la page :
- Score global : ${seoScore.overall}/100
- Densité mots-clés : ${seoScore.keyword_density}/100
- Structure : ${seoScore.structure}/100
- Qualité méta : ${seoScore.meta_quality}/100
- Maillage interne : ${seoScore.internal_links}/100
- Longueur contenu : ${seoScore.content_length}/100
${seoScore.details.length > 0 ? `\nProblèmes identifiés : ${seoScore.details.join(', ')}` : ''}

OBJECTIFS :
1. Améliorer le score SEO de cette page de +5 à +15 points par intervention
2. Ajouter des mots-clés pertinents naturellement (SEO, GEO, audit, crawler, LLM, IA, visibilité, e-commerce)
3. Renforcer le maillage interne vers : /audit-expert, /blog, /lexique, /tarifs, /generative-engine-optimization
4. Ajouter des données chiffrées concrètes quand possible
5. Améliorer les titres H2/H3 pour le SEO

CONTRAINTES :
- Pas de contenu inventé ou mensonger
- Garder le ton professionnel du site
- NE PAS ajouter de contenu promotionnel excessif
- Rester factuel et expert

Réponds UNIQUEMENT en JSON :
{
  "improvements": [
    {
      "type": "content_improvement|meta_optimization|internal_linking|structure_improvement",
      "location": "Description de l'emplacement (ex: paragraphe 3, H2 principal)",
      "before": "Texte original (ou null si ajout)",
      "after": "Texte amélioré",
      "reason": "Pourquoi cette modification améliore le SEO"
    }
  ],
  "estimated_score_improvement": 5-15,
  "confidence_score": 0-100,
  "summary": "Résumé en 1-2 phrases des améliorations"
}`

  const userPrompt = `PAGE : ${target.type === 'blog' ? 'Article de blog' : 'Landing page'} — ${target.slug}
URL : ${target.url}

CONTENU ACTUEL (extrait) :
---
${pageContent.substring(0, 12000)}
---

Analyse ce contenu et propose des améliorations SEO incrémentales.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://crawlers.fr',
      'X-Title': 'Crawlers SEO Agent v1',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  })

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  const tokens = {
    input: data.usage?.prompt_tokens || 0,
    output: data.usage?.completion_tokens || 0,
  }

  trackPaidApiCall('agent-seo', 'openrouter', 'google/gemini-2.5-flash')

  // Parse confidence
  let confidence = 0
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      confidence = parsed.confidence_score || 0
    }
  } catch { /* ignore parse errors for confidence */ }

  return { improvements: content, confidence, tokens }
}

// ─── Get blog articles from DB ───────────────────────────────────────
async function getBlogTargets(supabase: any): Promise<PageTarget[]> {
  const { data } = await supabase
    .from('blog_articles')
    .select('slug')
    .eq('status', 'published')
    .limit(50)

  if (!data || data.length === 0) {
    // Fallback: known blog slugs
    return [
      { slug: 'paradoxe-google-geo-2026', url: '/blog/paradoxe-google-geo-2026', type: 'blog' },
      { slug: 'crawler-definition-seo-geo', url: '/blog/crawler-definition-seo-geo', type: 'blog' },
      { slug: 'share-of-voice-llm-2026', url: '/blog/share-of-voice-llm-2026', type: 'blog' },
      { slug: 'indice-alignement-strategique-gsc', url: '/blog/indice-alignement-strategique-gsc', type: 'blog' },
    ]
  }

  return data.map((a: any) => ({
    slug: a.slug,
    url: `/blog/${a.slug}`,
    type: 'blog' as const,
  }))
}

// ─── Pick next target (round-robin based on least recently optimized) ─
async function pickTarget(supabase: any): Promise<PageTarget | null> {
  const [blogTargets] = await Promise.all([getBlogTargets(supabase)])
  const allTargets = [...blogTargets, ...LANDING_PAGES]

  // Get most recently optimized pages
  const { data: recentLogs } = await supabase
    .from('seo_agent_logs')
    .select('page_slug, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const recentSlugs = new Set((recentLogs || []).map((l: any) => l.page_slug))

  // Prioritize pages never optimized
  const neverOptimized = allTargets.filter(t => !recentSlugs.has(t.slug))
  if (neverOptimized.length > 0) {
    // Prioritize blog over landing
    const blogs = neverOptimized.filter(t => t.type === 'blog')
    if (blogs.length > 0) return blogs[Math.floor(Math.random() * blogs.length)]
    return neverOptimized[Math.floor(Math.random() * neverOptimized.length)]
  }

  // Otherwise pick the least recently optimized
  const slugToLastDate: Record<string, string> = {}
  for (const log of (recentLogs || []).reverse()) {
    slugToLastDate[(log as any).page_slug] = (log as any).created_at
  }

  allTargets.sort((a, b) => {
    const dateA = slugToLastDate[a.slug] || '2000-01-01'
    const dateB = slugToLastDate[b.slug] || '2000-01-01'
    return dateA.localeCompare(dateB)
  })

  return allTargets[0] || null
}

// ─── Main handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json().catch(() => ({}))
    const siteBaseUrl = body.base_url || 'https://crawlers.lovable.app'

    // Pick target page
    const targetSlug = body.target_slug || null
    let target: PageTarget | null = null

    if (targetSlug) {
      // Manual target override
      const allTargets = [...(await getBlogTargets(supabase)), ...LANDING_PAGES]
      target = allTargets.find(t => t.slug === targetSlug) || null
    } else {
      target = await pickTarget(supabase)
    }

    if (!target) {
      return new Response(JSON.stringify({ success: false, error: 'Aucune page cible trouvée' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Safety check: forbidden routes
    if (FORBIDDEN_ROUTES.some(r => target!.url === r || target!.url.startsWith(r + '/'))) {
      return new Response(JSON.stringify({ success: false, error: `Route interdite: ${target.url}` }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[AGENT-SEO] 🎯 Cible: ${target.type} — ${target.slug} (${target.url})`)

    // Fetch page content
    const pageContent = await fetchPageContent(siteBaseUrl, target.url)
    if (!pageContent || pageContent.length < 100) {
      console.error(`[AGENT-SEO] Contenu insuffisant pour ${target.url}`)
      return new Response(JSON.stringify({ success: false, error: 'Contenu page insuffisant' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Compute current SEO score
    const scoreBefore = computeSeoScore(pageContent, target.type)
    console.log(`[AGENT-SEO] Score avant: ${scoreBefore.overall}/100 pour ${target.slug}`)

    // Generate improvements via LLM
    const { improvements, confidence, tokens } = await generateImprovements(pageContent, target, scoreBefore)

    // Parse the improvements
    let parsedImprovements: any = null
    let summary = 'Améliorations générées'
    try {
      const jsonMatch = improvements.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedImprovements = JSON.parse(jsonMatch[0])
        summary = parsedImprovements.summary || summary
      }
    } catch (e) {
      console.error('[AGENT-SEO] Parse error:', e)
    }

    const estimatedScoreAfter = Math.min(100, scoreBefore.overall + (parsedImprovements?.estimated_score_improvement || 5))

    // Log to database
    const logEntry = {
      page_type: target.type,
      page_slug: target.slug,
      page_url: target.url,
      action_type: 'content_improvement',
      changes_summary: summary,
      changes_detail: parsedImprovements || { raw: improvements.substring(0, 5000) },
      seo_score_before: scoreBefore.overall,
      seo_score_after: estimatedScoreAfter,
      confidence_score: confidence,
      status: target.type === 'blog' ? 'applied' : 'pending_review',
      model_used: 'google/gemini-2.5-flash',
      tokens_used: tokens,
    }

    const { error: logError } = await supabase.from('seo_agent_logs').insert(logEntry)
    if (logError) console.error('[AGENT-SEO] Log error:', logError)

    await trackTokenUsage('agent-seo', 'google/gemini-2.5-flash', tokens.input, tokens.output).catch(() => {})

    console.log(`[AGENT-SEO] ✅ ${target.slug} — score ${scoreBefore.overall} → ${estimatedScoreAfter} (confiance: ${confidence}%)`)

    return new Response(JSON.stringify({
      success: true,
      target: { slug: target.slug, url: target.url, type: target.type },
      score_before: scoreBefore.overall,
      score_after: estimatedScoreAfter,
      confidence,
      summary,
      improvements_count: parsedImprovements?.improvements?.length || 0,
      status: logEntry.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[AGENT-SEO] Erreur:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
