import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { verifyInjectionOwnership } from '../_shared/ownershipCheck.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { isIktrackerDomain, IKTRACKER_BASE_URL } from '../_shared/domainUtils.ts';
import { callLovableAI, isLovableAIConfigured } from '../_shared/lovableAI.ts';

/**
 * cocoon-deploy-links
 * 
 * Déploie les recommandations de maillage interne du Cocoon sur le site cible.
 * Deux chemins :
 *   1. IKtracker → via le bridge iktracker-actions (CRUD articles/pages)
 *   2. Widget/WordPress → via site_script_rules (injection JS)
 *
 * Payload attendu :
 *   { tracked_site_id, recommendations: LinkRecommendation[], mode?: 'preview' | 'deploy' }
 *
 * LinkRecommendation : { source_url, target_url, anchor_text, action: 'add_link' | 'update_anchor' | 'remove_link' }
 */

interface LinkRecommendation {
  source_url: string
  target_url: string
  anchor_text: string
  context_sentence?: string
  action: 'add_link' | 'update_anchor' | 'remove_link'
}

Deno.serve(handleRequest(async (req) => {
try {
    // Auth
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = getUserClient(authHeader)
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return jsonError('Unauthorized', 401)
    }

    const { tracked_site_id, recommendations, mode = 'deploy' } = await req.json()

    if (!tracked_site_id || !Array.isArray(recommendations) || recommendations.length === 0) {
      return jsonError('tracked_site_id and recommendations[] required', 400)
    }

    const supabase = getServiceClient()

    // Fetch site info
    const { data: site, error: siteError } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id, current_config')
      .eq('id', tracked_site_id)
      .single()

    if (siteError || !site) {
      return jsonError('Site not found', 404)
    }

    // Security: verify ownership (cross-reference user vs site owner)
    const ownershipCheck = await verifyInjectionOwnership(supabase, user.id, tracked_site_id, {
      scriptType: 'cocoon_links',
      payloadPreview: JSON.stringify(recommendations.slice(0, 3)),
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || undefined,
    });

    if (!ownershipCheck.allowed) {
      return jsonError(ownershipCheck.reason || 'Forbidden', 403)
    }

    const domain = site.domain?.replace(/^www\./, '') || ''
    const isIktracker = isIktrackerDomain(domain)

    // ── Priority 1: connected CMS (cms_connections) → universal route via cms-patch-content
    const { data: cmsConn } = await supabase
      .from('cms_connections')
      .select('id, platform, status')
      .eq('tracked_site_id', tracked_site_id)
      .eq('status', 'connected')
      .maybeSingle()

    let deployResult: unknown
    let path: 'cms_connection' | 'iktracker' | 'site_rules'

    if (cmsConn) {
      path = 'cms_connection'
      deployResult = await deployViaCmsPatch(authHeader, tracked_site_id, recommendations, mode)
    } else if (isIktracker) {
      path = 'iktracker'
      deployResult = await deployViaIktracker(supabase, recommendations, mode)
    } else {
      path = 'site_rules'
      deployResult = await deployViaSiteRules(supabase, site, user.id, recommendations, mode)
    }

    // Log the action
    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'cocoon:deploy_links',
      event_data: {
        tracked_site_id,
        domain,
        path,
        platform: cmsConn?.platform || (isIktracker ? 'iktracker' : 'widget'),
        mode,
        count: recommendations.length,
      },
    })

    return jsonOk({ success: true, path, mode, result: deployResult })
  } catch (error) {
    console.error('[cocoon-deploy-links] Error:', error)
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
}));

