/* ================================================================== */
/*  AUTO-DETECT item type from prompt text (fuzzy + scoring)           */
/* ================================================================== */

export type ItemType = 'balise' | 'structured_data' | 'performance' | 'security' | 'prompt' | 'metric_combinee'

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

export function detectItemType(prompt: string, llmName?: string): ItemType {
  const lower = prompt.toLowerCase().trim()

  if (llmName && llmName !== 'google/gemini-2.5-flash') {
    if (lower.length > 30 || lower.includes('?') || lower.includes('analyse') || lower.includes('évalue')) {
      return 'prompt'
    }
  }

  const scores: TypeScore[] = []
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [ItemType, [string, number][]][]) {
    if (type === 'prompt') continue
    let score = 0
    for (const [kw, weight] of keywords) {
      if (lower.includes(kw)) score += weight
    }
    if (score > 0) scores.push({ type, score })
  }

  scores.sort((a, b) => b.score - a.score)
  if (scores.length > 0 && scores[0].score >= 2) {
    return scores[0].type
  }

  if (lower.length > 50 || lower.includes('?')) return 'prompt'
  return 'metric_combinee'
}
