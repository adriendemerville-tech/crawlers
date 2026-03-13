import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * refresh-llm-visibility-all
 * 
 * Weekly cron: triggers calculate-llm-visibility for all tracked sites.
 * Scheduled every Monday at 07:00 UTC (after SERP refresh at 06:00).
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const { data: sites, error } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id')

    if (error || !sites?.length) {
      console.log('[refresh-llm-visibility-all] No sites or error:', error)
      return new Response(JSON.stringify({ refreshed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let refreshed = 0
    let errors = 0

    for (const site of sites) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/calculate-llm-visibility`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tracked_site_id: site.id,
            user_id: site.user_id,
          }),
        })

        if (!resp.ok) {
          console.error(`[refresh-llm-visibility-all] Failed for ${site.domain}: ${resp.status}`)
          errors++
          continue
        }

        refreshed++
        console.log(`[refresh-llm-visibility-all] ✅ ${site.domain}`)

        // 2s delay between sites to avoid rate limiting (20 API calls per site)
        await new Promise(r => setTimeout(r, 2000))
      } catch (err) {
        console.error(`[refresh-llm-visibility-all] Error for ${site.domain}:`, err)
        errors++
      }
    }

    console.log(`[refresh-llm-visibility-all] Done: ${refreshed}/${sites.length} (${errors} errors)`)

    return new Response(JSON.stringify({ refreshed, errors, total: sites.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[refresh-llm-visibility-all] Fatal:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
