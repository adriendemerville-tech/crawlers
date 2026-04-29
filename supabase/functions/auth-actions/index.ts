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

async function ensureArchivedUserRecord(supabase: any, userId: string, archiveReason = 'admin_delete') {
  const { data: existingArchive, error: existingArchiveError } = await supabase
    .from('archived_users')
    .select('id')
    .eq('original_user_id', userId)
    .order('archived_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingArchiveError) {
    console.error('ensureArchivedUserRecord lookup error:', existingArchiveError);
  }

  if (existingArchive?.id) return;

  const [profileResult, authUserResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);

  if (profileResult.error) {
    console.error('ensureArchivedUserRecord profile lookup error:', profileResult.error);
  }

  if (authUserResult.error) {
    console.error('ensureArchivedUserRecord auth lookup error:', authUserResult.error);
  }

  const profile = profileResult.data;
  const authUser = authUserResult.data?.user;
  const archivedEmail = normalizeEmail(profile?.email ?? authUser?.email ?? '');

  if (!archivedEmail) return;

  const snapshot = profile ?? {
    user_id: authUser?.id,
    email: authUser?.email ?? null,
    user_metadata: authUser?.user_metadata ?? null,
    app_metadata: authUser?.app_metadata ?? null,
    created_at: authUser?.created_at ?? null,
  };

  const { error: insertError } = await supabase
    .from('archived_users')
    .insert({
      original_user_id: userId,
      email: archivedEmail,
      first_name: profile?.first_name ?? authUser?.user_metadata?.first_name ?? null,
      last_name: profile?.last_name ?? authUser?.user_metadata?.last_name ?? null,
      credits_balance: profile?.credits_balance ?? null,
      plan_type: profile?.plan_type ?? null,
      persona_type: profile?.persona_type ?? null,
      affiliate_code_used: profile?.affiliate_code_used ?? null,
      original_created_at: profile?.created_at ?? authUser?.created_at ?? null,
      archived_at: new Date().toISOString(),
      archive_reason: archiveReason,
      profile_snapshot: snapshot,
    } as any);

  if (insertError) {
    console.error('ensureArchivedUserRecord insert error:', insertError);
    throw new Error('Failed to archive user before deletion');
  }
}

async function cleanupUserRelations(supabase: any, userId: string) {
  const deleteOperations: Array<{ table: string; column: string }> = [
    { table: 'saved_reports', column: 'user_id' },
    { table: 'support_messages', column: 'sender_id' },
    { table: 'support_conversations', column: 'user_id' },
    { table: 'gmb_performance', column: 'user_id' },
    { table: 'gmb_posts', column: 'user_id' },
    { table: 'gmb_reviews', column: 'user_id' },
    { table: 'gmb_locations', column: 'user_id' },
    { table: 'predictions', column: 'client_id' },
    { table: 'pdf_audits', column: 'client_id' },
    { table: 'cms_connections', column: 'user_id' },
    { table: 'admin_dashboard_config', column: 'user_id' },
    { table: 'billing_info', column: 'user_id' },
    { table: 'cocoon_sessions', column: 'user_id' },
    { table: 'prompt_deployments', column: 'user_id' },
    { table: 'report_folders', column: 'user_id' },
    { table: 'revenue_events', column: 'user_id' },
    { table: 'url_correction_decisions', column: 'user_id' },
    { table: 'user_roles', column: 'user_id' },
  ];

  for (const operation of deleteOperations) {
    const { error } = await supabase
      .from(operation.table)
      .delete()
      .eq(operation.column, userId);

    if (error) {
      console.error(`cleanup delete error on ${operation.table}.${operation.column}:`, error);
      throw new Error(`Failed to cleanup ${operation.table}`);
    }
  }

  const { error: nullAuditsError } = await supabase
    .from('audits')
    .update({ user_id: null } as any)
    .eq('user_id', userId);

  if (nullAuditsError) {
    console.error('cleanup audits nullification error:', nullAuditsError);
    throw new Error('Failed to detach audits from deleted user');
  }

  const { error: nullBlogArticlesError } = await supabase
    .from('blog_articles')
    .update({ author_id: null } as any)
    .eq('author_id', userId);

  if (nullBlogArticlesError) {
    console.error('cleanup blog articles nullification error:', nullBlogArticlesError);
    throw new Error('Failed to detach blog articles from deleted user');
  }

  const { error: profileDeleteError } = await supabase
    .from('profiles')
    .delete()
    .eq('user_id', userId);

  if (profileDeleteError) {
    console.error('cleanup profile delete error:', profileDeleteError);
    throw new Error('Failed to cleanup profile before auth deletion');
  }
}

