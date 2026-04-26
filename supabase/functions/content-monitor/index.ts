import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * content-monitor
 * 
 * Vérification périodique (cron 12h) que les contenus déployés par
 * Content Architect / Parménion sont toujours en place sur les sites clients.
 * 
 * 3 mécanismes :
 *   1. Vérification périodique — re-fetch chaque page et vérifie title, meta desc, H1, schema.org
 *   2. Alertes proactives — anomaly_alert si un contenu déployé disparaît ou est altéré
 *   3. Hash de contenu — compare le hash du body principal vs snapshot déployé
 */

// ── Utilities ──

async function computeHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content.trim().toLowerCase().replace(/\s+/g, ' '))
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function fetchPageHTML(url: string): Promise<{ html: string; status: number } | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersContentMonitor/1.0)', Accept: 'text/html' },
      signal: ctrl.signal,
      redirect: 'follow',
    })
    clearTimeout(t)
    return { html: await resp.text(), status: resp.status }
  } catch {
    return null
  }
}

// ── HTML element extractors ──

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? m[1].trim() : null
}

function extractMetaDesc(html: string): string | null {
  const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)
  return m ? m[1].trim() : null
}

function extractH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  return m ? m[1].replace(/<[^>]*>/g, '').trim() : null
}

function extractSchemaTypes(html: string): string[] {
  const types: string[] = []
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1])
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type']) {
          const t = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
          types.push(...t)
        }
      }
    } catch { /* invalid JSON-LD */ }
  }
  return [...new Set(types)]
}

async function extractBodyContentHash(html: string): Promise<string | null> {
  // Extract main content area (article, main, or body minus nav/header/footer)
  const mainMatch = html.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i)
  const content = mainMatch ? mainMatch[1] : null
  if (!content || content.length < 50) return null
  // Strip HTML tags, normalize whitespace
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length < 30) return null
  return await computeHash(text)
}

// ── Comparison logic ──

interface ContentCheck {
  changed: string[]
  details: Record<string, { expected: string | null; detected: string | null }>
}

function compareContent(
  snapshot: { deployed_title?: string | null; deployed_meta_desc?: string | null; deployed_h1?: string | null; deployed_schema_types?: string[] | null },
  detected: { title: string | null; metaDesc: string | null; h1: string | null; schemaTypes: string[] }
): ContentCheck {
  const changed: string[] = []
  const details: Record<string, { expected: string | null; detected: string | null }> = {}

  // Normalize for comparison (case-insensitive, trimmed)
  const norm = (s: string | null | undefined) => s?.trim().toLowerCase() || ''

  if (snapshot.deployed_title && norm(snapshot.deployed_title) !== norm(detected.title)) {
    changed.push('title')
    details.title = { expected: snapshot.deployed_title, detected: detected.title }
  }

  if (snapshot.deployed_meta_desc && norm(snapshot.deployed_meta_desc) !== norm(detected.metaDesc)) {
    changed.push('meta_desc')
    details.meta_desc = { expected: snapshot.deployed_meta_desc, detected: detected.metaDesc }
  }

  if (snapshot.deployed_h1 && norm(snapshot.deployed_h1) !== norm(detected.h1)) {
    changed.push('h1')
    details.h1 = { expected: snapshot.deployed_h1, detected: detected.h1 }
  }

  if (snapshot.deployed_schema_types && snapshot.deployed_schema_types.length > 0) {
    const missing = snapshot.deployed_schema_types.filter(t => !detected.schemaTypes.includes(t))
    if (missing.length > 0) {
      changed.push('schema')
      details.schema = { expected: snapshot.deployed_schema_types.join(', '), detected: detected.schemaTypes.join(', ') || null }
    }
  }

  return { changed, details }
}

