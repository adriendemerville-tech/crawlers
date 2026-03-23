import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { verifyInjectionOwnership } from '../_shared/ownershipCheck.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { checkIpRate, getClientIp, rateLimitResponse } from '../_shared/ipRateLimiter.ts'

/**
 * cocoon-batch-deploy
 *
 * Orchestrateur de maillage interne en masse pour un cluster/silo entier.
 * 
 * Modes :
 *   - dry_run   : calcule le graphe optimal, retourne preview sans modifier
 *   - deploy    : applique les liens via CMS API ou site_script_rules
 *   - rollback  : restaure le contenu original depuis pages_backup
 *
 * Payload :
 *   { tracked_site_id, cluster_id?, node_ids?, mode: 'dry_run'|'deploy'|'rollback', batch_operation_id? }
 */

interface LinkRecommendation {
  source_url: string
  source_node_id: string
  target_url: string
  target_node_id: string
  anchor_text: string
  action: 'add_link' | 'update_anchor' | 'remove_link'
  score: number
}

interface PageBackup {
  url: string
  post_id?: number
  original_content: string
  platform: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const ip = getClientIp(req)
  const rateCheck = checkIpRate(ip, 'cocoon-batch-deploy', 5, 60_000)
  if (!rateCheck.allowed) return rateLimitResponse(corsHeaders, rateCheck.retryAfterMs)

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = getUserClient(authHeader)
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json()
    const { tracked_site_id, cluster_id, node_ids, mode = 'dry_run', batch_operation_id } = body

    if (!tracked_site_id) {
      return json({ error: 'tracked_site_id required' }, 400)
    }

    const supabase = getServiceClient()

    // ── Rollback shortcut ──
    if (mode === 'rollback' && batch_operation_id) {
      return await handleRollback(supabase, user.id, batch_operation_id)
    }

    // ── Fetch site ──
    const { data: site, error: siteError } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id')
      .eq('id', tracked_site_id)
      .single()

    if (siteError || !site) {
      return json({ error: 'Site not found' }, 404)
    }

    // ── Ownership check ──
    const ownership = await verifyInjectionOwnership(supabase, user.id, tracked_site_id, {
      scriptType: 'cocoon_batch',
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
    })
    if (!ownership.allowed) {
      return json({ error: ownership.reason || 'Forbidden' }, 403)
    }

    // ── Fetch semantic nodes for cluster ──
    let nodesQuery = supabase
      .from('semantic_nodes' as any)
      .select('id, url, title, intent, cluster_id, similarity_edges, internal_links_in, internal_links_out, page_authority, geo_score, content_gap_score')
      .eq('tracked_site_id', tracked_site_id)
      .eq('user_id', user.id)

    if (node_ids && Array.isArray(node_ids) && node_ids.length > 0) {
      nodesQuery = nodesQuery.in('id', node_ids)
    } else if (cluster_id) {
      nodesQuery = nodesQuery.eq('cluster_id', cluster_id)
    }

    const { data: nodes, error: nodesError } = await nodesQuery.limit(100)

    if (nodesError || !nodes || nodes.length < 2) {
      return json({ error: 'Need at least 2 semantic nodes to compute maillage' }, 400)
    }

    // ── Compute optimal link graph ──
    const recommendations = computeOptimalLinks(nodes as any[])

    if (recommendations.length === 0) {
      return json({ success: true, mode, message: 'No link changes needed', recommendations: [] })
    }

    // ── Dry run: return preview ──
    if (mode === 'dry_run') {
      // Create batch operation record
      const { data: batchOp } = await supabase
        .from('cocoon_batch_operations' as any)
        .insert({
          user_id: user.id,
          tracked_site_id,
          domain: site.domain,
          cluster_id: cluster_id || null,
          operation_type: 'batch_deploy',
          mode: 'dry_run',
          status: 'preview',
          total_pages: new Set(recommendations.map(r => r.source_url)).size,
          recommendations: recommendations,
        })
        .select('id')
        .single()

      return json({
        success: true,
        mode: 'dry_run',
        batch_operation_id: batchOp?.id,
        total_links: recommendations.length,
        total_pages: new Set(recommendations.map(r => r.source_url)).size,
        recommendations,
        graph_summary: buildGraphSummary(nodes as any[], recommendations),
      })
    }

