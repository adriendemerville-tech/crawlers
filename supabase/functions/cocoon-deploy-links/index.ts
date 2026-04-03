import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { verifyInjectionOwnership } from '../_shared/ownershipCheck.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

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
    }));

    if (!ownershipCheck.allowed) {
      return jsonError(ownershipCheck.reason || 'Forbidden', 403)
    }

    const domain = site.domain?.replace(/^www\./, '') || ''
    const isIktracker = domain.includes('iktracker')
    const isCrawlers = domain.includes('crawlers')

    let deployResult: unknown

    if (isIktracker) {
      // ── Path 1: IKtracker API ──
      deployResult = await deployViaIktracker(supabase, recommendations, mode)
    } else {
      // ── Path 2: site_script_rules (widget injection) ──
      deployResult = await deployViaSiteRules(supabase, site, user.id, recommendations, mode)
    }

    // Log the action
    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'cocoon:deploy_links',
      event_data: {
        tracked_site_id,
        domain,
        path: isIktracker ? 'iktracker' : 'site_rules',
        mode,
        count: recommendations.length,
      },
    })

    return jsonOk({ success: true, path: isIktracker ? 'iktracker' : 'site_rules', mode, result: deployResult })
  } catch (error) {
    console.error('[cocoon-deploy-links] Error:', error)
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
})

// ── IKtracker deployment ──
async function deployViaIktracker(
  supabase: ReturnType<typeof getServiceClient>,
  recommendations: LinkRecommendation[],
  mode: string
) {
  const IKTRACKER_BASE_URL = 'https://yarjaudctshlxkatqgeb.supabase.co/functions/v1/blog-api'
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
          // Add internal link at first mention of a relevant keyword or at end of content
          const linkHtml = `<a href="${rec.target_url}" title="${rec.anchor_text}">${rec.anchor_text}</a>`
          // Try to find anchor text in content and wrap it
          const anchorRegex = new RegExp(`(?<!<a[^>]*>)\\b(${escapeRegex(rec.anchor_text)})\\b(?![^<]*<\\/a>)`, 'i')
          if (anchorRegex.test(content)) {
            content = content.replace(anchorRegex, linkHtml)
          } else {
            // Append as a related link at end
            content += `\n<p>→ ${linkHtml}</p>`
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