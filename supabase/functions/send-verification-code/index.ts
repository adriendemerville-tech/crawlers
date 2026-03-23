import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // Generate a 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Delete any previous codes for this email
    await supabase.from('verification_codes').delete().eq('email', email);

    // Find user_id from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();

    const userId = profile?.user_id || '00000000-0000-0000-0000-000000000000';

    // Store the code (expires in 15 minutes)
    const { error: insertError } = await supabase.from('verification_codes').insert({
      user_id: userId,
      email,
      code,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to store code' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const confirmLink = `https://crawlers.fr/signup?verified=true`;

    // Enqueue the verification email via the email queue
    const emailPayload = {
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
          <p style="color: #555; font-size: 14px; margin-bottom: 16px;">
            Ou cliquez sur le lien ci-dessous pour confirmer directement :
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${confirmLink}" style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
              Confirmer mon inscription
            </a>
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
      idempotency_key: `verification-code-${email}-${Date.now()}`,
      text: `Votre code de vérification Crawlers : ${code}. Ou confirmez directement : ${confirmLink}`,
      queued_at: new Date().toISOString(),
    };

    const { error: queueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: emailPayload,
    });

    if (queueError) {
      console.error('Queue error:', queueError);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
