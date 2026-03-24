/* ================================================================== */
/*  HTML analysis for audit-matrice                                    */
/* ================================================================== */

export interface HtmlData {
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

export function analyzeHtmlFull(html: string, url: string): HtmlData {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const titleContent = titleMatch ? titleMatch[1].trim() : ''

  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)
  const metaDescContent = metaDescMatch ? metaDescMatch[1].trim() : ''

  const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || []
  const h1Contents = h1Matches.map(h => h.replace(/<[^>]*>/g, '').trim()).filter(c => c.length > 0)
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length

  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const wordCount = textContent.split(' ').filter(w => w.length > 2).length

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

  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : ''
  const hasHreflang = /<link[^>]*hreflang/i.test(html)
  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html)

  const ogMatches = html.match(/<meta[^>]*property=["']og:[^"']*["'][^>]*>/gi) || []
  const ogTags = ogMatches.map(m => {
    const p = m.match(/property=["'](og:[^"']*)["']/i)
    return p ? p[1] : ''
  }).filter(Boolean)

  const hasTwitterCards = /<meta[^>]*name=["']twitter:/i.test(html)
  const hasAuthorBio = /(?:author|auteur|écrit par|written by|par\s)/i.test(html) &&
    /(?:bio|profil|linkedin|twitter|expert|spécialiste)/i.test(html)

  const hasFAQSection = /faq|questions? fréquentes|frequently asked/i.test(html)
  const hasFAQWithSchema = hasFAQSection && schemaEntities.hasFAQPage

  const hasTLDR = /tl;?dr|résumé|en bref|key takeaway|points clés/i.test(html.substring(0, 5000))
  const tableCount = (html.match(/<table[\s>]/gi) || []).length
  const listCount = (html.match(/<[uo]l[\s>]/gi) || []).length

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

  const hasLinkedInLinks = /linkedin\.com/i.test(html)
  const hasSocialLinks = /(?:twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|linkedin\.com)/i.test(html)
  const hasCaseStudies = /(?:case study|étude de cas|client|témoignage|testimonial|avant.*après|before.*after)/i.test(html)

  const statisticCount = (textContent.match(/\d+[\s,.]?\d*\s*(%|euros?|€|\$|millions?|milliards?|k\b)/gi) || []).length
  const percentageCount = (textContent.match(/\d+\s*%/g) || []).length
  const dataDensityScore = Math.min(100, Math.round((statisticCount + percentageCount * 2) * 5))

  const dateMetaMatch = html.match(/<meta[^>]*(?:name|property)=["'](?:article:modified_time|og:updated_time|article:published_time|date)["'][^>]*content=["']([^"']*)["']/i)
  let mostRecentDate: string | null = null
  let contentAgeDays: number | null = null
  const dateSignals: string[] = []
  if (dateMetaMatch?.[1]) dateSignals.push(dateMetaMatch[1])
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

  const imgTags = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  const allImages = (imgTags.match(/<img\b[^>]*>/gi) || [])
  const imagesMissingAlt = allImages.filter(img => !/\balt\s*=\s*["'][^"']+["']/i.test(img)).length

  const langMatch = html.match(/<html[^>]*\slang=["']([^"']*)["']/i)
  const hasCharset = /<meta[^>]*charset/i.test(html)
  let isHttps = false
  try { isHttps = new URL(url).protocol === 'https:' } catch {}

  return {
    hasTitle: !!titleContent, titleLength: titleContent.length, titleContent,
    hasMetaDesc: !!metaDescContent, metaDescLength: metaDescContent.length, metaDescContent,
    h1Count: h1Contents.length, h1Contents,
    h2Count, h3Count, wordCount,
    hasSchemaOrg: schemaTypes.length > 0, schemaTypes: [...new Set(schemaTypes)], schemaCount: schemaMatches.length,
    schemaDepth, schemaFieldCount, schemaHasGraph,
    isHttps,
    imagesTotal: allImages.length, imagesMissingAlt,
    hasCanonical: !!canonicalUrl, canonicalUrl,
    hasHreflang, hasViewport,
    hasOg: ogTags.length > 0, ogTags,
    hasTwitterCards, hasAuthorBio,
    hasFAQSection, hasFAQWithSchema,
    hasTLDR, tableCount, listCount,
    internalLinksCount, externalLinksCount,
    hasLinkedInLinks, hasSocialLinks, hasCaseStudies,
    statisticCount, percentageCount, dataDensityScore,
    contentAgeDays, mostRecentDate, dateSignalsCount: dateSignals.length,
    hasLang: !!langMatch, langValue: langMatch?.[1] || '',
    hasCharset,
    schemaEntities, hasSameAs, hasAuthorInJsonLd,
    htmlSize: html.length,
  }
}
