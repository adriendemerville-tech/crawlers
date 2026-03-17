import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * apply-affiliate — Validates and applies an affiliate code during signup.
 * Grants Pro Agency for the configured duration and tracks activation.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, user_id } = await req.json();

    if (!code || typeof code !== 'string' || code.length < 3 || code.length > 30) {
      return new Response(JSON.stringify({ success: false, error: 'Code invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user_id) {
      return new Response(JSON.stringify({ success: false, error: 'user_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();
    const normalizedCode = code.trim().toUpperCase();

    // Find the affiliate code
    const { data: affiliate, error: fetchError } = await supabase
      .from('affiliate_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .single();

    if (fetchError || !affiliate) {
      return new Response(JSON.stringify({ success: false, error: 'Code d\'affiliation introuvable ou expiré' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check max activations
    if (affiliate.current_activations >= affiliate.max_activations) {
      return new Response(JSON.stringify({ success: false, error: 'Ce code a atteint sa limite d\'activations' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check user hasn't already used an affiliate code
    const { data: profile } = await supabase
      .from('profiles')
      .select('affiliate_code_used, plan_type')
      .eq('user_id', user_id)
      .single();

    if (profile?.affiliate_code_used) {
      return new Response(JSON.stringify({ success: false, error: 'Vous avez déjà utilisé un code d\'affiliation' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apply the benefit: Pro Agency for duration_months
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + affiliate.duration_months);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan_type: 'agency_pro',
        subscription_status: 'active',
        subscription_expires_at: expiresAt.toISOString(),
        affiliate_code_used: normalizedCode,
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('[apply-affiliate] Profile update error:', updateError);
      return new Response(JSON.stringify({ success: false, error: 'Erreur lors de l\'application du code' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment activation counter
    await supabase
      .from('affiliate_codes')
      .update({
        current_activations: affiliate.current_activations + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', affiliate.id);

    // Deactivate if max reached
    if (affiliate.current_activations + 1 >= affiliate.max_activations) {
      await supabase
        .from('affiliate_codes')
        .update({ is_active: false })
        .eq('id', affiliate.id);
    }

    console.log(`[apply-affiliate] ✅ Code ${normalizedCode} applied for user ${user_id} — Pro Agency until ${expiresAt.toISOString()}`);

    return new Response(JSON.stringify({
      success: true,
      plan_type: 'agency_pro',
      expires_at: expiresAt.toISOString(),
      duration_months: affiliate.duration_months,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[apply-affiliate] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
