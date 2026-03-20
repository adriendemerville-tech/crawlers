import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getAnonClient, getUserClient } from '../_shared/supabaseClient.ts';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

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

  const normalizedEmail = normalizeEmail(email);
  const supabase = getServiceClient();

  const { count: activeProfileCount, error: profileError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('email', normalizedEmail);

  if (profileError) {
    console.error('check-email profile lookup error:', profileError);
  }

  if ((activeProfileCount ?? 0) > 0) {
    return json({ exists: true, source: 'profiles' });
  }

  const { data: archivedUser, error: archivedError } = await supabase
    .from('archived_users')
    .select('id, original_user_id, email')
    .eq('email', normalizedEmail)
    .order('archived_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (archivedError) {
    console.error('check-email archived lookup error:', archivedError);
  }

  if (archivedUser?.original_user_id) {
    const { data: authUserResult, error: authUserError } = await supabase.auth.admin.getUserById(archivedUser.original_user_id);

    if (authUserError) {
      console.error('check-email getUserById error:', authUserError);
    }

    const authUser = authUserResult?.user;
    const authUserEmail = normalizeEmail(authUser?.email ?? '');

    if (authUser && authUserEmail === normalizedEmail) {
      const { count: linkedProfileCount, error: linkedProfileError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', archivedUser.original_user_id);

      if (linkedProfileError) {
        console.error('check-email linked profile lookup error:', linkedProfileError);
      }

      if ((linkedProfileCount ?? 0) === 0) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(archivedUser.original_user_id);
        if (deleteError) {
          console.error('Failed to cleanup archived auth user during check-email:', deleteError);
          return json({ exists: true, source: 'stale_auth_cleanup_failed' });
        }
      } else {
        return json({ exists: true, source: 'profiles-linked' });
      }
    }
  }

  // Final check: look for orphan auth user (exists in auth.users but no profile, no archive)
  const { data: listResult, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (!listError) {
    // Use a direct approach: try to find user by email via admin API
    const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const orphanUser = allUsers?.users?.find(
      (u: any) => (u.email || '').toLowerCase() === normalizedEmail
    );

    if (orphanUser) {
      // Auth user exists but no profile and no archived record → orphan, clean it up
      const { error: deleteOrphanError } = await supabase.auth.admin.deleteUser(orphanUser.id);
      if (deleteOrphanError) {
        console.error('Failed to cleanup orphan auth user:', deleteOrphanError);
        return json({ exists: true, source: 'orphan_cleanup_failed' });
      }
      console.log(`Cleaned up orphan auth user ${orphanUser.id} for email ${normalizedEmail}`);
    }
  }

  return json({ exists: false, source: archivedUser ? 'archived' : 'none' });
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

// ─── delete-user (admin only) ───

async function handleDeleteUser(body: any, req: Request) {
  const { user_id } = body;
  if (!user_id) return json({ error: 'user_id required' }, 400);

  // Verify caller is admin
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = getUserClient(authHeader);
  const { data: { user: caller } } = await userClient.auth.getUser();
  if (!caller) return json({ error: 'Unauthorized' }, 401);

  const supabase = getServiceClient();
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin access required' }, 403);

  // Delete from auth.users (cascades to profiles via FK)
  const { error } = await supabase.auth.admin.deleteUser(user_id);
  if (error) {
    console.error('Delete auth user error:', error);
    return json({ error: error.message }, 500);
  }

  return json({ success: true });
}

// ─── request-sdk-toggle (admin only — sends confirmation email) ───

async function handleRequestSdkToggle(body: any, req: Request) {
  const { requested_value } = body;
  if (typeof requested_value !== 'boolean') return json({ error: 'requested_value required' }, 400);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = getUserClient(authHeader);
  const { data: { user: caller } } = await userClient.auth.getUser();
  if (!caller) return json({ error: 'Unauthorized' }, 401);

  const supabase = getServiceClient();
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin access required' }, 403);

  // Generate a unique token
  const token = crypto.randomUUID();

  // Store pending confirmation
  const { error: insertError } = await supabase
    .from('sdk_toggle_confirmations')
    .insert({
      token,
      requested_by: caller.id,
      requested_value,
    });

  if (insertError) {
    console.error('SDK toggle insert error:', insertError);
    return json({ error: 'Failed to create confirmation' }, 500);
  }

  // Get admin email
  const adminEmail = caller.email;
  const action = requested_value ? 'ACTIVER' : 'DÉSACTIVER';
  const confirmUrl = `https://crawlers.fr/console?confirm_sdk=${token}`;

  // Send confirmation email
  const emailPayload = {
    run_id: crypto.randomUUID(),
    message_id: crypto.randomUUID(),
    to: adminEmail,
    subject: `Confirmation requise — ${action} le SDK Global`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #111; font-size: 20px; margin-bottom: 12px;">Confirmation SDK Global</h1>
        <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
          Vous avez demandé à <strong>${action}</strong> le SDK Global sur l'ensemble du parc client Crawlers.
        </p>
        <p style="color: #555; font-size: 14px; margin-bottom: 24px;">
          Cette action impacte tous les scripts injectés sur tous les sites connectés. Pour confirmer, cliquez sur le bouton ci-dessous.
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${confirmUrl}" style="display: inline-block; padding: 12px 32px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
            Confirmer la modification
          </a>
        </div>
        <p style="color: #999; font-size: 12px;">
          Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
        </p>
      </div>
    `,
    from: 'noreply@notify.crawlers.fr',
    sender_domain: 'notify.crawlers.fr',
    purpose: 'transactional',
    label: 'sdk-toggle-confirmation',
    text: `Confirmation requise : ${action} le SDK Global. Lien : ${confirmUrl}`,
    queued_at: new Date().toISOString(),
  };

  await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: emailPayload,
  });

  return json({ success: true, pending: true });
}

// ─── confirm-sdk-toggle (validates token and applies change) ───

async function handleConfirmSdkToggle(body: any, req: Request) {
  const { token } = body;
  if (!token) return json({ error: 'Token required' }, 400);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = getUserClient(authHeader);
  const { data: { user: caller } } = await userClient.auth.getUser();
  if (!caller) return json({ error: 'Unauthorized' }, 401);

  const supabase = getServiceClient();
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin access required' }, 403);

  // Fetch the pending confirmation
  const { data: confirmation, error: fetchError } = await supabase
    .from('sdk_toggle_confirmations')
    .select('*')
    .eq('token', token)
    .eq('confirmed', false)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (fetchError || !confirmation) {
    return json({ error: 'Token invalide ou expiré' }, 400);
  }

  // Apply the SDK change
  await supabase
    .from('system_config')
    .upsert({ key: 'sdk_enabled', value: confirmation.requested_value, updated_at: new Date().toISOString() } as any, { onConflict: 'key' });

  // Mark as confirmed
  await supabase
    .from('sdk_toggle_confirmations')
    .update({ confirmed: true, confirmed_at: new Date().toISOString() } as any)
    .eq('id', confirmation.id);

  return json({ success: true, sdk_enabled: confirmation.requested_value });
}

// ─── Router ───

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'check-email':           return await handleCheckEmail(body);
      case 'send-code':             return await handleSendCode(body);
      case 'verify-code':           return await handleVerifyCode(body);
      case 'reset-password':        return await handleResetPassword(body);
      case 'delete-user':           return await handleDeleteUser(body, req);
      case 'request-sdk-toggle':    return await handleRequestSdkToggle(body, req);
      case 'confirm-sdk-toggle':    return await handleConfirmSdkToggle(body, req);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('auth-actions error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
