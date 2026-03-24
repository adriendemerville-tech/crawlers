/* ================================================================== */
/*  Scoring functions for audit-matrice                                */
/* ================================================================== */

import type { HtmlData } from './matriceHtmlAnalysis.ts'

export interface RobotsData {
  exists: boolean; permissive: boolean; content: string
  allowsGPTBot: boolean; allowsClaudeBot: boolean; allowsPerplexityBot: boolean
}

export interface SitemapData {
  exists: boolean; urlCount: number; containsMainUrl: boolean
}

export interface PsiData {
  performance: number | null; seo: number | null
  lcp: number | null; fcp: number | null; cls: number | null; tbt: number | null
}

export async function checkRobots(url: string): Promise<RobotsData> {
  const result: RobotsData = { exists: false, permissive: false, content: '', allowsGPTBot: true, allowsClaudeBot: true, allowsPerplexityBot: true }
  try {
    const origin = new URL(url).origin
    const resp = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return result
    const content = await resp.text()
    result.exists = true
    result.content = content.substring(0, 2000)
    result.permissive = !content.includes('Disallow: /')
    if (/user-agent:\s*gptbot[\s\S]*?disallow:\s*\//im.test(content)) result.allowsGPTBot = false
    if (/user-agent:\s*claudebot[\s\S]*?disallow:\s*\//im.test(content)) result.allowsClaudeBot = false
    if (/user-agent:\s*perplexitybot[\s\S]*?disallow:\s*\//im.test(content)) result.allowsPerplexityBot = false
  } catch {}
  return result
}

export async function checkSitemap(url: string): Promise<SitemapData> {
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

export async function checkLlmsTxt(url: string): Promise<{ exists: boolean; content: string }> {
  try {
    const origin = new URL(url).origin
    const resp = await fetch(`${origin}/llms.txt`, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return { exists: false, content: '' }
    const content = await resp.text()
    return { exists: content.length > 10, content: content.substring(0, 500) }
  } catch { return { exists: false, content: '' } }
}

export async function fetchPsi(url: string): Promise<PsiData> {
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

export function computeBaliseScore(prompt: string, html: HtmlData): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()

  if (lower.includes('title') || lower.includes('titre')) {
    const score = html.hasTitle ? (html.titleLength > 10 && html.titleLength <= 70 ? 100 : html.titleLength > 70 ? 60 : 50) : 0
    return { score, raw: { hasTitle: html.hasTitle, titleLength: html.titleLength, titleContent: html.titleContent } }
  }
  if (lower.includes('meta desc') || lower.includes('meta_desc') || lower.includes('description')) {
    const score = html.hasMetaDesc ? (html.metaDescLength >= 120 && html.metaDescLength <= 160 ? 100 : html.metaDescLength > 50 ? 70 : 40) : 0
    return { score, raw: { hasMetaDesc: html.hasMetaDesc, metaDescLength: html.metaDescLength } }
  }
  if (/\bh1\b/.test(lower)) {
    const score = html.h1Count === 1 ? 100 : html.h1Count === 0 ? 0 : 40
    return { score, raw: { h1Count: html.h1Count, h1Contents: html.h1Contents } }
  }
  if (/\bh2\b/.test(lower)) return { score: html.h2Count >= 3 ? 100 : html.h2Count >= 1 ? 60 : 0, raw: { h2Count: html.h2Count } }
  if (/\bh3\b/.test(lower)) return { score: html.h3Count >= 2 ? 100 : html.h3Count >= 1 ? 60 : 0, raw: { h3Count: html.h3Count } }
  if (lower.includes('canonical')) return { score: html.hasCanonical ? 100 : 0, raw: { hasCanonical: html.hasCanonical, canonicalUrl: html.canonicalUrl } }
  if (lower.includes('hreflang')) return { score: html.hasHreflang ? 100 : 0, raw: { hasHreflang: html.hasHreflang } }
  if (lower.includes('viewport')) return { score: html.hasViewport ? 100 : 0, raw: { hasViewport: html.hasViewport } }
  if (lower.includes('alt') && (lower.includes('img') || lower.includes('image'))) {
    if (html.imagesTotal === 0) return { score: 100, raw: { imagesTotal: 0 } }
    const ratio = 1 - (html.imagesMissingAlt / html.imagesTotal)
    return { score: Math.round(ratio * 100), raw: { imagesTotal: html.imagesTotal, imagesMissingAlt: html.imagesMissingAlt } }
  }
  if (lower.includes('og:') || lower.includes('open graph')) return { score: html.hasOg ? (html.ogTags.length >= 4 ? 100 : 60) : 0, raw: { hasOg: html.hasOg, ogTags: html.ogTags } }
  if (lower.includes('twitter')) return { score: html.hasTwitterCards ? 100 : 0, raw: { hasTwitterCards: html.hasTwitterCards } }
  if (lower.includes('author') || lower.includes('auteur')) return { score: html.hasAuthorBio ? 80 : (html.hasAuthorInJsonLd ? 60 : 0), raw: { hasAuthorBio: html.hasAuthorBio, hasAuthorInJsonLd: html.hasAuthorInJsonLd } }
  if (lower.includes('lang') || lower.includes('langue')) return { score: html.hasLang ? 100 : 0, raw: { hasLang: html.hasLang, langValue: html.langValue } }
  if (lower.includes('charset') || lower.includes('encoding')) return { score: html.hasCharset ? 100 : 0, raw: { hasCharset: html.hasCharset } }

  const s = (html.hasTitle ? 30 : 0) + (html.hasMetaDesc ? 30 : 0) + (html.h1Count === 1 ? 40 : 0)
  return { score: s, raw: { hasTitle: html.hasTitle, hasMetaDesc: html.hasMetaDesc, h1Count: html.h1Count } }
}

export function computeStructuredDataScore(prompt: string, html: HtmlData, robots: RobotsData, sitemap: SitemapData, llmsTxt: { exists: boolean }): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()
  if (lower.includes('robots')) {
    const score = robots.exists ? (robots.permissive ? 100 : 50) : 0
    return { score, raw: { exists: robots.exists, permissive: robots.permissive, allowsGPTBot: robots.allowsGPTBot, allowsClaudeBot: robots.allowsClaudeBot } }
  }
  if (lower.includes('sitemap')) {
    const score = sitemap.exists ? (sitemap.containsMainUrl ? 100 : 70) : 0
    return { score, raw: { exists: sitemap.exists, urlCount: sitemap.urlCount, containsMainUrl: sitemap.containsMainUrl } }
  }
  if (lower.includes('llms.txt') || lower.includes('llms txt')) return { score: llmsTxt.exists ? 100 : 0, raw: { exists: llmsTxt.exists } }
  if (lower.includes('organization') || lower.includes('organisation')) return { score: html.schemaEntities.hasOrganization ? 100 : 0, raw: { hasOrganization: html.schemaEntities.hasOrganization } }
  if (lower.includes('faqpage') || (lower.includes('faq') && lower.includes('schema'))) return { score: html.schemaEntities.hasFAQPage ? 100 : 0, raw: { hasFAQPage: html.schemaEntities.hasFAQPage } }
  if (lower.includes('breadcrumb') || lower.includes('fil d')) return { score: html.schemaEntities.hasBreadcrumb ? 100 : 0, raw: { hasBreadcrumb: html.schemaEntities.hasBreadcrumb } }
  if (lower.includes('article')) return { score: html.schemaEntities.hasArticle ? 100 : 0, raw: { hasArticle: html.schemaEntities.hasArticle } }
  if (lower.includes('product') || lower.includes('produit')) return { score: html.schemaEntities.hasProduct ? 100 : 0, raw: { hasProduct: html.schemaEntities.hasProduct } }
  if (lower.includes('sameas') || lower.includes('same_as') || lower.includes('knowledge graph')) return { score: html.hasSameAs ? 100 : 0, raw: { hasSameAs: html.hasSameAs } }
  if (lower.includes('@graph') || lower.includes('graph')) return { score: html.schemaHasGraph ? 100 : 0, raw: { schemaHasGraph: html.schemaHasGraph } }

  let s = 0
  if (html.hasSchemaOrg) s += 40
  if (html.schemaDepth >= 2) s += 20
  if (html.schemaFieldCount >= 10) s += 20
  if (html.schemaHasGraph) s += 10
  if (html.hasSameAs) s += 10
  return { score: Math.min(100, s), raw: { hasSchemaOrg: html.hasSchemaOrg, schemaTypes: html.schemaTypes, schemaDepth: html.schemaDepth, schemaFieldCount: html.schemaFieldCount } }
}

export function computePerformanceScore(prompt: string, psi: PsiData): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()
  if (lower.includes('lcp')) {
    if (psi.lcp === null) return { score: 50, raw: { lcp: null, unavailable: true } }
    return { score: psi.lcp <= 2500 ? 100 : psi.lcp <= 4000 ? 60 : 20, raw: { lcp_ms: psi.lcp } }
  }
  if (lower.includes('fcp')) {
    if (psi.fcp === null) return { score: 50, raw: { fcp: null, unavailable: true } }
    return { score: psi.fcp <= 1800 ? 100 : psi.fcp <= 3000 ? 60 : 20, raw: { fcp_ms: psi.fcp } }
  }
  if (lower.includes('cls')) {
    if (psi.cls === null) return { score: 50, raw: { cls: null, unavailable: true } }
    return { score: psi.cls <= 0.1 ? 100 : psi.cls <= 0.25 ? 60 : 20, raw: { cls: psi.cls } }
  }
  if (lower.includes('tbt') || lower.includes('total blocking')) {
    if (psi.tbt === null) return { score: 50, raw: { tbt: null, unavailable: true } }
    return { score: psi.tbt <= 200 ? 100 : psi.tbt <= 600 ? 60 : 20, raw: { tbt_ms: psi.tbt } }
  }
  return { score: psi.performance ?? 50, raw: { performance: psi.performance, seo: psi.seo } }
}

export function computeSecurityScore(prompt: string, html: HtmlData): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()
  if (lower.includes('https') || lower.includes('ssl') || lower.includes('tls')) return { score: html.isHttps ? 100 : 0, raw: { isHttps: html.isHttps } }
  if (lower.includes('hsts')) return { score: html.isHttps ? 70 : 0, raw: { isHttps: html.isHttps, note: 'HSTS check requires HTTP headers' } }
  return { score: html.isHttps ? 80 : 0, raw: { isHttps: html.isHttps } }
}

export function computeCombinedScore(prompt: string, html: HtmlData, robots: RobotsData, sitemap: SitemapData, psi: PsiData): { score: number; raw: Record<string, any> } {
  const lower = prompt.toLowerCase()

  if (lower.includes('maillage') || lower.includes('internal link') || lower.includes('liens internes')) {
    const count = html.internalLinksCount
    return { score: count >= 15 ? 100 : count >= 10 ? 80 : count >= 5 ? 60 : count >= 3 ? 40 : count > 0 ? 20 : 0, raw: { internalLinksCount: count, externalLinksCount: html.externalLinksCount } }
  }
  if (lower.includes('liens externes') || lower.includes('external link')) return { score: html.externalLinksCount >= 3 ? 100 : html.externalLinksCount >= 1 ? 60 : 0, raw: { externalLinksCount: html.externalLinksCount } }
  if (lower.includes('e-e-a-t') || lower.includes('eeat') || lower.includes('expertise')) {
    let s = 0
    if (html.hasAuthorBio) s += 30; if (html.hasAuthorInJsonLd) s += 20; if (html.hasSocialLinks) s += 15; if (html.hasLinkedInLinks) s += 15; if (html.hasCaseStudies) s += 20
    return { score: Math.min(100, s), raw: { hasAuthorBio: html.hasAuthorBio, hasLinkedInLinks: html.hasLinkedInLinks, hasCaseStudies: html.hasCaseStudies } }
  }
  if (lower.includes('fraîcheur') || lower.includes('freshness') || lower.includes('date')) {
    if (html.contentAgeDays === null) return { score: html.dateSignalsCount > 0 ? 30 : 0, raw: { dateSignalsCount: html.dateSignalsCount, noDate: true } }
    return { score: html.contentAgeDays <= 30 ? 100 : html.contentAgeDays <= 90 ? 80 : html.contentAgeDays <= 365 ? 50 : 20, raw: { contentAgeDays: html.contentAgeDays, mostRecentDate: html.mostRecentDate } }
  }
  if (lower.includes('densité') || lower.includes('data density') || lower.includes('données chiffrées')) return { score: html.dataDensityScore, raw: { dataDensityScore: html.dataDensityScore, statisticCount: html.statisticCount, percentageCount: html.percentageCount } }
  if (lower.includes('faq')) return { score: html.hasFAQWithSchema ? 100 : html.hasFAQSection ? 50 : 0, raw: { hasFAQSection: html.hasFAQSection, hasFAQWithSchema: html.hasFAQWithSchema } }
  if (lower.includes('contenu') || lower.includes('content') || lower.includes('word') || lower.includes('mot')) return { score: html.wordCount >= 1500 ? 100 : html.wordCount >= 800 ? 80 : html.wordCount >= 500 ? 60 : html.wordCount >= 200 ? 30 : 0, raw: { wordCount: html.wordCount } }
  if (lower.includes('social') || lower.includes('linkedin')) {
    let s = 0; if (html.hasSocialLinks) s += 50; if (html.hasLinkedInLinks) s += 50
    return { score: s, raw: { hasSocialLinks: html.hasSocialLinks, hasLinkedInLinks: html.hasLinkedInLinks } }
  }
  if (lower.includes('tldr') || lower.includes('résumé') || lower.includes('summary')) return { score: html.hasTLDR ? 100 : 0, raw: { hasTLDR: html.hasTLDR } }
  if (lower.includes('tableau') || lower.includes('table')) return { score: html.tableCount >= 2 ? 100 : html.tableCount >= 1 ? 60 : 0, raw: { tableCount: html.tableCount } }
  if (lower.includes('liste') || lower.includes('list')) return { score: html.listCount >= 3 ? 100 : html.listCount >= 1 ? 60 : 0, raw: { listCount: html.listCount } }
  if (lower.includes('case study') || lower.includes('étude de cas')) return { score: html.hasCaseStudies ? 100 : 0, raw: { hasCaseStudies: html.hasCaseStudies } }

  let total = 0, maxPts = 0
  total += (html.hasTitle ? 10 : 0) + (html.hasMetaDesc ? 10 : 0) + (html.h1Count === 1 ? 10 : 0); maxPts += 30
  total += (html.hasSchemaOrg ? 15 : 0); maxPts += 15
  total += (robots.exists && robots.permissive ? 10 : 0) + (sitemap.exists ? 10 : 0); maxPts += 20
  total += (psi.performance != null ? Math.round(psi.performance * 0.15) : 8); maxPts += 15
  total += (html.wordCount >= 500 ? 10 : html.wordCount >= 200 ? 5 : 0); maxPts += 10
  total += (html.isHttps ? 10 : 0); maxPts += 10
  return { score: maxPts > 0 ? Math.round(total / maxPts * 100) : 50, raw: { total, maxPts, components: 'generic_combined' } }
}
