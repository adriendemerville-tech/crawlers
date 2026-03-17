import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * verify-injection
 * 
 * Vérifie que le(s) script(s) injecté(s) sont bien présents sur la/les page(s) cible.
 * 
 * Input: { tracked_site_id: string }
 * Output: { results: Array<{ url, pattern, found, snippet_preview, status }>, summary }
 */

const CRAWLERS_SIGNATURE = 'crawlers.fr'
const SCRIPT_MARKERS = ['CRAWLERS_FIX', 'crawlers-geo', 'serve-client-script']

async function fetchPageHTML(url: string): Promise<{ html: string; status: number } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrawlersVerifier/1.0)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)
    const html = await resp.text()
    return { html, status: resp.status }
  } catch (err) {
    console.error(`[verify-injection] Failed to fetch ${url}:`, err)
    return null
  }
}

function detectInjection(html: string, expectedScript?: string): {
  found: boolean
  method: 'sdk_tag' | 'inline_script' | 'not_found'
  snippet_preview?: string
} {
  const lower = html.toLowerCase()

  // Check 1: SDK loader tag (serve-client-script URL)
  if (lower.includes('serve-client-script')) {
    const match = html.match(/<script[^>]*serve-client-script[^>]*>/i)
    return {
      found: true,
      method: 'sdk_tag',
      snippet_preview: match?.[0]?.substring(0, 200) || 'SDK tag detected',
    }
  }

  // Check 2: Inline script markers
  for (const marker of SCRIPT_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      const idx = lower.indexOf(marker.toLowerCase())
      const start = Math.max(0, idx - 50)
      const end = Math.min(html.length, idx + marker.length + 100)
      return {
        found: true,
        method: 'inline_script',
        snippet_preview: html.substring(start, end).replace(/\s+/g, ' ').trim(),
      }
    }
  }

  // Check 3: If we have expected script content, look for key fragments
  if (expectedScript && expectedScript.length > 50) {
    // Extract first meaningful line of the script
    const lines = expectedScript.split('\n').filter(l => l.trim().length > 20)
    const firstKey = lines[0]?.trim().substring(0, 60)
    if (firstKey && html.includes(firstKey)) {
      return {
        found: true,
        method: 'inline_script',
        snippet_preview: firstKey,
      }
    }
  }

  // Check 4: Generic crawlers.fr reference
  if (lower.includes(CRAWLERS_SIGNATURE)) {
    return {
      found: true,
      method: 'inline_script',
      snippet_preview: 'crawlers.fr reference found',
    }
  }

  return { found: false, method: 'not_found' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { tracked_site_id } = await req.json()
    if (!tracked_site_id) {
      return new Response(JSON.stringify({ error: 'tracked_site_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Get site info
    const { data: site, error: siteErr } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id, current_config')
      .eq('id', tracked_site_id)
      .single()

    if (siteErr || !site) {
      return new Response(JSON.stringify({ error: 'Site not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Get all active rules for this site
    const { data: rules } = await supabase
      .from('site_script_rules')
      .select('id, url_pattern, payload_type, payload_data, is_active')
      .eq('domain_id', site.id)
      .eq('is_active', true)

    // 3. Build list of URLs to check
    const urlsToCheck: { url: string; pattern: string; expectedScript?: string }[] = []
    const domain = site.domain.replace(/^www\./, '')

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        const script = (rule.payload_data as any)?.script || ''
        const pattern = rule.url_pattern || '*'

        if (pattern === '*' || pattern === '/' || pattern === '/*') {
          // Global rule → check homepage
          urlsToCheck.push({
            url: `https://${domain}/`,
            pattern,
            expectedScript: script,
          })
        } else {
          // Specific pattern → build URL
          const cleanPattern = pattern.startsWith('/') ? pattern : `/${pattern}`
          urlsToCheck.push({
            url: `https://${domain}${cleanPattern}`,
            pattern,
            expectedScript: script,
          })
        }
      }
    } else {
      // No rules — check homepage for legacy config
      const legacyScript = (site.current_config as any)?.corrective_script
      urlsToCheck.push({
        url: `https://${domain}/`,
        pattern: '* (legacy)',
        expectedScript: legacyScript || undefined,
      })
    }

    // Deduplicate URLs
    const seen = new Set<string>()
    const uniqueUrls = urlsToCheck.filter(u => {
      if (seen.has(u.url)) return false
      seen.add(u.url)
      return true
    })

    // 4. Fetch and verify each URL (max 10 to stay within timeout)
    const results: any[] = []
    for (const entry of uniqueUrls.slice(0, 10)) {
      const page = await fetchPageHTML(entry.url)
      if (!page) {
        results.push({
          url: entry.url,
          pattern: entry.pattern,
          found: false,
          status: 0,
          error: 'Fetch failed (timeout or unreachable)',
          method: 'not_found',
        })
        continue
      }

      const detection = detectInjection(page.html, entry.expectedScript)
      results.push({
        url: entry.url,
        pattern: entry.pattern,
        found: detection.found,
        method: detection.method,
        snippet_preview: detection.snippet_preview,
        status: page.status,
      })
    }

    // 5. Log errors to injection_error_logs
    const errorResults = results.filter(r => !r.found)
    if (errorResults.length > 0 && rules && rules.length > 0) {
      const errorRows = []
      for (const errResult of errorResults) {
        const matchingRule = rules.find(r => {
          const pattern = r.url_pattern || '*'
          return errResult.pattern === pattern
        })
        if (matchingRule) {
          errorRows.push({
            rule_id: matchingRule.id,
            domain_id: site.id,
            user_id: site.user_id,
            error_type: errResult.error ? 'fetch_failed' : 'not_found',
            error_details: { url: errResult.url, status: errResult.status, error: errResult.error || null, method: errResult.method },
            domain: site.domain,
            url_pattern: errResult.pattern,
            payload_type: matchingRule.payload_type,
          })
        }
      }
      if (errorRows.length > 0) {
        await supabase.from('injection_error_logs').insert(errorRows)
      }
    }

    // 6. Summary
    const totalChecked = results.length
    const totalFound = results.filter(r => r.found).length
    const allOk = totalFound === totalChecked && totalChecked > 0

    const summary = {
      all_injected: allOk,
      checked: totalChecked,
      found: totalFound,
      missing: totalChecked - totalFound,
      verdict: allOk
        ? '✅ Tous les scripts sont correctement déployés'
        : totalFound > 0
          ? `⚠️ ${totalFound}/${totalChecked} pages vérifiées — scripts partiellement déployés`
          : '❌ Aucun script détecté sur les pages vérifiées',
    }

    console.log(`[verify-injection] ${site.domain}: ${summary.verdict}`)

    return new Response(JSON.stringify({ results, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[verify-injection] Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