async function cleanupAndDeleteAuthUser(
  supabase: any,
  userId: string,
  options: { ensureArchive?: boolean; archiveReason?: string } = {},
) {
  if (options.ensureArchive) {
    await ensureArchivedUserRecord(supabase, userId, options.archiveReason);
  }

  await cleanupUserRelations(supabase, userId);

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

  if (deleteError && !deleteError.message?.toLowerCase().includes('user not found')) {
    console.error('cleanupAndDeleteAuthUser auth delete error:', deleteError);
    throw new Error(deleteError.message);
  }
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
        try {
          await cleanupAndDeleteAuthUser(supabase, archivedUser.original_user_id);
        } catch (cleanupError) {
          console.error('Failed to cleanup archived auth user during check-email:', cleanupError);
          return json({ exists: true, source: 'stale_auth_cleanup_failed' });
        }
      } else {
        return json({ exists: true, source: 'profiles-linked' });
      }
    }
  }

  // Final check: look for orphan auth user (exists in auth.users but no profile, no archive)
  const { error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

  if (!listError) {
    // Use a direct approach: try to find user by email via admin API
    const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const orphanUser = allUsers?.users?.find(
      (u: any) => (u.email || '').toLowerCase() === normalizedEmail
    );

    if (orphanUser) {
      try {
        await cleanupAndDeleteAuthUser(supabase, orphanUser.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup orphan auth user:', cleanupError);
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
    idempotency_key: `verification-code-${email}-${Date.now()}`,
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

  try {
    await cleanupAndDeleteAuthUser(supabase, user_id, {
      ensureArchive: true,
      archiveReason: 'admin_delete',
    });
  } catch (error: any) {
    console.error('Delete auth user error:', error);
    return json({ error: error.message || 'Delete failed' }, 500);
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

// ─── list-pending-users (admin only) ───

async function handleListPendingUsers(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = getUserClient(authHeader);
  const { data: { user: caller } } = await userClient.auth.getUser();
  if (!caller) return json({ error: 'Unauthorized' }, 401);

  const supabase = getServiceClient();
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin access required' }, 403);

  const { data: authData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return json({ error: listError.message }, 500);

  const pendingUsers = (authData?.users || [])
    .filter((u: any) => !u.email_confirmed_at)
    .map((u: any) => ({ id: u.id, email: u.email, created_at: u.created_at }));

  const enriched = [];
  for (const pu of pendingUsers) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, persona_type, plan_type')
      .eq('user_id', pu.id)
      .maybeSingle();
    enriched.push({
      ...pu,
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      persona_type: profile?.persona_type || null,
      plan_type: profile?.plan_type || 'free',
    });
  }

  return json({ users: enriched });
}

// ─── confirm-user (admin only) ───

async function handleConfirmUser(body: any, req: Request) {
  const { user_id } = body;
  if (!user_id) return json({ error: 'user_id required' }, 400);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = getUserClient(authHeader);
  const { data: { user: caller } } = await userClient.auth.getUser();
  if (!caller) return json({ error: 'Unauthorized' }, 401);

  const supabase = getServiceClient();
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin access required' }, 403);

  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
    email_confirm: true,
  });

  if (updateError) return json({ error: updateError.message }, 500);

  return json({ success: true, user: { id: updatedUser.user.id, email: updatedUser.user.email } });
}

// ─── create-user (admin only) ───

async function handleCreateUser(body: any, req: Request) {
  const { email, password, first_name, last_name, persona_type, plan_type, credits_balance } = body;
  if (!email || !password) return json({ error: 'Email and password required' }, 400);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = getUserClient(authHeader);
  const { data: { user: caller } } = await userClient.auth.getUser();
  if (!caller) return json({ error: 'Unauthorized' }, 401);

  const supabase = getServiceClient();
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin access required' }, 403);

  // Create auth user with email confirmed
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: normalizeEmail(email),
    password,
    email_confirm: true,
    user_metadata: {
      first_name: first_name || '',
      last_name: last_name || '',
      persona_type: persona_type || null,
    },
  });

  if (createError) {
    console.error('Create user error:', createError);
    return json({ error: createError.message }, 400);
  }

  // Create profile (the trigger may do it, but let's ensure with upsert)
  const finalPlan = plan_type || 'free';
  const isPaidPlan = ['agency_pro', 'agency_premium'].includes(finalPlan);
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      user_id: newUser.user.id,
      email: normalizeEmail(email),
      first_name: first_name || '',
      last_name: last_name || '',
      persona_type: persona_type || null,
      plan_type: finalPlan,
      subscription_status: isPaidPlan ? 'active' : null,
      credits_balance: credits_balance || 0,
    } as any, { onConflict: 'user_id' });

  if (profileError) {
    console.error('Create profile error:', profileError);
    // User was created in auth but profile failed — not critical
  }

  return json({ success: true, user_id: newUser.user.id });
}

