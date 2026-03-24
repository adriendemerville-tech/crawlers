import { corsHeaders } from '../_shared/cors.ts'
import { assertSafeUrl } from '../_shared/ssrf.ts'
import { fetchAndRenderPage } from '../_shared/renderPage.ts'
import { trackTokenUsage } from '../_shared/tokenTracker.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'

/* ================================================================== */
/*  AUTO-DETECT item type from prompt text (fuzzy + scoring)           */
/* ================================================================== */

type ItemType = 'balise' | 'structured_data' | 'performance' | 'security' | 'prompt' | 'metric_combinee'

interface TypeScore { type: ItemType; score: number }

// Weighted keyword groups: [keyword, bonus_weight]
const TYPE_KEYWORDS: Record<ItemType, [string, number][]> = {
  balise: [
    ['h1', 3], ['h2', 2], ['h3', 2], ['h4', 1], ['h5', 1], ['h6', 1],
    ['title', 3], ['meta description', 4], ['meta_description', 4], ['meta desc', 3],
    ['canonical', 3], ['alt', 2], ['viewport', 2],
    ['og:', 2], ['open graph', 3], ['twitter:', 2], ['hreflang', 3],
    ['balise', 3], ['tag', 1], ['author', 1], ['auteur', 1],
    ['img', 1], ['image alt', 2], ['favicon', 2], ['lang', 1],
    ['charset', 1], ['meta robot', 3], ['noindex', 3], ['nofollow', 3],
    ['titre', 3], ['en-tête', 2], ['heading', 2], ['attribut', 2],
    ['balise titre', 4], ['title tag', 4], ['méta', 3],
  ],
  structured_data: [
    ['schema', 3], ['json-ld', 4], ['jsonld', 4], ['json ld', 4],
    ['structured data', 4], ['données structurées', 4],
    ['robots.txt', 4], ['robots txt', 4], ['sitemap', 3],
    ['llms.txt', 4], ['llms txt', 4],
    ['organization', 2], ['faqpage', 3], ['breadcrumb', 3],
    ['article', 1], ['product', 1], ['review', 1], ['person', 1],
    ['website', 1], ['howto', 2], ['local business', 2],
    ['@type', 3], ['@graph', 3], ['sameas', 2], ['same_as', 2],
    ['schema.org', 4], ['balisage sémantique', 3], ['markup', 2],
    ['rich snippet', 3], ['extrait enrichi', 3],
  ],
  performance: [
    ['lcp', 4], ['fcp', 4], ['cls', 4], ['tbt', 4], ['tti', 3],
    ['speed index', 3], ['performance', 3], ['vitesse', 3],
    ['temps de chargement', 4], ['loading', 2], ['core web vitals', 5],
    ['cwv', 4], ['pagespeed', 4], ['lighthouse', 3],
    ['largest contentful', 4], ['first contentful', 4],
    ['cumulative layout', 4], ['total blocking', 4],
    ['web vital', 4], ['rapidité', 2], ['lenteur', 2],
  ],
  security: [
    ['https', 3], ['hsts', 4], ['ssl', 3], ['tls', 3],
    ['safe browsing', 3], ['sécurité', 3], ['security', 3],
    ['certificat', 3], ['certificate', 3], ['mixed content', 3],
    ['contenu mixte', 3], ['csp', 3], ['content security policy', 4],
  ],
  metric_combinee: [
    ['score global', 3], ['score technique', 3], ['score seo', 3],
    ['score sémantique', 3], ['semantic score', 3], ['technical score', 3],
    ['ai ready', 4], ['ia ready', 4], ['maillage', 3],
    ['internal link', 3], ['liens internes', 3], ['external link', 2],
    ['liens externes', 2], ['e-e-a-t', 4], ['eeat', 4],
    ['densité', 2], ['data density', 2], ['fraîcheur', 2],
    ['freshness', 2], ['contenu', 1], ['content quality', 3],
    ['social', 1], ['linkedin', 1], ['case study', 2],
    ['étude de cas', 2], ['faq', 2], ['tldr', 2],
    ['tableau', 1], ['table', 1], ['liste', 1], ['list', 1],
    ['qualité contenu', 3], ['readability', 2], ['lisibilité', 2],
    ['accessibilité', 2], ['accessibility', 2], ['mobile', 2],
    ['responsive', 2], ['ux', 2], ['expérience utilisateur', 3],
  ],
  prompt: [], // Prompt is the fallback, detected by structure not keywords
}

function detectItemType(prompt: string, llmName?: string): ItemType {
  const lower = prompt.toLowerCase().trim()

  // If it has a custom LLM and looks like a question/instruction → prompt
  if (llmName && llmName !== 'google/gemini-2.5-flash') {
    if (lower.length > 30 || lower.includes('?') || lower.includes('analyse') || lower.includes('évalue')) {
      return 'prompt'
    }
  }

  // Score each type by weighted keyword matches
  const scores: TypeScore[] = []
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [ItemType, [string, number][]][]) {
    if (type === 'prompt') continue
    let score = 0
    for (const [kw, weight] of keywords) {
      if (lower.includes(kw)) score += weight
    }
    if (score > 0) scores.push({ type, score })
  }

  // Return highest scoring type
  scores.sort((a, b) => b.score - a.score)
  if (scores.length > 0 && scores[0].score >= 2) {
    return scores[0].type
  }

  // If it's a long sentence or question, treat as prompt
  if (lower.length > 50 || lower.includes('?')) return 'prompt'

  return 'metric_combinee'
}

/* ================================================================== */
/*  HTML analysis (extracted from expert-audit, simplified)            */
/* ================================================================== */

