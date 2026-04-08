/* ================================================================== */
/*  Injection Points — Extracts precise DOM anchors from raw HTML     */
/*  Used by Content Architect, Code Architect & cms-patch-content     */
/* ================================================================== */

export interface InjectionPoints {
  // Heading selectors (CSS-like)
  h1_selector: string | null        // e.g. "h1.entry-title", "h1" or null if absent
  h1_content: string | null         // existing H1 text for replace matching
  h2_selectors: string[]            // e.g. ["h2:nth-of-type(1)", "h2:nth-of-type(2)"]
  h2_contents: string[]             // text of each H2

  // Meta insertion targets
  meta_title_exists: boolean
  meta_description_exists: boolean
  canonical_exists: boolean
  canonical_value: string | null

  // Schema.org
  schema_target: 'head' | 'body'    // where to inject JSON-LD
  schema_existing_types: string[]   // avoid duplication
  schema_count: number

  // Content zones — where to insert new blocks
  faq_insert_before: string | null  // selector before which to inject FAQ
  faq_existing_selector: string | null  // existing FAQ section selector if present

  // Main content container (best guess)
  main_content_selector: string | null  // e.g. "main", "article", ".entry-content", "#content"
  main_content_end_selector: string | null // where to append content

  // Footer reference (for inserting before footer)
  footer_selector: string | null

  // CMS-specific hints
  cms_body_field: string | null     // e.g. "content.rendered" for WP, "body_html" for Shopify
  
  // Images missing alt (first 5 src values for targeting)
  images_missing_alt_srcs: string[]
}

/**
 * Extracts precise injection points from raw HTML.
 * Uses regex-based analysis (no DOM parser needed in Deno edge functions).
 */