// ─── update-user-profile (admin only) ───

async function handleUpdateUserProfile(body: any, req: Request) {
  const { target_user_id, first_name, last_name, persona_type, plan_type, email: newEmail } = body;
  if (!target_user_id) return json({ error: 'target_user_id required' }, 400);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = getUserClient(authHeader);
  const { data: { user: caller } } = await userClient.auth.getUser();
  if (!caller) return json({ error: 'Unauthorized' }, 401);

  const supabase = getServiceClient();
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin access required' }, 403);

  // Build update object — only include provided fields
  const updates: Record<string, any> = {};
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;
  if (persona_type !== undefined) updates.persona_type = persona_type;
  if (plan_type !== undefined) {
    updates.plan_type = plan_type;
    // Sync subscription_status with plan: paid plans → 'active', free → null.
    // Required by CreditsContext (isAgencyPro/Premium check both fields).
    const isPaidPlan = ['agency_pro', 'agency_premium'].includes(plan_type);
    updates.subscription_status = isPaidPlan ? 'active' : null;
    if (!isPaidPlan) {
      updates.stripe_subscription_id = null;
      updates.subscription_expires_at = null;
    }
  }
  if (newEmail !== undefined) updates.email = normalizeEmail(newEmail);

  if (Object.keys(updates).length === 0) return json({ error: 'No fields to update' }, 400);

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', target_user_id);

  if (updateError) {
    console.error('Update profile error:', updateError);
    return json({ error: updateError.message }, 500);
  }

  // Also update auth email if changed
  if (newEmail) {
    await supabase.auth.admin.updateUserById(target_user_id, {
      email: normalizeEmail(newEmail),
    });
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
      case 'check-email':           return await handleCheckEmail(body);
      case 'send-code':             return await handleSendCode(body);
      case 'verify-code':           return await handleVerifyCode(body);
      case 'reset-password':        return await handleResetPassword(body);
      case 'delete-user':           return await handleDeleteUser(body, req);
      case 'request-sdk-toggle':    return await handleRequestSdkToggle(body, req);
      case 'confirm-sdk-toggle':    return await handleConfirmSdkToggle(body, req);
      case 'list-pending-users':    return await handleListPendingUsers(req);
      case 'confirm-user':          return await handleConfirmUser(body, req);
      case 'create-user':           return await handleCreateUser(body, req);
      case 'update-user-profile':   return await handleUpdateUserProfile(body, req);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('auth-actions error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