interface HtmlData {
  hasTitle: boolean; titleLength: number; titleContent: string
  hasMetaDesc: boolean; metaDescLength: number; metaDescContent: string
  h1Count: number; h1Contents: string[]
  h2Count: number; h3Count: number
  wordCount: number
  hasSchemaOrg: boolean; schemaTypes: string[]; schemaCount: number
  schemaDepth: number; schemaFieldCount: number; schemaHasGraph: boolean
  isHttps: boolean
  imagesTotal: number; imagesMissingAlt: number
  hasCanonical: boolean; canonicalUrl: string
  hasHreflang: boolean
  hasViewport: boolean
  hasOg: boolean; ogTags: string[]
  hasTwitterCards: boolean
  hasAuthorBio: boolean
  hasFAQSection: boolean; hasFAQWithSchema: boolean
  hasTLDR: boolean; tableCount: number; listCount: number
  internalLinksCount: number; externalLinksCount: number
  hasLinkedInLinks: boolean; hasSocialLinks: boolean
  hasCaseStudies: boolean
  statisticCount: number; percentageCount: number; dataDensityScore: number
  contentAgeDays: number | null; mostRecentDate: string | null; dateSignalsCount: number
  hasLang: boolean; langValue: string
  hasCharset: boolean
  schemaEntities: {
    hasOrganization: boolean; hasProduct: boolean; hasArticle: boolean
    hasReview: boolean; hasFAQPage: boolean; hasWebSite: boolean
    hasBreadcrumb: boolean; hasPerson: boolean
  }
  hasSameAs: boolean
  hasAuthorInJsonLd: boolean
  htmlSize: number
}