// ── Main handler ──

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = getServiceClient()

    // 1. Get all active content deploy snapshots
    const { data: snapshots, error: snapErr } = await supabase
      .from('content_deploy_snapshots')
      .select('*')
      .eq('is_active', true)
      .limit(200)

    if (snapErr || !snapshots || snapshots.length === 0) {
      return new Response(JSON.stringify({ message: 'No active content snapshots to monitor', checked: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const monitorLogs: any[] = []
    const alertsToCreate: any[] = []
    const snapshotUpdates: Array<{ id: string; updates: any }> = []

    for (const snap of snapshots) {
      const page = await fetchPageHTML(snap.page_url)

      if (!page) {
        monitorLogs.push({
          tracked_site_id: snap.tracked_site_id,
          user_id: snap.user_id,
          domain: snap.domain,
          url_checked: snap.page_url,
          source_type: snap.source_type,
          source_record_id: snap.source_record_id,
          status: 'fetch_failed',
          details: { error: 'Timeout or unreachable' },
        })
        snapshotUpdates.push({
          id: snap.id,
          updates: {
            last_verified_at: new Date().toISOString(),
            last_verification_status: 'fetch_failed',
            consecutive_failures: (snap.consecutive_failures || 0) + 1,
          },
        })
        continue
      }

      // Extract current page elements
      const detectedTitle = extractTitle(page.html)
      const detectedMetaDesc = extractMetaDesc(page.html)
      const detectedH1 = extractH1(page.html)
      const detectedSchemaTypes = extractSchemaTypes(page.html)
      const detectedContentHash = await extractBodyContentHash(page.html)

      // Compare SEO elements
      const comparison = compareContent(snap, {
        title: detectedTitle,
        metaDesc: detectedMetaDesc,
        h1: detectedH1,
        schemaTypes: detectedSchemaTypes,
      })

      // Check body content hash
      let bodyChanged = false
      if (snap.deployed_content_hash && detectedContentHash && snap.deployed_content_hash !== detectedContentHash) {
        comparison.changed.push('body_content')
        comparison.details.body_content = { expected: snap.deployed_content_hash.substring(0, 16) + '…', detected: detectedContentHash.substring(0, 16) + '…' }
        bodyChanged = true
      }

      const hasChanges = comparison.changed.length > 0
      const status = hasChanges ? 'elements_altered' : 'ok'

      monitorLogs.push({
        tracked_site_id: snap.tracked_site_id,
        user_id: snap.user_id,
        domain: snap.domain,
        url_checked: snap.page_url,
        source_type: snap.source_type,
        source_record_id: snap.source_record_id,
        expected_title: snap.deployed_title,
        detected_title: detectedTitle,
        expected_meta_desc: snap.deployed_meta_desc,
        detected_meta_desc: detectedMetaDesc,
        expected_h1: snap.deployed_h1,
        detected_h1: detectedH1,
        expected_content_hash: snap.deployed_content_hash,
        detected_content_hash: detectedContentHash,
        expected_schema_types: snap.deployed_schema_types,
        detected_schema_types: detectedSchemaTypes,
        status,
        changed_elements: comparison.changed,
        details: comparison.details,
      })

      const newFailures = hasChanges ? (snap.consecutive_failures || 0) + 1 : 0

      snapshotUpdates.push({
        id: snap.id,
        updates: {
          last_verified_at: new Date().toISOString(),
          last_verification_status: status,
          consecutive_failures: newFailures,
        },
      })

      // Create alert after 2+ consecutive detected changes (avoid false positives from CDN cache)
      if (hasChanges && newFailures >= 2) {
        const criticalElements = comparison.changed.filter(e => ['title', 'h1', 'meta_desc'].includes(e))
        const severity = criticalElements.length > 0 ? 'high' : (bodyChanged ? 'medium' : 'low')

        const changedLabel = comparison.changed.map(e => {
          const labels: Record<string, string> = { title: 'Title', meta_desc: 'Meta description', h1: 'H1', schema: 'Schema.org', body_content: 'Contenu' }
          return labels[e] || e
        }).join(', ')

        alertsToCreate.push({
          tracked_site_id: snap.tracked_site_id,
          user_id: snap.user_id,
          domain: snap.domain,
          metric_name: 'content_integrity',
          metric_source: 'content_monitor',
          severity,
          direction: 'changed',
          current_value: comparison.changed.length,
          baseline_mean: 0,
          baseline_stddev: 0,
          z_score: newFailures,
          description: `📝 Contenu modifié sur ${snap.page_url} — Éléments altérés : ${changedLabel}. Vérifiez si une mise à jour CMS a écrasé le contenu déployé par Content Architect.`,
        })
      }
    }

    // 2. Batch write
    if (monitorLogs.length > 0) {
      await supabase.from('content_monitor_log').insert(monitorLogs)
    }

    for (const { id, updates } of snapshotUpdates) {
      await supabase.from('content_deploy_snapshots').update(updates).eq('id', id)
    }

    // 3. Create alerts (deduplicate 24h)
    for (const alert of alertsToCreate) {
      const { data: existing } = await supabase
        .from('anomaly_alerts')
        .select('id')
        .eq('tracked_site_id', alert.tracked_site_id)
        .eq('metric_name', 'content_integrity')
        .eq('metric_source', 'content_monitor')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('anomaly_alerts').insert(alert)
      }
    }

    // 4. Summary
    const summary = {
      total_checked: monitorLogs.length,
      ok: monitorLogs.filter(l => l.status === 'ok').length,
      elements_altered: monitorLogs.filter(l => l.status === 'elements_altered').length,
      fetch_failed: monitorLogs.filter(l => l.status === 'fetch_failed').length,
      alerts_created: alertsToCreate.length,
    }

    console.log('[content-monitor] Summary:', JSON.stringify(summary))

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[content-monitor] Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}))
