/**
 * measure-patch-impact — Measures effectiveness of deployed code patches.
 * 
 * For each deployed proposal, compares error counts in the 7 days before
 * vs 7 days after deployment to determine if the patch was effective.
 * 
 * Called on-demand by admin or scheduled weekly via cron.
 */

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = getServiceClient()

    // Find deployed proposals not yet measured (deployed > 7 days ago)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: deployedProposals, error: fetchErr } = await supabase
      .from('cto_code_proposals')
      .select('id, target_function, domain, agent_source, updated_at')
      .eq('status', 'deployed')
      .lt('updated_at', sevenDaysAgo)
      .limit(20)

    if (fetchErr) {
      console.error('[measure-patch-impact] Fetch error:', fetchErr)
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!deployedProposals || deployedProposals.length === 0) {
      return new Response(JSON.stringify({ message: 'No proposals to measure', measured: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check which proposals already have measurements
    const proposalIds = deployedProposals.map(p => p.id)
    const { data: existingMeasurements } = await supabase
      .from('patch_effectiveness')
      .select('proposal_id')
      .in('proposal_id', proposalIds)

    const alreadyMeasured = new Set((existingMeasurements || []).map(m => m.proposal_id))
    const toMeasure = deployedProposals.filter(p => !alreadyMeasured.has(p.id))

    if (toMeasure.length === 0) {
      return new Response(JSON.stringify({ message: 'All proposals already measured', measured: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results = []

    for (const proposal of toMeasure) {
      const deployDate = new Date(proposal.updated_at)
      const beforeStart = new Date(deployDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const afterEnd = new Date(deployDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const deployIso = deployDate.toISOString()

      // Count errors BEFORE deployment (injection + connector + silent)
      const [injBefore, connBefore, silentBefore, savBefore] = await Promise.all([
        supabase.from('injection_error_logs')
          .select('id', { count: 'exact', head: true })
          .eq('domain', proposal.domain || '')
          .gte('created_at', beforeStart)
          .lt('created_at', deployIso),
        supabase.from('log_connector_errors')
          .select('id', { count: 'exact', head: true })
          .eq('domain', proposal.domain || '')
          .gte('created_at', beforeStart)
          .lt('created_at', deployIso),
        supabase.from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'silent_error')
          .gte('created_at', beforeStart)
          .lt('created_at', deployIso),
        supabase.from('sav_conversations')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', beforeStart)
          .lt('created_at', deployIso),
      ])

      // Count errors AFTER deployment
      const [injAfter, connAfter, silentAfter, savAfter] = await Promise.all([
        supabase.from('injection_error_logs')
          .select('id', { count: 'exact', head: true })
          .eq('domain', proposal.domain || '')
          .gte('created_at', deployIso)
          .lt('created_at', afterEnd),
        supabase.from('log_connector_errors')
          .select('id', { count: 'exact', head: true })
          .eq('domain', proposal.domain || '')
          .gte('created_at', deployIso)
          .lt('created_at', afterEnd),
        supabase.from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'silent_error')
          .gte('created_at', deployIso)
          .lt('created_at', afterEnd),
        supabase.from('sav_conversations')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', deployIso)
          .lt('created_at', afterEnd),
      ])

      const errorsBefore = (injBefore.count || 0) + (connBefore.count || 0) + (silentBefore.count || 0)
      const errorsAfter = (injAfter.count || 0) + (connAfter.count || 0) + (silentAfter.count || 0)
      const savComplaintsBefore = savBefore.count || 0
      const savComplaintsAfter = savAfter.count || 0

      const reductionPct = errorsBefore > 0
        ? Math.round(((errorsBefore - errorsAfter) / errorsBefore) * 100)
        : (errorsAfter === 0 ? 100 : -100)

      const isEffective = reductionPct >= 20

      const measurement = {
        proposal_id: proposal.id,
        domain: proposal.domain || 'unknown',
        target_function: proposal.target_function,
        agent_source: proposal.agent_source || 'cto',
        deployment_date: deployIso,
        errors_before: errorsBefore,
        errors_after: errorsAfter,
        error_reduction_pct: reductionPct,
        sav_complaints_before: savComplaintsBefore,
        sav_complaints_after: savComplaintsAfter,
        is_effective: isEffective,
        measurement_notes: `Injection: ${injBefore.count || 0}→${injAfter.count || 0}, Connector: ${connBefore.count || 0}→${connAfter.count || 0}, Silent: ${silentBefore.count || 0}→${silentAfter.count || 0}`,
      }

      const { error: insertErr } = await supabase
        .from('patch_effectiveness')
        .insert(measurement)

      if (insertErr) {
        console.error(`[measure-patch-impact] Insert error for ${proposal.id}:`, insertErr)
      } else {
        results.push(measurement)
      }

      // Mark proposal as measured
      await supabase
        .from('cto_code_proposals')
        .update({ status: 'measured' })
        .eq('id', proposal.id)
    }

    // Log summary
    const effective = results.filter(r => r.is_effective).length
    const ineffective = results.length - effective
    console.log(`[measure-patch-impact] Measured ${results.length} patches: ${effective} effective, ${ineffective} ineffective`)

    return new Response(JSON.stringify({
      measured: results.length,
      effective,
      ineffective,
      details: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[measure-patch-impact] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