export function extractInjectionPoints(html: string, url: string): InjectionPoints {
  // ── H1 ──
  const h1Match = html.match(/<h1([^>]*)>([\s\S]*?)<\/h1>/i)
  let h1_selector: string | null = null
  let h1_content: string | null = null
  if (h1Match) {
    h1_selector = inferSelector('h1', h1Match[1])
    h1_content = h1Match[2].replace(/<[^>]*>/g, '').trim()
  }

  // ── H2s ──
  const h2Regex = /<h2([^>]*)>([\s\S]*?)<\/h2>/gi
  const h2_selectors: string[] = []
  const h2_contents: string[] = []
  let h2Match
  let h2Index = 0
  while ((h2Match = h2Regex.exec(html)) !== null) {
    h2Index++
    const sel = inferSelector('h2', h2Match[1]) || `h2:nth-of-type(${h2Index})`
    h2_selectors.push(sel)
    h2_contents.push(h2Match[2].replace(/<[^>]*>/g, '').trim())
  }

  // ── Meta ──
  const meta_title_exists = /<title[^>]*>[^<]+<\/title>/i.test(html)
  const metaDescRegex = /<meta[^>]*name=["']description["'][^>]*>/i
  const meta_description_exists = metaDescRegex.test(html)
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)
  const canonical_exists = !!canonicalMatch
  const canonical_value = canonicalMatch?.[1] || null

  // ── Schema.org ──
  const schemaInHead = /<head[\s\S]*?<script[^>]*type=["']application\/ld\+json["']/i.test(html)
  const schema_target: 'head' | 'body' = schemaInHead ? 'head' : 'head' // always prefer head
  const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  const schema_existing_types: string[] = []
  for (const sm of schemaMatches) {
    try {
      const json = JSON.parse(sm.replace(/<script[^>]*>|<\/script>/gi, ''))
      const extractTypes = (obj: any) => {
        if (!obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) { obj.forEach(extractTypes); return }
        if (obj['@type']) {
          const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']]
          schema_existing_types.push(...types)
        }
        if (obj['@graph']) extractTypes(obj['@graph'])
      }
      extractTypes(json)
    } catch { /* skip */ }
  }

  // ── Main content container ──
  const main_content_selector = detectMainContainer(html)
  const main_content_end_selector = main_content_selector
    ? `${main_content_selector} > :last-child`
    : null

  // ── FAQ ──
  const faqRegex = /<(?:div|section)[^>]*(?:class|id)=["'][^"']*faq[^"']*["'][^>]*>/i
  const faqMatch = html.match(faqRegex)
  let faq_existing_selector: string | null = null
  let faq_insert_before: string | null = null
  if (faqMatch) {
    const attrs = faqMatch[0]
    const idMatch = attrs.match(/id=["']([^"']*)["']/i)
    const classMatch = attrs.match(/class=["']([^"']*)["']/i)
    if (idMatch) faq_existing_selector = `#${idMatch[1]}`
    else if (classMatch) faq_existing_selector = `.${classMatch[1].split(/\s+/)[0]}`
  }

  // Footer selector for "insert before footer"
  const footer_selector = detectFooter(html)
  if (!faq_existing_selector) {
    // Insert FAQ before footer, or before </main>, or before </article>
    if (footer_selector) faq_insert_before = footer_selector
    else if (/<\/main>/i.test(html)) faq_insert_before = 'main'
    else if (/<\/article>/i.test(html)) faq_insert_before = 'article'
  }

  // ── CMS body field hint ──
  const cms_body_field = detectCmsBodyField(html)

  // ── Images missing alt ──
  const imgRegex = /<img\b([^>]*)>/gi
  const images_missing_alt_srcs: string[] = []
  let imgMatch
  while ((imgMatch = imgRegex.exec(html)) !== null && images_missing_alt_srcs.length < 5) {
    const attrs = imgMatch[1]
    if (!/\balt\s*=\s*["'][^"']+["']/i.test(attrs)) {
      const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i)
      if (srcMatch) images_missing_alt_srcs.push(srcMatch[1])
    }
  }

  return {
    h1_selector,
    h1_content,
    h2_selectors,
    h2_contents,
    meta_title_exists,
    meta_description_exists,
    canonical_exists,
    canonical_value,
    schema_target,
    schema_existing_types: [...new Set(schema_existing_types)],
    schema_count: schemaMatches.length,
    faq_insert_before,
    faq_existing_selector,
    main_content_selector,
    main_content_end_selector,
    footer_selector,
    cms_body_field,
    images_missing_alt_srcs,
  }
}

// ── Helpers ──

function inferSelector(tag: string, attrStr: string): string {
  const idMatch = attrStr.match(/\bid=["']([^"']*)["']/i)
  if (idMatch) return `${tag}#${idMatch[1]}`
  const classMatch = attrStr.match(/\bclass=["']([^"']*)["']/i)
  if (classMatch) {
    const mainClass = classMatch[1].split(/\s+/).filter(c => c.length > 0)[0]
    if (mainClass) return `${tag}.${mainClass}`
  }
  return tag
}

function detectMainContainer(html: string): string | null {
  // Priority order of known main content selectors
  const patterns: [RegExp, string][] = [
    [/<main\b[^>]*>/i, 'main'],
    [/<article\b[^>]*class=["'][^"']*entry-content[^"']*["']/i, 'article.entry-content'],
    [/<div\b[^>]*class=["'][^"']*entry-content[^"']*["']/i, '.entry-content'],
    [/<div\b[^>]*class=["'][^"']*post-content[^"']*["']/i, '.post-content'],
    [/<div\b[^>]*class=["'][^"']*article-content[^"']*["']/i, '.article-content'],
    [/<div\b[^>]*class=["'][^"']*page-content[^"']*["']/i, '.page-content'],
    [/<div\b[^>]*id=["']content["']/i, '#content'],
    [/<div\b[^>]*id=["']main-content["']/i, '#main-content'],
    [/<article\b[^>]*>/i, 'article'],
    [/<div\b[^>]*class=["'][^"']*content[^"']*["']/i, '.content'],
  ]
  for (const [regex, selector] of patterns) {
    if (regex.test(html)) return selector
  }
  return null
}

function detectFooter(html: string): string | null {
  const footerMatch = html.match(/<footer\b([^>]*)>/i)
  if (footerMatch) {
    const idMatch = footerMatch[1].match(/id=["']([^"']*)["']/i)
    if (idMatch) return `footer#${idMatch[1]}`
    const classMatch = footerMatch[1].match(/class=["']([^"']*)["']/i)
    if (classMatch) return `footer.${classMatch[1].split(/\s+/)[0]}`
    return 'footer'
  }
  return null
}

function detectCmsBodyField(html: string): string | null {
  // WordPress
  if (/wp-content|wordpress/i.test(html)) return 'content.rendered'
  // Shopify
  if (/cdn\.shopify\.com|shopify/i.test(html)) return 'body_html'
  // Drupal
  if (/drupal|sites\/default/i.test(html)) return 'body.value'
  // Wix
  if (/wix\.com|wixstatic/i.test(html)) return 'richContent'
  // Webflow
  if (/webflow/i.test(html)) return 'body'
  return null
}

/**
 * Formats injection points as a concise prompt block for LLM context.
 */
export function injectionPointsToPrompt(ip: InjectionPoints): string {
  const lines: string[] = [
    '📍 POINTS D\'INJECTION DÉTECTÉS (coordonnées DOM précises):',
    '',
    `H1: ${ip.h1_selector ? `${ip.h1_selector} → "${ip.h1_content}"` : 'ABSENT — créer dans ' + (ip.main_content_selector || 'body')}`,
    `H2: ${ip.h2_selectors.length} trouvés${ip.h2_contents.length > 0 ? ' → ' + ip.h2_contents.slice(0, 3).map(c => `"${c}"`).join(', ') : ''}`,
    `Meta title: ${ip.meta_title_exists ? 'EXISTE → document.querySelector("title")' : 'ABSENT → créer dans <head>'}`,
    `Meta desc: ${ip.meta_description_exists ? 'EXISTE → document.querySelector(\'meta[name="description"]\')' : 'ABSENT → créer dans <head>'}`,
    `Canonical: ${ip.canonical_exists ? `EXISTE → "${ip.canonical_value}"` : 'ABSENT → créer dans <head>'}`,
    `Schema.org: ${ip.schema_count} blocs existants (${ip.schema_existing_types.join(', ') || 'aucun'}) → injecter dans <${ip.schema_target}>`,
    `FAQ: ${ip.faq_existing_selector ? `EXISTE → "${ip.faq_existing_selector}"` : ip.faq_insert_before ? `ABSENT → insérer avant "${ip.faq_insert_before}"` : 'ABSENT → append dans main content'}`,
    `Contenu principal: ${ip.main_content_selector || 'non détecté'}`,
    `Footer: ${ip.footer_selector || 'non détecté'}`,
    `CMS body field: ${ip.cms_body_field || 'inconnu'}`,
    `Images sans alt: ${ip.images_missing_alt_srcs.length} (${ip.images_missing_alt_srcs.slice(0, 3).join(', ')})`,
    '',
    'RÈGLES STRICTES:',
    `- H1: ${ip.h1_selector ? `remplacer "${ip.h1_selector}", NE PAS en créer un second` : 'créer un seul H1'}`,
    `- Schema: NE PAS dupliquer ${ip.schema_existing_types.join(', ') || 'aucun type'}`,
    `- FAQ: ${ip.faq_existing_selector ? 'enrichir la section existante' : `insérer avant ${ip.faq_insert_before || 'le footer'}`}`,
    `- Contenu: injecter dans ${ip.main_content_selector || 'le body'}, pas en doublon`,
  ]
  return lines.join('\n')
}
