import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Use the Admin API to generate a password recovery link
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://crawlers.fr/auth',
      },
    });

    if (error) {
      console.error('Recovery error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enqueue the email via the email queue
    const resetLink = data?.properties?.action_link || '';
    
    const emailPayload = {
      run_id: crypto.randomUUID(),
      message_id: crypto.randomUUID(),
      to: email,
      subject: 'Réinitialisation de votre mot de passe — Crawlers',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #111; font-size: 22px; margin-bottom: 8px;">Réinitialiser votre mot de passe</h1>
          <p style="color: #555; font-size: 14px; margin-bottom: 24px;">
            Vous avez demandé la réinitialisation de votre mot de passe sur Crawlers.
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${resetLink}" style="display: inline-block; background: #111; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color: #999; font-size: 12px;">
            Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.
          </p>
        </div>
      `,
      from: 'noreply@notify.crawlers.fr',
      sender_domain: 'notify.crawlers.fr',
      purpose: 'transactional',
      label: 'password-reset',
      queued_at: new Date().toISOString(),
    };

    const { error: queueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: emailPayload,
    });

    if (queueError) {
      console.error('Queue error:', queueError);
    }

    return new Response(JSON.stringify({ success: true, link_generated: !!resetLink }), {
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
