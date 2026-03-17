import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getAnonClient } from '../_shared/supabaseClient.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── check-email ───

async function handleCheckEmail(body: any) {
  const { email } = body;
  if (!email || typeof email !== 'string') return json({ exists: false });

  const supabase = getServiceClient();
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.toLowerCase().trim());

  return json({ exists: (count ?? 0) > 0 });
}

// ─── send-code ───

async function handleSendCode(body: any) {
  const { email } = body;
  if (!email) return json({ error: 'Email required' }, 400);

  const supabase = getServiceClient();
  const code = String(Math.floor(100000 + Math.random() * 900000));

  await supabase.from('verification_codes').delete().eq('email', email);

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();

  const userId = profile?.user_id || '00000000-0000-0000-0000-000000000000';

  const { error: insertError } = await supabase.from('verification_codes').insert({
    user_id: userId,
    email,
    code,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });

  if (insertError) {
    console.error('Insert error:', insertError);
    return json({ error: 'Failed to store code' }, 500);
  }

  const emailPayload = {
    run_id: crypto.randomUUID(),
    message_id: crypto.randomUUID(),
    to: email,
    subject: 'Votre code de vérification Crawlers',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #111; font-size: 22px; margin-bottom: 8px;">Code de vérification</h1>
        <p style="color: #555; font-size: 14px; margin-bottom: 24px;">
          Utilisez le code ci-dessous pour confirmer votre inscription sur Crawlers.
        </p>
        <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111;">${code}</span>
        </div>
        <p style="color: #999; font-size: 12px;">
          Ce code expire dans 15 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.
        </p>
      </div>
    `,
    from: 'noreply@notify.crawlers.fr',
    sender_domain: 'notify.crawlers.fr',
    purpose: 'transactional',
    label: 'verification-code',
    text: `Votre code de vérification Crawlers : ${code}`,
    queued_at: new Date().toISOString(),
  };

  const { error: queueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: emailPayload,
  });

  if (queueError) console.error('Queue error:', queueError);

  return json({ success: true });
}

// ─── verify-code ───

async function handleVerifyCode(body: any) {
  const { email, code } = body;
  if (!email || !code) return json({ error: 'Email and code required' }, 400);

  const supabase = getServiceClient();
  const { data: codeRecord, error: fetchError } = await supabase
    .from('verification_codes')
    .select('*')
    .eq('email', email)
    .eq('code', code)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (fetchError || !codeRecord) return json({ success: false, error: 'invalid_code' }, 400);

  await supabase.from('verification_codes').delete().eq('id', codeRecord.id);
  await supabase.from('verification_codes').delete().eq('email', email);

  return json({ success: true });
}

// ─── reset-password ───

async function handleResetPassword(body: any) {
  const { email } = body;
  if (!email || typeof email !== 'string') return json({ error: 'Email required' }, 400);

  const supabase = getAnonClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: 'https://crawlers.fr/auth',
  });

  if (error) {
    console.error('Password reset error:', error);
    return json({ error: error.message }, 400);
  }

  return json({ success: true });
}

// ─── Router ───

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'check-email':     return await handleCheckEmail(body);
      case 'send-code':       return await handleSendCode(body);
      case 'verify-code':     return await handleVerifyCode(body);
      case 'reset-password':  return await handleResetPassword(body);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('auth-actions error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
