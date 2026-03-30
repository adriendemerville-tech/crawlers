import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * injection-monitor
 * 
 * Vérification périodique (cron 12h) de la présence des scripts injectés
 * sur tous les sites clients actifs.
 * 
 * 3 mécanismes :
 *   1. Vérification périodique — fetch chaque page et détecte le script
 *   2. Alertes proactives — crée une anomaly_alert si un script disparaît
 *   3. Checksum/hash — compare le hash du script détecté vs attendu
 */

const SCRIPT_MARKERS = ['CRAWLERS_FIX', 'crawlers-geo', 'serve-client-script', 'crawlers.fr']

// ── Hash utilities ──

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content.trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Page fetcher ──

async function fetchPageHTML(url: string): Promise<{ html: string; status: number } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrawlersMonitor/1.0)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)
    return { html: await resp.text(), status: resp.status }
  } catch {
    return null
  }
}

// ── Script detection with hash ──

// detectScript is handled by detectScriptWithHash below

async function detectScriptWithHash(html: string): Promise<{
  found: boolean
  snippet: string
  detectedHash: string | null
}> {
  const lower = html.toLowerCase()

  for (const marker of SCRIPT_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      const markerIdx = lower.indexOf(marker.toLowerCase())
      const scriptStartSearch = html.lastIndexOf('<script', markerIdx)
      const scriptEndSearch = html.indexOf('</script>', markerIdx)

      if (scriptStartSearch !== -1 && scriptEndSearch !== -1) {
        const fullBlock = html.substring(scriptStartSearch, scriptEndSearch + 9)
        const contentMatch = fullBlock.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
        const scriptContent = contentMatch?.[1]?.trim() || ''

        return {
          found: true,
          snippet: fullBlock.substring(0, 200),
          detectedHash: scriptContent.length > 10 ? await computeHash(scriptContent) : null,
        }
      }

      const start = Math.max(0, markerIdx - 40)
      const end = Math.min(html.length, markerIdx + 160)
      return {
        found: true,
        snippet: html.substring(start, end).replace(/\s+/g, ' ').trim(),
        detectedHash: null,
      }
    }
  }

  return { found: false, snippet: '', detectedHash: null }
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = getServiceClient()

    // 1. Get all active rules with their sites
    const { data: rules, error: rulesErr } = await supabase
      .from('site_script_rules')
      .select('id, domain_id, url_pattern, payload_type, payload_data, expected_script_hash, verification_failures_count')
      .eq('is_active', true)
      .limit(200)

    if (rulesErr || !rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: 'No active rules to monitor', checked: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Get site info for all domain_ids
    const domainIds = [...new Set(rules.map(r => r.domain_id))]
    const { data: sites } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id')
      .in('id', domainIds)

    const siteMap = new Map((sites || []).map(s => [s.id, s]))

    // 3. Process each rule
    const monitorLogs: any[] = []
    const alertsToCreate: any[] = []
    const ruleUpdates: Array<{ id: string; updates: any }> = []

    for (const rule of rules) {
      const site = siteMap.get(rule.domain_id)
      if (!site) continue

      const domain = site.domain.replace(/^www\./, '')
      const pattern = rule.url_pattern || '*'
      const url = (pattern === '*' || pattern === '/' || pattern === '/*')
        ? `https://${domain}/`
        : `https://${domain}${pattern.startsWith('/') ? pattern : '/' + pattern}`

      // Compute expected hash if not stored yet
      let expectedHash = rule.expected_script_hash
      if (!expectedHash && rule.payload_data) {
        const script = (rule.payload_data as any)?.script
        if (script && script.length > 10) {
          expectedHash = await computeHash(script)
          ruleUpdates.push({
            id: rule.id,
            updates: { expected_script_hash: expectedHash },
          })
        }
      }

      // Fetch and check
      const page = await fetchPageHTML(url)

      if (!page) {
        monitorLogs.push({
          tracked_site_id: site.id,
          rule_id: rule.id,
          domain: site.domain,
          url_checked: url,
          expected_hash: expectedHash,
          detected_hash: null,
          status: 'fetch_failed',
          details: { error: 'Timeout or unreachable' },
        })
        continue
      }

      const detection = await detectScriptWithHash(page.html)

      if (!detection.found) {
        // Script MISSING — increment failure count
        const newFailureCount = (rule.verification_failures_count || 0) + 1
        ruleUpdates.push({
          id: rule.id,
          updates: {
            last_verified_at: new Date().toISOString(),
            last_verification_status: 'missing',
            verification_failures_count: newFailureCount,
          },
        })

        monitorLogs.push({
          tracked_site_id: site.id,
          rule_id: rule.id,
          domain: site.domain,
          url_checked: url,
          expected_hash: expectedHash,
          detected_hash: null,
          status: 'missing',
          details: { http_status: page.status, payload_type: rule.payload_type },
        })

        // Create alert after 2+ consecutive failures (avoid false positives)
        if (newFailureCount >= 2) {
          alertsToCreate.push({
            tracked_site_id: site.id,
            user_id: site.user_id,
            domain: site.domain,
            metric_name: 'script_injection',
            metric_source: 'injection_monitor',
            severity: newFailureCount >= 4 ? 'critical' : 'high',
            direction: 'down',
            current_value: 0,
            baseline_mean: 1,
            baseline_stddev: 0,
            z_score: newFailureCount,
            description: `⚠️ Script ${rule.payload_type || 'correctif'} non détecté sur ${url} (${newFailureCount} vérifications consécutives). Possible mise à jour CMS ou suppression du widget.`,
          })
        }

        continue
      }

      // Script FOUND — check hash
      let status = 'ok'
      if (expectedHash && detection.detectedHash && expectedHash !== detection.detectedHash) {
        status = 'altered'
        alertsToCreate.push({
          tracked_site_id: site.id,
          user_id: site.user_id,
          domain: site.domain,
          metric_name: 'script_integrity',
          metric_source: 'injection_monitor',
          severity: 'medium',
          direction: 'changed',
          current_value: 0,
          baseline_mean: 1,
          baseline_stddev: 0,
          z_score: 1,
          description: `🔄 Script ${rule.payload_type || 'correctif'} modifié sur ${url}. Hash attendu: ${expectedHash.substring(0, 12)}… / Détecté: ${detection.detectedHash.substring(0, 12)}… — Vérifiez si le script est à jour.`,
        })
      }

      ruleUpdates.push({
        id: rule.id,
        updates: {
          last_verified_at: new Date().toISOString(),
          last_verification_status: status,
          verification_failures_count: status === 'ok' ? 0 : (rule.verification_failures_count || 0),
        },
      })

      monitorLogs.push({
        tracked_site_id: site.id,
        rule_id: rule.id,
        domain: site.domain,
        url_checked: url,
        expected_hash: expectedHash,
        detected_hash: detection.detectedHash,
        status,
        details: {
          http_status: page.status,
          snippet: detection.snippet,
          payload_type: rule.payload_type,
        },
      })
    }

    // 4. Batch write results
    if (monitorLogs.length > 0) {
      await supabase.from('injection_monitor_log').insert(monitorLogs)
    }

    // 5. Update rules
    for (const { id, updates } of ruleUpdates) {
      await supabase.from('site_script_rules').update(updates).eq('id', id)
    }

    // 6. Create alerts (deduplicate by checking recent alerts)
    for (const alert of alertsToCreate) {
      // Check if same alert exists in last 24h
      const { data: existing } = await supabase
        .from('anomaly_alerts')
        .select('id')
        .eq('tracked_site_id', alert.tracked_site_id)
        .eq('metric_name', alert.metric_name)
        .eq('metric_source', 'injection_monitor')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('anomaly_alerts').insert(alert)
      }
    }

    // 7. Summary
    const summary = {
      total_rules_checked: monitorLogs.length,
      ok: monitorLogs.filter(l => l.status === 'ok').length,
      missing: monitorLogs.filter(l => l.status === 'missing').length,
      altered: monitorLogs.filter(l => l.status === 'altered').length,
      fetch_failed: monitorLogs.filter(l => l.status === 'fetch_failed').length,
      alerts_created: alertsToCreate.length,
    }

    console.log(`[injection-monitor] Summary:`, JSON.stringify(summary))

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[injection-monitor] Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