function analyzeHtmlFull(html: string, url: string): HtmlData {
  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const titleContent = titleMatch ? titleMatch[1].trim() : ''

  // Meta description
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)
  const metaDescContent = metaDescMatch ? metaDescMatch[1].trim() : ''

  // H1
  const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || []
  const h1Contents = h1Matches.map(h => h.replace(/<[^>]*>/g, '').trim()).filter(c => c.length > 0)

  // H2, H3
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length

  // Word count
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const wordCount = textContent.split(' ').filter(w => w.length > 2).length

  // Schema.org
  const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  const schemaTypes: string[] = []
  let schemaDepth = 0, schemaFieldCount = 0, schemaHasGraph = false
  let hasSameAs = false, hasAuthorInJsonLd = false
  const schemaEntities = {
    hasOrganization: false, hasProduct: false, hasArticle: false,
    hasReview: false, hasFAQPage: false, hasWebSite: false,
    hasBreadcrumb: false, hasPerson: false,
  }

  for (const match of schemaMatches) {
    try {
      const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '')
      const parsed = JSON.parse(jsonContent)
      if (parsed['@graph']) schemaHasGraph = true
      const processItem = (item: any, depth: number) => {
        if (depth > schemaDepth) schemaDepth = depth
        if (!item || typeof item !== 'object') return
        if (Array.isArray(item)) { item.forEach(i => processItem(i, depth)); return }
        for (const [k, v] of Object.entries(item)) {
          schemaFieldCount++
          if (k === 'sameAs') hasSameAs = true
          if (k === 'author') hasAuthorInJsonLd = true
          if (typeof v === 'object' && v !== null) processItem(v, depth + 1)
        }
        const t = item['@type']
        if (t) {
          const types = Array.isArray(t) ? t : [t]
          types.forEach((type: string) => {
            schemaTypes.push(type)
            const tl = type.toLowerCase()
            if (tl.includes('organization') || tl.includes('localbusiness')) schemaEntities.hasOrganization = true
            if (tl.includes('product')) schemaEntities.hasProduct = true
            if (tl.includes('article') || tl.includes('blogposting') || tl.includes('newsarticle')) schemaEntities.hasArticle = true
            if (tl.includes('review')) schemaEntities.hasReview = true
            if (tl.includes('faqpage')) schemaEntities.hasFAQPage = true
            if (tl.includes('website')) schemaEntities.hasWebSite = true
            if (tl.includes('breadcrumb')) schemaEntities.hasBreadcrumb = true
            if (tl.includes('person')) schemaEntities.hasPerson = true
          })
        }
      }
      processItem(parsed, 0)
    } catch { /* invalid JSON-LD */ }
  }

  // Canonical
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : ''

  // Hreflang
  const hasHreflang = /<link[^>]*hreflang/i.test(html)

  // Viewport
  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html)

  // OG
  const ogMatches = html.match(/<meta[^>]*property=["']og:[^"']*["'][^>]*>/gi) || []
  const ogTags = ogMatches.map(m => {
    const p = m.match(/property=["'](og:[^"']*)["']/i)
    return p ? p[1] : ''
  }).filter(Boolean)

  // Twitter Cards
  const hasTwitterCards = /<meta[^>]*name=["']twitter:/i.test(html)

  // Author
  const hasAuthorBio = /(?:author|auteur|écrit par|written by|par\s)/i.test(html) &&
    /(?:bio|profil|linkedin|twitter|expert|spécialiste)/i.test(html)

  // FAQ
  const hasFAQSection = /faq|questions? fréquentes|frequently asked/i.test(html)
  const hasFAQWithSchema = hasFAQSection && schemaEntities.hasFAQPage

  // AI-favored formats
  const hasTLDR = /tl;?dr|résumé|en bref|key takeaway|points clés/i.test(html.substring(0, 5000))
  const tableCount = (html.match(/<table[\s>]/gi) || []).length
  const listCount = (html.match(/<[uo]l[\s>]/gi) || []).length

  // Links
  const internalLinksCount = (() => {
    try {
      const domain = new URL(url).hostname
      const links = html.match(/<a[^>]*href=["'][^"']*["'][^>]*>/gi) || []
      return links.filter(l => {
        const href = l.match(/href=["']([^"']*)["']/i)?.[1] || ''
        if (href.startsWith('/') || href.startsWith('#')) return true
        try { return new URL(href).hostname === domain } catch { return false }
      }).length
    } catch { return 0 }
  })()
  const allLinks = (html.match(/<a[^>]*href=["'][^"']*["'][^>]*>/gi) || []).length
  const externalLinksCount = allLinks - internalLinksCount

  // Social
  const hasLinkedInLinks = /linkedin\.com/i.test(html)
  const hasSocialLinks = /(?:twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|linkedin\.com)/i.test(html)

  // Case studies
  const hasCaseStudies = /(?:case study|étude de cas|client|témoignage|testimonial|avant.*après|before.*after)/i.test(html)

  // Data density
  const statisticCount = (textContent.match(/\d+[\s,.]?\d*\s*(%|euros?|€|\$|millions?|milliards?|k\b)/gi) || []).length
  const percentageCount = (textContent.match(/\d+\s*%/g) || []).length
  const dataDensityScore = Math.min(100, Math.round((statisticCount + percentageCount * 2) * 5))

  // Content freshness
  const dateMetaMatch = html.match(/<meta[^>]*(?:name|property)=["'](?:article:modified_time|og:updated_time|article:published_time|date)["'][^>]*content=["']([^"']*)["']/i)
  let mostRecentDate: string | null = null
  let contentAgeDays: number | null = null
  const dateSignals: string[] = []
  if (dateMetaMatch?.[1]) dateSignals.push(dateMetaMatch[1])
  // JSON-LD dates
  for (const match of schemaMatches) {
    try {
      const p = JSON.parse(match.replace(/<script[^>]*>|<\/script>/gi, ''))
      const items = p['@graph'] ? p['@graph'] : [p]
      for (const item of items) {
        if (item.dateModified) dateSignals.push(item.dateModified)
        if (item.datePublished) dateSignals.push(item.datePublished)
      }
    } catch {}
  }
  for (const ds of dateSignals) {
    try {
      const d = new Date(ds)
      if (!isNaN(d.getTime())) {
        if (!mostRecentDate || d > new Date(mostRecentDate)) {
          mostRecentDate = d.toISOString()
          contentAgeDays = Math.floor((Date.now() - d.getTime()) / 86400000)
        }
      }
    } catch {}
  }

  // Images
  const imgTags = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  const allImages = (imgTags.match(/<img\b[^>]*>/gi) || [])
  const imagesMissingAlt = allImages.filter(img => !/\balt\s*=\s*["'][^"']+["']/i.test(img)).length

  // Lang + charset
  const langMatch = html.match(/<html[^>]*\slang=["']([^"']*)["']/i)
  const hasCharset = /<meta[^>]*charset/i.test(html)

  // HTTPS
  let isHttps = false
  try { isHttps = new URL(url).protocol === 'https:' } catch {}

  return {
    hasTitle: !!titleContent, titleLength: titleContent.length, titleContent,
    hasMetaDesc: !!metaDescContent, metaDescLength: metaDescContent.length, metaDescContent,
    h1Count: h1Contents.length, h1Contents,
    h2Count, h3Count,
    wordCount,
    hasSchemaOrg: schemaTypes.length > 0, schemaTypes: [...new Set(schemaTypes)], schemaCount: schemaMatches.length,
    schemaDepth, schemaFieldCount, schemaHasGraph,
    isHttps,
    imagesTotal: allImages.length, imagesMissingAlt,
    hasCanonical: !!canonicalUrl, canonicalUrl,
    hasHreflang, hasViewport,
    hasOg: ogTags.length > 0, ogTags,
    hasTwitterCards,
    hasAuthorBio,
    hasFAQSection, hasFAQWithSchema,
    hasTLDR, tableCount, listCount,
    internalLinksCount, externalLinksCount,
    hasLinkedInLinks, hasSocialLinks,
    hasCaseStudies,
    statisticCount, percentageCount, dataDensityScore,
    contentAgeDays, mostRecentDate, dateSignalsCount: dateSignals.length,
    hasLang: !!langMatch, langValue: langMatch?.[1] || '',
    hasCharset,
    schemaEntities, hasSameAs, hasAuthorInJsonLd,
    htmlSize: html.length,
  }
}

/* ================================================================== */
/*  Check robots.txt                                                   */
/* ================================================================== */

interface RobotsData {
  exists: boolean; permissive: boolean; content: string
  allowsGPTBot: boolean; allowsClaudeBot: boolean; allowsPerplexityBot: boolean
}

async function checkRobots(url: string): Promise<RobotsData> {
  const result: RobotsData = { exists: false, permissive: false, content: '', allowsGPTBot: true, allowsClaudeBot: true, allowsPerplexityBot: true }
  try {
    const origin = new URL(url).origin
    const resp = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return result
    const content = await resp.text()
    result.exists = true
    result.content = content.substring(0, 2000)
    result.permissive = !content.includes('Disallow: /')
    const lower = content.toLowerCase()
    if (/user-agent:\s*gptbot[\s\S]*?disallow:\s*\//im.test(content)) result.allowsGPTBot = false
    if (/user-agent:\s*claudebot[\s\S]*?disallow:\s*\//im.test(content)) result.allowsClaudeBot = false
    if (/user-agent:\s*perplexitybot[\s\S]*?disallow:\s*\//im.test(content)) result.allowsPerplexityBot = false
  } catch {}
  return result
}

/* ================================================================== */
/*  Check sitemap                                                      */
/* ================================================================== */

interface SitemapData {
  exists: boolean; urlCount: number; containsMainUrl: boolean
}

async function checkSitemap(url: string): Promise<SitemapData> {
  const result: SitemapData = { exists: false, urlCount: 0, containsMainUrl: false }
  try {
    const origin = new URL(url).origin
    const resp = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return result
    const content = await resp.text()
    if (!content.includes('<urlset') && !content.includes('<sitemapindex')) return result
    result.exists = true
    const locs = content.match(/<loc>([^<]*)<\/loc>/gi) || []
    result.urlCount = locs.length
    const normalized = url.replace(/\/$/, '').toLowerCase()
    result.containsMainUrl = locs.some(l => l.replace(/<\/?loc>/gi, '').trim().replace(/\/$/, '').toLowerCase() === normalized)
  } catch {}
  return result
}

/* ================================================================== */
/*  Check llms.txt                                                     */
/* ================================================================== */

async function checkLlmsTxt(url: string): Promise<{ exists: boolean; content: string }> {
  try {
    const origin = new URL(url).origin
    const resp = await fetch(`${origin}/llms.txt`, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return { exists: false, content: '' }
    const content = await resp.text()
    return { exists: content.length > 10, content: content.substring(0, 500) }
  } catch { return { exists: false, content: '' } }
}

/* ================================================================== */
/*  PageSpeed data (optional)                                          */
/* ================================================================== */

interface PsiData {
  performance: number | null; seo: number | null
  lcp: number | null; fcp: number | null; cls: number | null; tbt: number | null
}

async function fetchPsi(url: string): Promise<PsiData> {
  const apiKey = Deno.env.get('GOOGLE_PAGESPEED_API_KEY')
  if (!apiKey) return { performance: null, seo: null, lcp: null, fcp: null, cls: null, tbt: null }
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=PERFORMANCE&category=SEO&key=${apiKey}`
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) })
    if (!resp.ok) { await resp.text(); return { performance: null, seo: null, lcp: null, fcp: null, cls: null, tbt: null } }
    const data = await resp.json()
    const cats = data?.lighthouseResult?.categories || {}
    const audits = data?.lighthouseResult?.audits || {}
    return {
      performance: cats.performance?.score != null ? Math.round(cats.performance.score * 100) : null,
      seo: cats.seo?.score != null ? Math.round(cats.seo.score * 100) : null,
      lcp: audits['largest-contentful-paint']?.numericValue || null,
      fcp: audits['first-contentful-paint']?.numericValue || null,
      cls: audits['cumulative-layout-shift']?.numericValue || null,
      tbt: audits['total-blocking-time']?.numericValue || null,
    }
  } catch { return { performance: null, seo: null, lcp: null, fcp: null, cls: null, tbt: null } }
}

/* ================================================================== */
/*  Compute score for a single CSV item                                */
/* ================================================================== */

interface ItemInput {
  id: string; prompt: string; type?: string; llm_name?: string
  poids: number; axe: string
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
}

interface ItemResult {
  id: string; prompt: string; axe: string; poids: number
  detected_type: ItemType
  crawlers_score: number  // 0-100 (engine)
  parsed_score: number    // 0-100 (LLM evaluation of user's prompt)
  raw_data: Record<string, any>
  parsed_raw?: Record<string, any>
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
}

function computeBaliseScore(prompt: string, html: HtmlData): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()

  if (lower.includes('title') || lower.includes('titre')) {
    const score = html.hasTitle
      ? (html.titleLength > 10 && html.titleLength <= 70 ? 100 : html.titleLength > 70 ? 60 : 50)
      : 0
    return { score, raw: { hasTitle: html.hasTitle, titleLength: html.titleLength, titleContent: html.titleContent } }
  }

  if (lower.includes('meta desc') || lower.includes('meta_desc') || lower.includes('description')) {
    const score = html.hasMetaDesc
      ? (html.metaDescLength >= 120 && html.metaDescLength <= 160 ? 100 : html.metaDescLength > 50 ? 70 : 40)
      : 0
    return { score, raw: { hasMetaDesc: html.hasMetaDesc, metaDescLength: html.metaDescLength } }
  }

  if (/\bh1\b/.test(lower)) {
    const score = html.h1Count === 1 ? 100 : html.h1Count === 0 ? 0 : 40
    return { score, raw: { h1Count: html.h1Count, h1Contents: html.h1Contents } }
  }

  if (/\bh2\b/.test(lower)) {
    const score = html.h2Count >= 3 ? 100 : html.h2Count >= 1 ? 60 : 0
    return { score, raw: { h2Count: html.h2Count } }
  }

  if (/\bh3\b/.test(lower)) {
    const score = html.h3Count >= 2 ? 100 : html.h3Count >= 1 ? 60 : 0
    return { score, raw: { h3Count: html.h3Count } }
  }

  if (lower.includes('canonical')) {
    return { score: html.hasCanonical ? 100 : 0, raw: { hasCanonical: html.hasCanonical, canonicalUrl: html.canonicalUrl } }
  }

  if (lower.includes('hreflang')) {
    return { score: html.hasHreflang ? 100 : 0, raw: { hasHreflang: html.hasHreflang } }
  }

  if (lower.includes('viewport')) {
    return { score: html.hasViewport ? 100 : 0, raw: { hasViewport: html.hasViewport } }
  }

  if (lower.includes('alt') && (lower.includes('img') || lower.includes('image'))) {
    if (html.imagesTotal === 0) return { score: 100, raw: { imagesTotal: 0 } }
    const ratio = 1 - (html.imagesMissingAlt / html.imagesTotal)
    return { score: Math.round(ratio * 100), raw: { imagesTotal: html.imagesTotal, imagesMissingAlt: html.imagesMissingAlt } }
  }

  if (lower.includes('og:') || lower.includes('open graph')) {
    return { score: html.hasOg ? (html.ogTags.length >= 4 ? 100 : 60) : 0, raw: { hasOg: html.hasOg, ogTags: html.ogTags } }
  }

  if (lower.includes('twitter')) {
    return { score: html.hasTwitterCards ? 100 : 0, raw: { hasTwitterCards: html.hasTwitterCards } }
  }

  if (lower.includes('author') || lower.includes('auteur')) {
    return { score: html.hasAuthorBio ? 80 : (html.hasAuthorInJsonLd ? 60 : 0), raw: { hasAuthorBio: html.hasAuthorBio, hasAuthorInJsonLd: html.hasAuthorInJsonLd } }
  }

  if (lower.includes('lang') || lower.includes('langue')) {
    return { score: html.hasLang ? 100 : 0, raw: { hasLang: html.hasLang, langValue: html.langValue } }
  }

  if (lower.includes('charset') || lower.includes('encoding')) {
    return { score: html.hasCharset ? 100 : 0, raw: { hasCharset: html.hasCharset } }
  }

  // Generic balise — aggregate title + meta + h1
  const s = (html.hasTitle ? 30 : 0) + (html.hasMetaDesc ? 30 : 0) + (html.h1Count === 1 ? 40 : 0)
  return { score: s, raw: { hasTitle: html.hasTitle, hasMetaDesc: html.hasMetaDesc, h1Count: html.h1Count } }
}

function computeStructuredDataScore(prompt: string, html: HtmlData, robots: RobotsData, sitemap: SitemapData, llmsTxt: { exists: boolean }): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()

  if (lower.includes('robots')) {
    const score = robots.exists
      ? (robots.permissive ? 100 : 50)
      : 0
    return { score, raw: { exists: robots.exists, permissive: robots.permissive, allowsGPTBot: robots.allowsGPTBot, allowsClaudeBot: robots.allowsClaudeBot } }
  }

  if (lower.includes('sitemap')) {
    const score = sitemap.exists
      ? (sitemap.containsMainUrl ? 100 : 70)
      : 0
    return { score, raw: { exists: sitemap.exists, urlCount: sitemap.urlCount, containsMainUrl: sitemap.containsMainUrl } }
  }

  if (lower.includes('llms.txt') || lower.includes('llms txt')) {
    return { score: llmsTxt.exists ? 100 : 0, raw: { exists: llmsTxt.exists } }
  }

  if (lower.includes('organization') || lower.includes('organisation')) {
    return { score: html.schemaEntities.hasOrganization ? 100 : 0, raw: { hasOrganization: html.schemaEntities.hasOrganization } }
  }

  if (lower.includes('faqpage') || (lower.includes('faq') && lower.includes('schema'))) {
    return { score: html.schemaEntities.hasFAQPage ? 100 : 0, raw: { hasFAQPage: html.schemaEntities.hasFAQPage } }
  }

  if (lower.includes('breadcrumb') || lower.includes('fil d')) {
    return { score: html.schemaEntities.hasBreadcrumb ? 100 : 0, raw: { hasBreadcrumb: html.schemaEntities.hasBreadcrumb } }
  }

  if (lower.includes('article')) {
    return { score: html.schemaEntities.hasArticle ? 100 : 0, raw: { hasArticle: html.schemaEntities.hasArticle } }
  }

  if (lower.includes('product') || lower.includes('produit')) {
    return { score: html.schemaEntities.hasProduct ? 100 : 0, raw: { hasProduct: html.schemaEntities.hasProduct } }
  }

  if (lower.includes('sameas') || lower.includes('same_as') || lower.includes('knowledge graph')) {
    return { score: html.hasSameAs ? 100 : 0, raw: { hasSameAs: html.hasSameAs } }
  }

  if (lower.includes('@graph') || lower.includes('graph')) {
    return { score: html.schemaHasGraph ? 100 : 0, raw: { schemaHasGraph: html.schemaHasGraph } }
  }

  // Generic structured data score
  let s = 0
  if (html.hasSchemaOrg) s += 40
  if (html.schemaDepth >= 2) s += 20
  if (html.schemaFieldCount >= 10) s += 20
  if (html.schemaHasGraph) s += 10
  if (html.hasSameAs) s += 10
  return { score: Math.min(100, s), raw: { hasSchemaOrg: html.hasSchemaOrg, schemaTypes: html.schemaTypes, schemaDepth: html.schemaDepth, schemaFieldCount: html.schemaFieldCount } }
}

function computePerformanceScore(prompt: string, psi: PsiData): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()

  if (lower.includes('lcp')) {
    if (psi.lcp === null) return { score: 50, raw: { lcp: null, unavailable: true } }
    const ms = psi.lcp
    const score = ms <= 2500 ? 100 : ms <= 4000 ? 60 : 20
    return { score, raw: { lcp_ms: ms } }
  }

  if (lower.includes('fcp')) {
    if (psi.fcp === null) return { score: 50, raw: { fcp: null, unavailable: true } }
    const ms = psi.fcp
    const score = ms <= 1800 ? 100 : ms <= 3000 ? 60 : 20
    return { score, raw: { fcp_ms: ms } }
  }

  if (lower.includes('cls')) {
    if (psi.cls === null) return { score: 50, raw: { cls: null, unavailable: true } }
    const score = psi.cls <= 0.1 ? 100 : psi.cls <= 0.25 ? 60 : 20
    return { score, raw: { cls: psi.cls } }
  }

  if (lower.includes('tbt') || lower.includes('total blocking')) {
    if (psi.tbt === null) return { score: 50, raw: { tbt: null, unavailable: true } }
    const score = psi.tbt <= 200 ? 100 : psi.tbt <= 600 ? 60 : 20
    return { score, raw: { tbt_ms: psi.tbt } }
  }

  // Generic performance
  return { score: psi.performance ?? 50, raw: { performance: psi.performance, seo: psi.seo } }
}

function computeSecurityScore(prompt: string, html: HtmlData): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()

  if (lower.includes('https') || lower.includes('ssl') || lower.includes('tls')) {
    return { score: html.isHttps ? 100 : 0, raw: { isHttps: html.isHttps } }
  }

  if (lower.includes('hsts')) {
    // We don't have HSTS data in our simplified analysis
    return { score: html.isHttps ? 70 : 0, raw: { isHttps: html.isHttps, note: 'HSTS check requires HTTP headers' } }
  }

  // Generic security
  return { score: html.isHttps ? 80 : 0, raw: { isHttps: html.isHttps } }
}

function computeCombinedScore(prompt: string, html: HtmlData, robots: RobotsData, sitemap: SitemapData, psi: PsiData): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()

  if (lower.includes('maillage') || lower.includes('internal link') || lower.includes('liens internes')) {
    const count = html.internalLinksCount
    const score = count >= 15 ? 100 : count >= 10 ? 80 : count >= 5 ? 60 : count >= 3 ? 40 : count > 0 ? 20 : 0
    return { score, raw: { internalLinksCount: count, externalLinksCount: html.externalLinksCount } }
  }

  if (lower.includes('liens externes') || lower.includes('external link')) {
    const score = html.externalLinksCount >= 3 ? 100 : html.externalLinksCount >= 1 ? 60 : 0
    return { score, raw: { externalLinksCount: html.externalLinksCount } }
  }

  if (lower.includes('e-e-a-t') || lower.includes('eeat') || lower.includes('expertise')) {
    let s = 0
    if (html.hasAuthorBio) s += 30
    if (html.hasAuthorInJsonLd) s += 20
    if (html.hasSocialLinks) s += 15
    if (html.hasLinkedInLinks) s += 15
    if (html.hasCaseStudies) s += 20
    return { score: Math.min(100, s), raw: { hasAuthorBio: html.hasAuthorBio, hasLinkedInLinks: html.hasLinkedInLinks, hasCaseStudies: html.hasCaseStudies } }
  }

  if (lower.includes('fraîcheur') || lower.includes('freshness') || lower.includes('date')) {
    if (html.contentAgeDays === null) return { score: html.dateSignalsCount > 0 ? 30 : 0, raw: { dateSignalsCount: html.dateSignalsCount, noDate: true } }
    const score = html.contentAgeDays <= 30 ? 100 : html.contentAgeDays <= 90 ? 80 : html.contentAgeDays <= 365 ? 50 : 20
    return { score, raw: { contentAgeDays: html.contentAgeDays, mostRecentDate: html.mostRecentDate } }
  }

  if (lower.includes('densité') || lower.includes('data density') || lower.includes('données chiffrées')) {
    return { score: html.dataDensityScore, raw: { dataDensityScore: html.dataDensityScore, statisticCount: html.statisticCount, percentageCount: html.percentageCount } }
  }

  if (lower.includes('faq')) {
    const score = html.hasFAQWithSchema ? 100 : html.hasFAQSection ? 50 : 0
    return { score, raw: { hasFAQSection: html.hasFAQSection, hasFAQWithSchema: html.hasFAQWithSchema } }
  }

  if (lower.includes('contenu') || lower.includes('content') || lower.includes('word') || lower.includes('mot')) {
    const score = html.wordCount >= 1500 ? 100 : html.wordCount >= 800 ? 80 : html.wordCount >= 500 ? 60 : html.wordCount >= 200 ? 30 : 0
    return { score, raw: { wordCount: html.wordCount } }
  }

  if (lower.includes('social') || lower.includes('linkedin')) {
    let s = 0
    if (html.hasSocialLinks) s += 50
    if (html.hasLinkedInLinks) s += 50
    return { score: s, raw: { hasSocialLinks: html.hasSocialLinks, hasLinkedInLinks: html.hasLinkedInLinks } }
  }

  if (lower.includes('tldr') || lower.includes('résumé') || lower.includes('summary')) {
    return { score: html.hasTLDR ? 100 : 0, raw: { hasTLDR: html.hasTLDR } }
  }

  if (lower.includes('tableau') || lower.includes('table')) {
    const score = html.tableCount >= 2 ? 100 : html.tableCount >= 1 ? 60 : 0
    return { score, raw: { tableCount: html.tableCount } }
  }

  if (lower.includes('liste') || lower.includes('list')) {
    const score = html.listCount >= 3 ? 100 : html.listCount >= 1 ? 60 : 0
    return { score, raw: { listCount: html.listCount } }
  }

  if (lower.includes('case study') || lower.includes('étude de cas')) {
    return { score: html.hasCaseStudies ? 100 : 0, raw: { hasCaseStudies: html.hasCaseStudies } }
  }

  // Generic combined: overall score
  let total = 0, maxPts = 0
  // Title + Meta + H1
  total += (html.hasTitle ? 10 : 0) + (html.hasMetaDesc ? 10 : 0) + (html.h1Count === 1 ? 10 : 0); maxPts += 30
  // Schema
  total += (html.hasSchemaOrg ? 15 : 0); maxPts += 15
  // Robots + Sitemap
  total += (robots.exists && robots.permissive ? 10 : 0) + (sitemap.exists ? 10 : 0); maxPts += 20
  // Performance
  total += (psi.performance != null ? Math.round(psi.performance * 0.15) : 8); maxPts += 15
  // Content
  total += (html.wordCount >= 500 ? 10 : html.wordCount >= 200 ? 5 : 0); maxPts += 10
  // Security
  total += (html.isHttps ? 10 : 0); maxPts += 10

  return { score: maxPts > 0 ? Math.round(total / maxPts * 100) : 50, raw: { total, maxPts, components: 'generic_combined' } }
}

/* ================================================================== */
/*  LLM prompt evaluation                                              */
/* ================================================================== */

async function evaluateWithLlm(prompt: string, url: string, htmlSummary: string, llmName: string, retryCount = 0): Promise<{ score: number; raw: Record<string, any> }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) return { score: 50, raw: { error: 'No API key', note: 'LLM evaluation unavailable' } }

  const MAX_RETRIES = 2
  const RETRY_DELAYS = [2000, 5000] // exponential backoff

  try {
    const systemPrompt = `Tu es un expert SEO. On te donne une URL et un extrait du contenu HTML. Tu dois évaluer un critère SEO spécifique et retourner un score de 0 à 100.

Réponds UNIQUEMENT avec un JSON: {"score": <number>, "justification": "<string courte>"}`

    const userPrompt = `URL: ${url}

EXTRAIT HTML (contenu principal):
${htmlSummary}

CRITÈRE À ÉVALUER:
${prompt}

Score de 0 à 100 pour ce critère:`

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: llmName || 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      const status = resp.status
      await resp.text()

      // Retry on 429 rate limit with exponential backoff
      if (status === 429 && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || 5000
        console.log(`[audit-matrice] LLM 429 rate-limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, delay))
        return evaluateWithLlm(prompt, url, htmlSummary, llmName, retryCount + 1)
      }

      // Retry on 500/502/503 server errors
      if (status >= 500 && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || 5000
        console.log(`[audit-matrice] LLM ${status} server error, retrying in ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
        return evaluateWithLlm(prompt, url, htmlSummary, llmName, retryCount + 1)
      }

      if (status === 402) return { score: 50, raw: { error: 'Payment required', status: 402 } }
      return { score: 50, raw: { error: `API error ${status}`, retries: retryCount } }
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Track usage
    trackTokenUsage('audit-matrice', llmName || 'google/gemini-2.5-flash', data.usage, url)

    // Parse JSON response
    let jsonContent = content
    if (content.includes('```json')) jsonContent = content.split('```json')[1].split('```')[0].trim()
    else if (content.includes('```')) jsonContent = content.split('```')[1].split('```')[0].trim()

    try {
      const parsed = JSON.parse(jsonContent)
      const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 50)))
      return { score, raw: { llm_response: parsed, model: llmName } }
    } catch {
      // Try to extract just a number
      const numMatch = content.match(/(\d{1,3})/)
      if (numMatch) return { score: Math.min(100, parseInt(numMatch[1])), raw: { llm_raw: content.substring(0, 200), model: llmName } }
      return { score: 50, raw: { llm_raw: content.substring(0, 200), parse_error: true } }
    }
  } catch (e) {
    // Retry on timeout/network errors
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 5000
      console.log(`[audit-matrice] LLM error "${e instanceof Error ? e.message : 'unknown'}", retrying in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      return evaluateWithLlm(prompt, url, htmlSummary, llmName, retryCount + 1)
    }
    return { score: 50, raw: { error: e instanceof Error ? e.message : 'Unknown error', retries: retryCount } }
  }
}

/* ================================================================== */
/*  Main handler                                                       */
/* ================================================================== */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const clientIp = getClientIp(req)
  const ipCheck = checkIpRate(clientIp, 'audit-matrice', 20, 60_000)
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs)

  if (!acquireConcurrency('audit-matrice', 100)) return concurrencyResponse(corsHeaders)

  try {
    const { url, items } = await req.json() as { url: string; items: ItemInput[] }

    if (!url || !items || items.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'url and items[] required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Normalize URL
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`
    assertSafeUrl(normalizedUrl)

    console.log(`[audit-matrice] Starting for ${normalizedUrl} with ${items.length} items`)

    // Determine which data sources we need
    const detectedTypes = items.map(item => ({
      ...item,
      _type: (item.type as ItemType) || detectItemType(item.prompt, item.llm_name),
    }))

    const needsHtml = detectedTypes.some(i => ['balise', 'structured_data', 'metric_combinee', 'prompt'].includes(i._type))
    const needsRobots = detectedTypes.some(i => ['structured_data', 'metric_combinee'].includes(i._type))
    const needsSitemap = detectedTypes.some(i => ['structured_data', 'metric_combinee'].includes(i._type))
    const needsLlmsTxt = detectedTypes.some(i => i._type === 'structured_data' && /llms/i.test(i.prompt))
    const needsPsi = detectedTypes.some(i => ['performance', 'metric_combinee'].includes(i._type))

    // Fetch all needed data in parallel
    const [htmlResult, robotsData, sitemapData, llmsTxtData, psiData] = await Promise.all([
      needsHtml ? fetchAndRenderPage(normalizedUrl, { timeout: 15000 }).catch(e => {
        console.error('[audit-matrice] HTML fetch error:', e)
        return null
      }) : null,
      needsRobots ? checkRobots(normalizedUrl) : { exists: false, permissive: false, content: '', allowsGPTBot: true, allowsClaudeBot: true, allowsPerplexityBot: true } as RobotsData,
      needsSitemap ? checkSitemap(normalizedUrl) : { exists: false, urlCount: 0, containsMainUrl: false } as SitemapData,
      needsLlmsTxt ? checkLlmsTxt(normalizedUrl) : { exists: false, content: '' },
      needsPsi ? fetchPsi(normalizedUrl) : { performance: null, seo: null, lcp: null, fcp: null, cls: null, tbt: null } as PsiData,
    ])

    let html = htmlResult?.html || ''

    // SPA fallback: if HTML is too short or looks like a shell, try Firecrawl
    const visibleText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (needsHtml && visibleText.length < 200) {
      console.log(`[audit-matrice] HTML too short (${visibleText.length} chars), trying Firecrawl fallback`)
      try {
        const fcKey = Deno.env.get('FIRECRAWL_API_KEY')
        if (fcKey) {
          const fcResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: normalizedUrl, formats: ['html'], waitFor: 3000 }),
            signal: AbortSignal.timeout(20000),
          })
          if (fcResp.ok) {
            const fcData = await fcResp.json()
            const fcHtml = fcData?.data?.html || fcData?.html || ''
            if (fcHtml.length > html.length) {
              html = fcHtml
              console.log(`[audit-matrice] Firecrawl fallback success: ${fcHtml.length} chars`)
            }
          } else {
            await fcResp.text()
          }
        }
      } catch (e) {
        console.error('[audit-matrice] Firecrawl fallback error:', e)
      }
    }

    const htmlData = html ? analyzeHtmlFull(html, normalizedUrl) : null

    // Build smart HTML summary for LLM: extract head + main content, up to 8000 chars
    const buildHtmlSummary = (rawHtml: string): string => {
      if (!rawHtml) return ''
      // Extract <head> meta info (title, meta, schema)
      const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
      const headContent = headMatch ? headMatch[1]
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<link[^>]*stylesheet[^>]*>/gi, '')
        .trim()
        .substring(0, 1500) : ''

      // Extract body visible text  
      const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      const bodyHtml = bodyMatch ? bodyMatch[1] : rawHtml
      const cleanBody = bodyHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '[NAV]')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '[FOOTER]')
        .substring(0, 6500)

      return `<head>${headContent}</head>\n<body>${cleanBody}</body>`
    }

    const htmlSummary = buildHtmlSummary(html)
    const llmPromises: Promise<void>[] = []

    for (const item of detectedTypes) {
      // Always queue LLM evaluation for parsed_score
      const llmPromise = evaluateWithLlm(
        item.prompt, normalizedUrl, htmlSummary,
        item.llm_name || 'google/gemini-2.5-flash'
      )

      if (item._type === 'prompt') {
        // Pure prompt items: both scores come from LLM
        llmPromises.push((async () => {
          const { score, raw } = await llmPromise
          results.push({
            id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
            detected_type: 'prompt', crawlers_score: score, parsed_score: score,
            raw_data: raw, parsed_raw: raw,
            seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
          })
        })())
        continue
      }

      if (!htmlData) {
        llmPromises.push((async () => {
          const { score: pScore, raw: pRaw } = await llmPromise
          results.push({
            id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
            detected_type: item._type, crawlers_score: 0, parsed_score: pScore,
            raw_data: { error: 'HTML fetch failed' }, parsed_raw: pRaw,
            seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
          })
        })())
        continue
      }

      // Compute Crawlers engine score
      let score: number
      let raw: Record<string, any>

      switch (item._type) {
        case 'balise':
          ({ score, raw } = computeBaliseScore(item.prompt, htmlData))
          break
        case 'structured_data':
          ({ score, raw } = computeStructuredDataScore(item.prompt, htmlData, robotsData, sitemapData, llmsTxtData))
          break
        case 'performance':
          ({ score, raw } = computePerformanceScore(item.prompt, psiData))
          break
        case 'security':
          ({ score, raw } = computeSecurityScore(item.prompt, htmlData))
          break
        case 'metric_combinee':
        default:
          ({ score, raw } = computeCombinedScore(item.prompt, htmlData, robotsData, sitemapData, psiData))
          break
      }

      const engineScore = score
      const engineRaw = raw

      // Queue LLM parsed_score in parallel
      llmPromises.push((async () => {
        const { score: pScore, raw: pRaw } = await llmPromise
        results.push({
          id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
          detected_type: item._type, crawlers_score: engineScore, parsed_score: pScore,
          raw_data: engineRaw, parsed_raw: pRaw,
          seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
        })
      })())
    }

    // Wait for all LLM evaluations
    if (llmPromises.length > 0) {
      await Promise.all(llmPromises)
    }

    // Sort results to match input order
    const orderedResults = items.map(item => results.find(r => r.id === item.id)!)

    // Calculate global weighted score
    const totalWeight = orderedResults.reduce((s, r) => s + r.poids, 0)
    const globalScore = totalWeight > 0
      ? Math.round(orderedResults.reduce((s, r) => s + r.crawlers_score * r.poids, 0) / totalWeight)
      : 0

    console.log(`[audit-matrice] Complete. Global score: ${globalScore}/100 (${orderedResults.length} items)`)

    return new Response(JSON.stringify({
      success: true,
      url: normalizedUrl,
      global_score: globalScore,
      total_items: orderedResults.length,
      results: orderedResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('[audit-matrice] Error:', e)
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } finally {
    releaseConcurrency('audit-matrice')
  }
})
