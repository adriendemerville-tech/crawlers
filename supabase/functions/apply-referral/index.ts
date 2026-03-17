import { getUserClient, getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authClient = getUserClient(authHeader);
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = userData.user.id;
    const { referral_code } = await req.json();

    if (!referral_code || typeof referral_code !== 'string' || referral_code.trim().length < 4) {
      return new Response(JSON.stringify({ error: 'Code invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const code = referral_code.trim().toUpperCase();

    // Service client for privileged operations
    const supabase = getServiceClient();

    // 1. Get current user profile
    const { data: myProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('referral_code, referred_by')
      .eq('user_id', userId)
      .single();

    if (profileErr || !myProfile) {
      return new Response(JSON.stringify({ error: 'Profil introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Already referred
    if (myProfile.referred_by) {
      return new Response(JSON.stringify({ error: 'Vous avez déjà utilisé un code de parrainage' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Self-referral check
    if (myProfile.referral_code === code) {
      return new Response(JSON.stringify({ error: 'Vous ne pouvez pas utiliser votre propre code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Find referrer
    const { data: referrer, error: refErr } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('referral_code', code)
      .single();

    if (refErr || !referrer) {
      return new Response(JSON.stringify({ error: 'Code de parrainage inconnu' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Link referee to referrer
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ referred_by: referrer.user_id })
      .eq('user_id', userId);

    if (updateErr) {
      console.error('Update error:', updateErr);
      return new Response(JSON.stringify({ error: 'Erreur lors de la mise à jour' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Welcome bonus: +10 credits to referee — atomic via RPC, fallback to SELECT+UPDATE
    const REFERRAL_BONUS = 10;
    let newBalance: number;

    const { data: rpcResult, error: rpcError } = await supabase.rpc('atomic_credit_update', {
      p_user_id: userId,
      p_amount: REFERRAL_BONUS,
    });

    if (rpcError) {
      // Fallback: non-atomic but still functional
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('user_id', userId)
        .single();

      newBalance = (currentProfile?.credits_balance || 0) + REFERRAL_BONUS;

      await supabase
        .from('profiles')
        .update({ credits_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    } else {
      newBalance = (rpcResult as any)?.new_balance ?? 0;
    }

    // Record transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: REFERRAL_BONUS,
        transaction_type: 'bonus',
        description: 'Bonus de bienvenue parrainage — 10 crédits',
      });

    console.log(`✅ Referral applied: ${userId} referred by ${referrer.user_id}, +${REFERRAL_BONUS} credits`);

    return new Response(JSON.stringify({ 
      success: true, 
      credits_added: REFERRAL_BONUS, 
      new_balance: newBalance 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in apply-referral:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