    // ── Deploy mode ──
    // Check for CMS connection
    const { data: cmsConn } = await supabase
      .from('cms_connections')
      .select('*')
      .eq('tracked_site_id', tracked_site_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const deployMethod = cmsConn ? `cms:${cmsConn.platform}` : 'widget'

    // Create or update batch operation
    let batchOpId = batch_operation_id
    if (batchOpId) {
      await supabase
        .from('cocoon_batch_operations' as any)
        .update({
          mode: 'deploy',
          status: 'in_progress',
          started_at: new Date().toISOString(),
          recommendations,
        })
        .eq('id', batchOpId)
        .eq('user_id', user.id)
    } else {
      const { data: newOp } = await supabase
        .from('cocoon_batch_operations' as any)
        .insert({
          user_id: user.id,
          tracked_site_id,
          domain: site.domain,
          cluster_id: cluster_id || null,
          operation_type: 'batch_deploy',
          mode: 'deploy',
          status: 'in_progress',
          total_pages: new Set(recommendations.map(r => r.source_url)).size,
          recommendations,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      batchOpId = newOp?.id
    }

    let results: any
    let pagesBackup: PageBackup[] = []

    if (cmsConn) {
      const deployResult = await deployViaCms(supabase, cmsConn, recommendations)
      results = deployResult.results
      pagesBackup = deployResult.backups
    } else {
      results = await deployViaWidget(supabase, site, user.id, recommendations)
    }

    const failedCount = results.filter((r: any) => r.status === 'error').length

    // Update batch operation with results
    await supabase
      .from('cocoon_batch_operations' as any)
      .update({
        status: failedCount > 0 ? 'partial' : 'completed',
        processed_pages: results.length - failedCount,
        failed_pages: failedCount,
        deploy_results: results,
        pages_backup: pagesBackup.length > 0 ? pagesBackup : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchOpId)

    // Log analytics
    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'cocoon:batch_deploy',
      event_data: {
        tracked_site_id,
        cluster_id,
        deploy_method: deployMethod,
        total_links: recommendations.length,
        total_pages: results.length,
        failed: failedCount,
      },
    })

    return json({
      success: true,
      mode: 'deploy',
      batch_operation_id: batchOpId,
      deploy_method: deployMethod,
      total_links: recommendations.length,
      total_pages: results.length,
      failed_pages: failedCount,
      can_rollback: pagesBackup.length > 0,
      results,
    })
  } catch (error) {
    console.error('[cocoon-batch-deploy] Error:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// ── Helper: JSON response ──
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Compute optimal internal links using PageRank + semantic proximity ──
function computeOptimalLinks(nodes: any[]): LinkRecommendation[] {
  const recommendations: LinkRecommendation[] = []
  const existingLinks = new Set<string>()

  // Map existing links
  for (const node of nodes) {
    const edges = node.similarity_edges || []
    for (const edge of edges) {
      existingLinks.add(`${node.url}→${edge.target_url}`)
    }
  }

  // Build URL → node map
  const nodeByUrl = new Map(nodes.map(n => [n.url, n]))

  // For each pair, check if a link should exist based on semantic proximity
  for (const source of nodes) {
    const sourceEdges = source.similarity_edges || []

    for (const edge of sourceEdges) {
      const target = nodeByUrl.get(edge.target_url)
      if (!target) continue

      const linkKey = `${source.url}→${target.url}`
      const score = edge.score || 0

      // High similarity but no existing internal link → recommend adding
      if (score >= 0.3 && !hasExistingInternalLink(source, target.url)) {
        // Generate anchor from target title
        const anchor = generateAnchor(target.title, target.intent)
        recommendations.push({
          source_url: source.url,
          source_node_id: source.id,
          target_url: target.url,
          target_node_id: target.id,
          anchor_text: anchor,
          action: 'add_link',
          score,
        })
      }
    }
  }

  // Sort by score descending, limit to avoid over-linking
  recommendations.sort((a, b) => b.score - a.score)

  // Max 3 new links per page to avoid stuffing
  const linksPerPage = new Map<string, number>()
  return recommendations.filter(rec => {
    const count = linksPerPage.get(rec.source_url) || 0
    if (count >= 3) return false
    linksPerPage.set(rec.source_url, count + 1)
    return true
  })
}

function hasExistingInternalLink(node: any, targetUrl: string): boolean {
  // Check internal_links_out if available
  const outLinks = node.internal_links_out || 0
  // We can't check exact targets from count alone, rely on similarity_edges
  const edges = node.similarity_edges || []
  return edges.some((e: any) => e.target_url === targetUrl && e.type === 'internal_link')
}

function generateAnchor(title: string, intent: string): string {
  if (!title) return 'En savoir plus'
  // Use first meaningful segment of title (before | or -)
  const clean = title.split(/[|–—-]/)[0].trim()
  // Limit to ~60 chars
  if (clean.length <= 60) return clean
  return clean.substring(0, 57) + '...'
}

// ── Deploy via CMS API (WordPress, Shopify, Drupal) ──
async function deployViaCms(
  supabase: any,
  conn: any,
  recommendations: LinkRecommendation[]
): Promise<{ results: any[], backups: PageBackup[] }> {
  const results: any[] = []
  const backups: PageBackup[] = []

  // Group by source page
  const bySource = groupBySource(recommendations)

  for (const [sourceUrl, recs] of bySource) {
    try {
      if (conn.platform === 'wordpress') {
        const result = await deployToWordPress(conn, sourceUrl, recs, backups)
        results.push(result)
      } else {
        // Fallback for non-WordPress CMS: use widget injection
        results.push({ url: sourceUrl, status: 'skipped', detail: `CMS ${conn.platform} batch not yet supported` })
      }
    } catch (e) {
      results.push({ url: sourceUrl, status: 'error', detail: e instanceof Error ? e.message : 'Unknown' })
    }
  }

  return { results, backups }
}

async function deployToWordPress(
  conn: any,
  sourceUrl: string,
  recs: LinkRecommendation[],
  backups: PageBackup[]
): Promise<any> {
  const wpUrl = conn.site_url.replace(/\/$/, '')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (conn.auth_method === 'basic' && conn.basic_auth_user && conn.basic_auth_pass) {
    headers['Authorization'] = 'Basic ' + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`)
  } else if (conn.api_key) {
    headers['Authorization'] = `Bearer ${conn.api_key}`
  }

  // Find the post by URL slug
  const slug = extractSlug(sourceUrl)
  if (!slug) {
    return { url: sourceUrl, status: 'error', detail: 'Cannot extract slug' }
  }

  // Search for the post
  const searchResp = await fetch(`${wpUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=id,content,title`, {
    headers,
  })

  if (!searchResp.ok) {
    const errText = await searchResp.text()
    return { url: sourceUrl, status: 'error', detail: `WP search failed [${searchResp.status}]: ${errText.substring(0, 200)}` }
  }

  const posts = await searchResp.json()
  
  // Try pages if no post found
  let post = posts[0]
  if (!post) {
    const pageResp = await fetch(`${wpUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=id,content,title`, {
      headers,
    })
    if (pageResp.ok) {
      const pages = await pageResp.json()
      post = pages[0]
    }
  }

  if (!post) {
    return { url: sourceUrl, status: 'error', detail: 'Post/page not found in WordPress' }
  }

  const originalContent = post.content?.rendered || post.content?.raw || ''

  // Backup original content
  backups.push({
    url: sourceUrl,
    post_id: post.id,
    original_content: originalContent,
    platform: 'wordpress',
  })

  // Apply link modifications
  let content = originalContent
  let appliedCount = 0

  for (const rec of recs) {
    if (rec.action === 'add_link') {
      const linkHtml = `<a href="${rec.target_url}" title="${rec.anchor_text}">${rec.anchor_text}</a>`
      const anchorRegex = new RegExp(`(?<!<a[^>]*>)\\b(${escapeRegex(rec.anchor_text)})\\b(?![^<]*<\\/a>)`, 'i')
      if (anchorRegex.test(content)) {
        content = content.replace(anchorRegex, linkHtml)
        appliedCount++
      }
    } else if (rec.action === 'update_anchor') {
      const linkRegex = new RegExp(`<a([^>]*href=["']${escapeRegex(rec.target_url)}["'][^>]*)>[^<]*</a>`, 'gi')
      const before = content
      content = content.replace(linkRegex, `<a$1>${rec.anchor_text}</a>`)
      if (content !== before) appliedCount++
    } else if (rec.action === 'remove_link') {
      const linkRegex = new RegExp(`<a[^>]*href=["']${escapeRegex(rec.target_url)}["'][^>]*>([^<]*)</a>`, 'gi')
      const before = content
      content = content.replace(linkRegex, '$1')
      if (content !== before) appliedCount++
    }
  }

  if (appliedCount === 0) {
    return { url: sourceUrl, status: 'skipped', detail: 'No anchor text matches found in content' }
  }

  // Update the post
  const postType = post.type === 'page' ? 'pages' : 'posts'
  const updateResp = await fetch(`${wpUrl}/wp-json/wp/v2/${postType}/${post.id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  })

  if (!updateResp.ok) {
    const errText = await updateResp.text()
    return { url: sourceUrl, status: 'error', detail: `WP update failed [${updateResp.status}]: ${errText.substring(0, 200)}` }
  }

  await updateResp.text() // consume body

  return {
    url: sourceUrl,
    post_id: post.id,
    status: 'deployed',
    detail: `${appliedCount}/${recs.length} links applied`,
  }
}

// ── Deploy via widget injection (site_script_rules) ──
async function deployViaWidget(
  supabase: any,
  site: { id: string; domain: string },
  userId: string,
  recommendations: LinkRecommendation[]
): Promise<any[]> {
  const results: any[] = []
  const bySource = groupBySource(recommendations)

  for (const [sourceUrl, recs] of bySource) {
    const linksPayload = recs.map(r => ({
      source: r.source_url,
      target: r.target_url,
      anchor: r.anchor_text,
      action: r.action,
    }))

    const injectionScript = generateLinkInjectionScript(linksPayload)

    // Upsert rule for this source URL
    const urlPattern = new URL(sourceUrl).pathname

    const { data: existing } = await supabase
      .from('site_script_rules')
      .select('id')
      .eq('domain_id', site.id)
      .eq('user_id', userId)
      .eq('payload_type', 'COCOON_BATCH_LINKS')
      .eq('url_pattern', urlPattern)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('site_script_rules')
        .update({
          payload_data: { script: injectionScript, links: linksPayload },
          is_active: true,
        } as any)
        .eq('id', existing.id)
    } else {
      await supabase
        .from('site_script_rules')
        .insert({
          domain_id: site.id,
          user_id: userId,
          url_pattern: urlPattern,
          payload_type: 'COCOON_BATCH_LINKS',
          payload_data: { script: injectionScript, links: linksPayload },
          is_active: true,
          source: 'cocoon_batch',
        } as any)
    }

    results.push({
      url: sourceUrl,
      status: 'deployed',
      detail: `${recs.length} links injected via widget`,
    })
  }

  return results
}

// ── Rollback handler ──
async function handleRollback(supabase: any, userId: string, batchOpId: string) {
  const { data: op, error } = await supabase
    .from('cocoon_batch_operations' as any)
    .select('*')
    .eq('id', batchOpId)
    .eq('user_id', userId)
    .single()

  if (error || !op) {
    return json({ error: 'Batch operation not found' }, 404)
  }

  if (op.rolled_back_at) {
    return json({ error: 'Already rolled back' }, 400)
  }

  const backups: PageBackup[] = op.pages_backup || []
  if (backups.length === 0) {
    // Widget-based: deactivate rules
    const recommendations = op.recommendations || []
    const sourceUrls = [...new Set(recommendations.map((r: any) => r.source_url))]

    for (const url of sourceUrls) {
      try {
        const urlPattern = new URL(url).pathname
        await supabase
          .from('site_script_rules')
          .update({ is_active: false } as any)
          .eq('domain_id', op.tracked_site_id)
          .eq('user_id', userId)
          .eq('payload_type', 'COCOON_BATCH_LINKS')
          .eq('url_pattern', urlPattern)
      } catch { /* continue */ }
    }

    await supabase
      .from('cocoon_batch_operations' as any)
      .update({ status: 'rolled_back', rolled_back_at: new Date().toISOString() })
      .eq('id', batchOpId)

    return json({ success: true, method: 'widget_deactivated', pages: sourceUrls.length })
  }

  // CMS rollback: restore original content
  const { data: cmsConn } = await supabase
    .from('cms_connections')
    .select('*')
    .eq('tracked_site_id', op.tracked_site_id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (!cmsConn) {
    return json({ error: 'CMS connection no longer active, cannot rollback' }, 400)
  }

  const rollbackResults: any[] = []

  for (const backup of backups) {
    try {
      if (backup.platform === 'wordpress' && backup.post_id) {
        const wpUrl = cmsConn.site_url.replace(/\/$/, '')
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }

        if (cmsConn.auth_method === 'basic' && cmsConn.basic_auth_user && cmsConn.basic_auth_pass) {
          headers['Authorization'] = 'Basic ' + btoa(`${cmsConn.basic_auth_user}:${cmsConn.basic_auth_pass}`)
        } else if (cmsConn.api_key) {
          headers['Authorization'] = `Bearer ${cmsConn.api_key}`
        }

        const resp = await fetch(`${wpUrl}/wp-json/wp/v2/posts/${backup.post_id}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ content: backup.original_content }),
        })

        await resp.text()
        rollbackResults.push({ url: backup.url, status: resp.ok ? 'restored' : 'error' })
      }
    } catch (e) {
      rollbackResults.push({ url: backup.url, status: 'error', detail: e instanceof Error ? e.message : 'Unknown' })
    }
  }

  await supabase
    .from('cocoon_batch_operations' as any)
    .update({ status: 'rolled_back', rolled_back_at: new Date().toISOString() })
    .eq('id', batchOpId)

  return json({ success: true, method: 'cms_restored', results: rollbackResults })
}

// ── Build graph summary for dry_run preview ──
function buildGraphSummary(nodes: any[], recommendations: LinkRecommendation[]) {
  const sourcePages = new Set(recommendations.map(r => r.source_url))
  const targetPages = new Set(recommendations.map(r => r.target_url))

  return {
    total_nodes: nodes.length,
    pages_modified: sourcePages.size,
    pages_targeted: targetPages.size,
    links_added: recommendations.filter(r => r.action === 'add_link').length,
    links_updated: recommendations.filter(r => r.action === 'update_anchor').length,
    links_removed: recommendations.filter(r => r.action === 'remove_link').length,
    avg_score: Math.round(recommendations.reduce((s, r) => s + r.score, 0) / recommendations.length * 100) / 100,
  }
}

// ── Utilities ──
function groupBySource(recommendations: LinkRecommendation[]): Map<string, LinkRecommendation[]> {
  const map = new Map<string, LinkRecommendation[]>()
  for (const rec of recommendations) {
    if (!map.has(rec.source_url)) map.set(rec.source_url, [])
    map.get(rec.source_url)!.push(rec)
  }
  return map
}

function extractSlug(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch { return null }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function generateLinkInjectionScript(links: Array<{ source: string; target: string; anchor: string; action: string }>): string {
  return [
    '(function(){',
    '"use strict";',
    'var links=' + JSON.stringify(links) + ';',
    'var cp=window.location.pathname;',
    'links.forEach(function(l){',
    'try{',
    'var sp=new URL(l.source,window.location.origin).pathname;',
    'if(sp!==cp)return;',
    'if(l.action==="add_link"){',
    'var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false);',
    'var n;var re=new RegExp(l.anchor.replace(/[.*+?^${}()|[\\\\]\\\\\\\\]/g,"\\\\\\\\$&"),"i");',
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
