import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Edge Function: feedback-loop-solutions
 * 
 * Met à jour le success_rate des solutions dans solution_library
 * en se basant sur les données d'audit_impact_snapshots.
 * 
 * Logique:
 * 1. Récupère les snapshots avec corrective_code_deployed = true et impact_score non null
 * 2. Cross-référence avec saved_corrective_codes pour identifier les fixes utilisés
 * 3. Met à jour le success_rate dans solution_library
 * 
 * Appelé périodiquement (cron) ou manuellement depuis l'admin.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    console.log('🔄 Feedback Loop: mise à jour des success_rate...');

    // 1. Récupérer les snapshots avec code déployé ET impact mesuré
    const { data: snapshots, error: snapError } = await supabase
      .from('audit_impact_snapshots')
      .select('id, domain, user_id, impact_score, corrective_code_deployed, reliability_grade, audit_scores')
      .eq('corrective_code_deployed', true)
      .not('impact_score', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (snapError) {
      console.error('❌ Erreur lecture snapshots:', snapError);
      throw snapError;
    }

    if (!snapshots || snapshots.length === 0) {
      console.log('ℹ️ Aucun snapshot avec code déployé et impact mesuré');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No snapshots to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 ${snapshots.length} snapshots avec impact mesuré`);

    // 2. Pour chaque snapshot, retrouver les fixes appliqués
    let updated = 0;
    let errors = 0;
    const processedSolutions = new Map<string, { totalImpact: number; count: number }>();

    for (const snapshot of snapshots) {
      try {
        // Retrouver le corrective code pour ce domaine/user
        const { data: savedCode } = await supabase
          .from('saved_corrective_codes')
          .select('fixes_applied')
          .eq('user_id', snapshot.user_id)
          .ilike('url', `%${snapshot.domain}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!savedCode || !savedCode.fixes_applied) continue;

        const fixes = savedCode.fixes_applied as Array<{ id: string; label?: string; category?: string }>;
        const impactScore = snapshot.impact_score as number;

        // Normaliser l'impact en success indicator (0-100)
        // impact_score > 0 = amélioration, < 0 = régression
        const successRate = Math.max(0, Math.min(100, 50 + impactScore));

        for (const fix of fixes) {
          const fixId = fix.id || (fix as any);
          if (!fixId || typeof fixId !== 'string') continue;

          const existing = processedSolutions.get(fixId);
          if (existing) {
            existing.totalImpact += successRate;
            existing.count += 1;
          } else {
            processedSolutions.set(fixId, { totalImpact: successRate, count: 1 });
          }
        }
      } catch (e) {
        errors++;
        console.error(`⚠️ Erreur traitement snapshot ${snapshot.id}:`, e);
      }
    }

    // 3. Mettre à jour solution_library avec les success_rate calculés
    for (const [errorType, data] of processedSolutions) {
      const avgSuccessRate = Math.round(data.totalImpact / data.count);

      const { data: existingSolution } = await supabase
        .from('solution_library')
        .select('id, success_rate, usage_count')
        .eq('error_type', errorType)
        .order('usage_count', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSolution) {
        // Weighted average: 70% new data, 30% existing
        const currentRate = existingSolution.success_rate || 50;
        const blendedRate = Math.round(currentRate * 0.3 + avgSuccessRate * 0.7);

        const { error: updateError } = await supabase
          .from('solution_library')
          .update({ 
            success_rate: blendedRate,
            // Promote to generic if success_rate > 75 and usage_count > 5
            is_generic: blendedRate > 75 && (existingSolution.usage_count || 0) > 5
          })
          .eq('id', existingSolution.id);

        if (updateError) {
          console.error(`❌ Erreur update solution ${errorType}:`, updateError);
          errors++;
        } else {
          updated++;
          console.log(`📈 ${errorType}: ${currentRate}% → ${blendedRate}% (${data.count} mesures)`);
        }
      }
    }

    const summary = {
      success: true,
      snapshotsProcessed: snapshots.length,
      uniqueSolutions: processedSolutions.size,
      solutionsUpdated: updated,
      errors,
      message: `${updated} solution(s) mise(s) à jour sur ${processedSolutions.size} identifiée(s)`
    };

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ Feedback Loop terminé: ${summary.message}`);
    console.log('═══════════════════════════════════════════════════════════════');

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Feedback loop error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