// ── IKtracker deployment ──
async function deployViaIktracker(
  supabase: ReturnType<typeof getServiceClient>,
  recommendations: LinkRecommendation[],
  mode: string
) {
  // IKTRACKER_BASE_URL imported from _shared/domainUtils.ts
  const apiKey = Deno.env.get('IKTRACKER_API_KEY')
  if (!apiKey) throw new Error('IKTRACKER_API_KEY not configured')

  const results: Array<{ url: string; status: string; detail?: string }> = []

  // Group recommendations by source_url (page to modify)
  const bySource = new Map<string, LinkRecommendation[]>()
  for (const rec of recommendations) {
    const key = rec.source_url
    if (!bySource.has(key)) bySource.set(key, [])
    bySource.get(key)!.push(rec)
  }

  for (const [sourceUrl, recs] of bySource) {
    // Extract slug from URL
    const slug = extractSlug(sourceUrl)
    if (!slug) {
      results.push({ url: sourceUrl, status: 'skipped', detail: 'Cannot extract slug' })
      continue
    }

    try {
      // Fetch current post content
      const getResp = await fetch(`${IKTRACKER_BASE_URL}/posts/${slug}`, {
        headers: { 'x-api-key': apiKey },
      })

      if (!getResp.ok) {
        results.push({ url: sourceUrl, status: 'error', detail: `GET failed: ${getResp.status}` })
        continue
      }

      const post = await getResp.json()
      let content = post.content || ''

      if (mode === 'preview') {
        results.push({ url: sourceUrl, status: 'preview', detail: `${recs.length} links to inject` })
        continue
      }

      // Apply link modifications to content
      for (const rec of recs) {
        if (rec.action === 'add_link') {
          const linkHtml = `<a href="${rec.target_url}" title="${rec.anchor_text}">${rec.anchor_text}</a>`
          const anchorRegex = new RegExp(`(?<!<a[^>]*>)\\b(${escapeRegex(rec.anchor_text)})\\b(?![^<]*<\\/a>)`, 'i')

          if (anchorRegex.test(content)) {
            // ── Best case: anchor text exists in content → wrap it
            content = content.replace(anchorRegex, linkHtml)
          } else if (rec.context_sentence) {
            // ── Good case: use the AI-generated context_sentence from bulk-auto-linking
            // Insert the context sentence (with link) before the last </p> or at end
            const sentenceWithLink = rec.context_sentence.replace(
              new RegExp(`(${escapeRegex(rec.anchor_text)})`, 'i'),
              linkHtml
            )
            // If the context sentence doesn't contain the anchor, embed the link directly
            const finalSentence = sentenceWithLink.includes('<a href=')
              ? sentenceWithLink
              : `${rec.context_sentence} ${linkHtml}`
            content = insertBeforeLastParagraph(content, `<p>${finalSentence}</p>`)
          } else {
            // ── Fallback: generate a natural bridge sentence via AI
            const bridgeSentence = await generateBridgeSentence(content, rec)
            if (bridgeSentence) {
              content = insertBeforeLastParagraph(content, `<p>${bridgeSentence}</p>`)
            } else {
              // Last resort: simple contextual sentence (no AI available)
              content = insertBeforeLastParagraph(
                content,
                `<p>Pour aller plus loin, consultez notre ressource sur ${linkHtml}.</p>`
              )
            }
          }
        } else if (rec.action === 'update_anchor') {
          // Find existing link to target and update anchor text
          const linkRegex = new RegExp(`<a([^>]*href=["']${escapeRegex(rec.target_url)}["'][^>]*)>[^<]*</a>`, 'gi')
          content = content.replace(linkRegex, `<a$1>${rec.anchor_text}</a>`)
        } else if (rec.action === 'remove_link') {
          // Remove link but keep text
          const linkRegex = new RegExp(`<a[^>]*href=["']${escapeRegex(rec.target_url)}["'][^>]*>([^<]*)</a>`, 'gi')
          content = content.replace(linkRegex, '$1')
        }
      }

      // Update post via IKtracker API
      const updateResp = await fetch(`${IKTRACKER_BASE_URL}/posts/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ content }),
      })

      results.push({
        url: sourceUrl,
        status: updateResp.ok ? 'deployed' : 'error',
        detail: updateResp.ok ? `${recs.length} links applied` : `PUT failed: ${updateResp.status}`,
      })
    } catch (e) {
      results.push({ url: sourceUrl, status: 'error', detail: e instanceof Error ? e.message : 'Unknown error' })
    }
  }

  return { pages_processed: results.length, results }
}

// ── Site Script Rules deployment (widget.js / WP plugin) ──
async function deployViaSiteRules(
  supabase: ReturnType<typeof getServiceClient>,
  site: { id: string; domain: string },
  userId: string,
  recommendations: LinkRecommendation[],
  mode: string
) {
  if (mode === 'preview') {
    return { preview: true, rules_count: recommendations.length }
  }

  // Build injection script from recommendations
  const linksPayload = recommendations.map(rec => ({
    source: rec.source_url,
    target: rec.target_url,
    anchor: rec.anchor_text,
    action: rec.action,
  }))

  const injectionScript = generateLinkInjectionScript(linksPayload)

  // Check if a COCOON_LINKS rule already exists
  const { data: existingRule } = await supabase
    .from('site_script_rules')
    .select('id')
    .eq('domain_id', site.id)
    .eq('user_id', userId)
    .eq('payload_type', 'COCOON_LINKS')
    .maybeSingle()

  if (existingRule) {
    await supabase
      .from('site_script_rules')
      .update({
        payload_data: { script: injectionScript, links: linksPayload },
        is_active: true,
      } as any)
      .eq('id', existingRule.id)
  } else {
    await supabase
      .from('site_script_rules')
      .insert({
        domain_id: site.id,
        user_id: userId,
        url_pattern: '*',
        payload_type: 'COCOON_LINKS',
        payload_data: { script: injectionScript, links: linksPayload },
        is_active: true,
        source: 'cocoon',
      } as any)
  }

  return { deployed: true, rules_count: recommendations.length }
}

// Generate vanilla JS that injects internal links
function generateLinkInjectionScript(links: Array<{ source: string; target: string; anchor: string; action: string }>): string {
  const escFn = 'function esc(s){return s.replace(/[.*+?^${}()|[\\\\]\\\\\\\\]/g,"\\\\\\\\$&")}'
  return [
    '(function(){',
    '"use strict";',
    escFn + ';',
    'var links=' + JSON.stringify(links) + ';',
    'var cp=window.location.pathname;',
    'links.forEach(function(l){',
    'try{',
    'var sp=new URL(l.source,window.location.origin).pathname;',
    'if(sp!==cp)return;',
    'if(l.action==="add_link"){',
    'var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false);',
    'var n;var re=new RegExp(esc(l.anchor),"i");',
    'while(n=w.nextNode()){',
    'if(n.parentElement&&n.parentElement.tagName==="A")continue;',
    'if(re.test(n.textContent||"")){',
    'var s=document.createElement("span");',
    's.innerHTML=(n.textContent||"").replace(re,\'<a href="\'+l.target+\'" style="color:inherit;text-decoration:underline">\'+l.anchor+"</a>");',
    'n.parentNode.replaceChild(s,n);break;',
    '}}}',
    '}catch(e){}',
    '});',
    '})();',
  ].join('\n')
}

function extractSlug(url: string): string | null {
  try {
    const path = new URL(url).pathname
    const parts = path.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Insert HTML before the last </p> in content, or append at end.
 * This places the bridge sentence in the conclusion area rather than after it.
 */
function insertBeforeLastParagraph(content: string, html: string): string {
  const lastPIdx = content.lastIndexOf('</p>')
  if (lastPIdx > 0) {
    // Insert before the last paragraph's closing tag (i.e., before the conclusion)
    const insertPoint = content.lastIndexOf('<p', lastPIdx)
    if (insertPoint > 0) {
      return content.slice(0, insertPoint) + html + '\n' + content.slice(insertPoint)
    }
  }
  return content + '\n' + html
}

/**
 * Generate a natural bridge sentence using AI that integrates the anchor text
 * contextually within the article's topic.
 */
async function generateBridgeSentence(
  content: string,
  rec: LinkRecommendation
): Promise<string | null> {
  if (!isLovableAIConfigured()) return null

  // Extract a short excerpt for context (first 500 chars of text)
  const textOnly = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)

  const linkHtml = `<a href="${rec.target_url}" title="${rec.anchor_text}">${rec.anchor_text}</a>`

  try {
    const result = await callLovableAI({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        {
          role: 'system',
          content: `Tu es un rédacteur SEO expert. Génère UNE SEULE phrase de transition naturelle (max 30 mots) qui s'intègre dans un article existant et contient exactement le texte d'ancre fourni. La phrase doit être informative, pas promotionnelle. Réponds UNIQUEMENT avec la phrase, sans guillemets ni ponctuation de début.`
        },
        {
          role: 'user',
          content: `Article (extrait) : "${textOnly}"\n\nTexte d'ancre à intégrer : "${rec.anchor_text}"\nURL cible : ${rec.target_url}\n\nGénère une phrase de transition naturelle contenant ce texte d'ancre.`
        }
      ],
      temperature: 0.7,
      max_tokens: 100,
    })

    const sentence = result.choices?.[0]?.message?.content?.trim()
    if (!sentence || sentence.length < 10 || sentence.length > 200) return null

    // Replace anchor text with the actual link HTML
    const anchorRegex = new RegExp(`(${escapeRegex(rec.anchor_text)})`, 'i')
    if (anchorRegex.test(sentence)) {
      return sentence.replace(anchorRegex, linkHtml)
    }
    return `${sentence} ${linkHtml}`
  } catch (e) {
    console.warn('[cocoon-deploy-links] AI bridge sentence failed:', e)
    return null
  }
}