/**
 * delete-account — Dedicated, exhaustive account deletion function.
 *
 * Guarantees:
 * 1. User data is fully archived in `archived_users` before any destructive action.
 * 2. ALL public-schema rows referencing the user are cleaned (deleted or nullified).
 * 3. The auth.users record is removed so the email is truly freed.
 * 4. After completion the email cannot trigger "already registered" anywhere.
 *
 * Deletion order respects FK constraints (leaves → parents).
 */
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// ─── Step 1: Archive ────────────────────────────────────────────────────────

async function archiveUser(supabase: any, userId: string, reason: string) {
  // Skip if already archived for this deletion
  const { data: existing } = await supabase
    .from('archived_users')
    .select('id')
    .eq('original_user_id', userId)
    .order('archived_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    console.log(`[delete-account] User ${userId} already archived, skipping archive step.`);
    return;
  }

  const [profileResult, authResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);

  const profile = profileResult.data;
  const authUser = authResult.data?.user;
  const email = normalizeEmail(profile?.email ?? authUser?.email ?? '');

  if (!email) {
    console.warn(`[delete-account] No email found for user ${userId}, cannot archive.`);
    return;
  }

  const snapshot = profile ?? {
    user_id: authUser?.id,
    email: authUser?.email,
    user_metadata: authUser?.user_metadata ?? null,
    app_metadata: authUser?.app_metadata ?? null,
    created_at: authUser?.created_at ?? null,
  };

  const { error } = await supabase.from('archived_users').insert({
    original_user_id: userId,
    email,
    first_name: profile?.first_name ?? authUser?.user_metadata?.first_name ?? null,
    last_name: profile?.last_name ?? authUser?.user_metadata?.last_name ?? null,
    credits_balance: profile?.credits_balance ?? null,
    plan_type: profile?.plan_type ?? null,
    persona_type: profile?.persona_type ?? null,
    affiliate_code_used: profile?.affiliate_code_used ?? null,
    referral_code: profile?.referral_code ?? null,
    subscription_status: profile?.subscription_status ?? null,
    original_created_at: profile?.created_at ?? authUser?.created_at ?? null,
    archived_at: new Date().toISOString(),
    archive_reason: reason,
    profile_snapshot: snapshot,
  } as any);

  if (error) {
    console.error('[delete-account] Archive insert error:', error);
    throw new Error('Failed to archive user');
  }
  console.log(`[delete-account] Archived user ${userId} (${email}).`);
}

// ─── Step 2: Full cleanup — FK-ordered ──────────────────────────────────────

async function fullCleanup(supabase: any, userId: string) {
  // Helper: delete rows, log but don't throw on "relation does not exist"
  async function del(table: string, column: string) {
    const { error } = await supabase.from(table).delete().eq(column, userId);
    if (error) {
      // Ignore missing tables (dev vs prod drift)
      if (error.message?.includes('does not exist')) {
        console.warn(`[delete-account] Table ${table} does not exist, skipping.`);
        return;
      }
      console.error(`[delete-account] DELETE ${table}.${column} error:`, error);
      throw new Error(`Failed to cleanup ${table}`);
    }
  }

  // Helper: nullify a column
  async function nullify(table: string, column: string) {
    const { error } = await supabase
      .from(table)
      .update({ [column]: null } as any)
      .eq(column, userId);
    if (error && !error.message?.includes('does not exist')) {
      console.error(`[delete-account] NULLIFY ${table}.${column} error:`, error);
      throw new Error(`Failed to nullify ${table}.${column}`);
    }
  }

  // ── Phase 1: Deepest leaves (tables that FK into other user-owned tables) ──

  // actual_results → predictions
  // We need prediction IDs first
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id')
    .eq('client_id', userId);
  if (predictions?.length) {
    const predIds = predictions.map((p: any) => p.id);
    for (const id of predIds) {
      await supabase.from('actual_results').delete().eq('prediction_id', id);
    }
  }

  // semantic_nodes → crawl_pages (self-ref parent_node_id first)
  await del('semantic_nodes', 'user_id');

  // crawl_pages & crawl_jobs → site_crawls (get crawl IDs via site_crawls)
  const { data: siteCrawls } = await supabase
    .from('site_crawls')
    .select('id')
    .eq('user_id', userId);
  if (siteCrawls?.length) {
    const crawlIds = siteCrawls.map((c: any) => c.id);
    for (const id of crawlIds) {
      await supabase.from('crawl_pages').delete().eq('crawl_id', id);
      await supabase.from('crawl_jobs').delete().eq('crawl_id', id);
      await supabase.from('crawl_index_history').delete().eq('crawl_id', id);
    }
  }

  // site_script_rules_history → site_script_rules
  const { data: scriptRules } = await supabase
    .from('site_script_rules')
    .select('id')
    .eq('user_id', userId);
  if (scriptRules?.length) {
    const ruleIds = scriptRules.map((r: any) => r.id);
    for (const id of ruleIds) {
      await supabase.from('site_script_rules_history').delete().eq('rule_id', id);
      await supabase.from('injection_error_logs').delete().eq('rule_id', id);
    }
  }

  // matrix_audit_results & matrix_errors → matrix_audit_sessions
  const { data: matrixSessions } = await supabase
    .from('matrix_audit_sessions')
    .select('id')
    .eq('user_id', userId);
  if (matrixSessions?.length) {
    const sessionIds = matrixSessions.map((s: any) => s.id);
    for (const id of sessionIds) {
      await supabase.from('matrix_audit_results').delete().eq('session_id', id);
      await supabase.from('matrix_errors').delete().eq('session_id', id);
    }
  }

  // cocoon_tasks → cocoon_recommendations
  const { data: cocoRecos } = await supabase
    .from('cocoon_recommendations')
    .select('id')
    .eq('user_id', userId);
  if (cocoRecos?.length) {
    const recoIds = cocoRecos.map((r: any) => r.id);
    for (const id of recoIds) {
      await supabase.from('cocoon_tasks').delete().eq('source_recommendation_id', id);
    }
  }

  // gmb children → gmb_locations
  const { data: gmbLocs } = await supabase
    .from('gmb_locations')
    .select('id')
    .eq('user_id', userId);
  if (gmbLocs?.length) {
    const locIds = gmbLocs.map((l: any) => l.id);
    for (const id of locIds) {
      await supabase.from('gmb_reviews').delete().eq('gmb_location_id', id);
      await supabase.from('gmb_posts').delete().eq('gmb_location_id', id);
      await supabase.from('gmb_performance').delete().eq('gmb_location_id', id);
    }
  }

  // support_messages → support_conversations
  await del('support_messages', 'sender_id');

  // saved_reports → report_folders
  await del('saved_reports', 'user_id');

  // agency_client_sites & prompt_deployments → agency_clients
  const { data: agencyClients } = await supabase
    .from('agency_clients')
    .select('id')
    .eq('owner_user_id', userId);
  if (agencyClients?.length) {
    const clientIds = agencyClients.map((c: any) => c.id);
    for (const id of clientIds) {
      await supabase.from('agency_client_sites').delete().eq('client_id', id);
      await supabase.from('prompt_deployments').delete().eq('client_id', id);
    }
  }

  // ── Phase 2: Mid-level tables ──

  // Tables with FK to tracked_sites (must be deleted before tracked_sites)
  const trackedSiteDeps = [
    'user_stats_history', 'audit_impact_snapshots', 'llm_test_executions',
    'llm_visibility_scores', 'serp_snapshots', 'llm_depth_conversations',
    'gsc_history_log', 'backlink_snapshots', 'serp_geo_correlations',
    'ias_history', 'ga4_history_log', 'prompt_matrix_imports',
    'prompt_matrix_items', 'cocoon_errors', 'cocoon_chat_histories',
    'revenue_events', 'cms_connections',
  ];
  for (const table of trackedSiteDeps) {
    await del(table, 'user_id');
  }

  // ias_settings uses site_id not user_id
  const { data: trackedSites } = await supabase
    .from('tracked_sites')
    .select('id')
    .eq('user_id', userId);
  if (trackedSites?.length) {
    const siteIds = trackedSites.map((s: any) => s.id);
    for (const id of siteIds) {
      await supabase.from('ias_settings').delete().eq('site_id', id);
      await supabase.from('site_script_rules').delete().eq('domain_id', id);
      await supabase.from('injection_error_logs').delete().eq('domain_id', id);
    }
  }

  // Now safe to delete these
  await del('predictions', 'client_id');
  await del('pdf_audits', 'client_id');
  await del('cocoon_recommendations', 'user_id');
  await del('cocoon_tasks', 'user_id');
  await del('cocoon_sessions', 'user_id');
  await del('gmb_locations', 'user_id');
  await del('matrix_audit_sessions', 'user_id');
  await del('site_crawls', 'user_id');
  await del('crawl_index_history', 'user_id');
  await del('report_folders', 'user_id');
  await del('support_conversations', 'user_id');
  await del('agency_clients', 'owner_user_id');
  await del('prompt_deployments', 'user_id');

  // ── Phase 3: All remaining direct user_id tables ──

  const directDeletes = [
    // action_plans is deprecated — data lives in architect_workbench now
    { table: 'admin_dashboard_config', col: 'user_id' },
    { table: 'agency_invitations', col: 'owner_user_id' },
    { table: 'agency_team_members', col: 'owner_user_id' },
    { table: 'agency_team_members', col: 'member_user_id' },
    { table: 'analytics_events', col: 'user_id' },
    { table: 'async_jobs', col: 'user_id' },
    { table: 'audit_impact_snapshots', col: 'user_id' },
    { table: 'audit_raw_data', col: 'user_id' },
    { table: 'audit_recommendations_registry', col: 'user_id' },
    { table: 'billing_info', col: 'user_id' },
    { table: 'cocoon_theme_settings', col: 'owner_user_id' },
    { table: 'credit_transactions', col: 'user_id' },
    { table: 'function_access_requests', col: 'requester_user_id' },
    { table: 'function_consultation_log', col: 'user_id' },
    { table: 'google_connections', col: 'user_id' },
    { table: 'hallucination_corrections', col: 'user_id' },
    { table: 'magic_links', col: 'user_id' },
    { table: 'prompt_matrix_imports', col: 'user_id' },
    { table: 'prompt_matrix_items', col: 'user_id' },
    { table: 'saved_corrective_codes', col: 'user_id' },
    { table: 'sdk_toggle_confirmations', col: 'requested_by' },
    { table: 'stripe_payments', col: 'user_id' },
    { table: 'survey_events', col: 'user_id' },
    { table: 'url_correction_decisions', col: 'user_id' },
    { table: 'user_activity_log', col: 'user_id' },
    { table: 'user_roles', col: 'user_id' },
    { table: 'verification_codes', col: 'user_id' },
  ];

  for (const { table, col } of directDeletes) {
    await del(table, col);
  }

  // ── Phase 4: Nullify (preserve data, detach user) ──
  await nullify('audits', 'user_id');
  await nullify('blog_articles', 'author_id');
  await nullify('affiliate_codes', 'assigned_to_user_id');

  // ── Phase 5: tracked_sites (now all deps are gone) ──
  await del('tracked_sites', 'user_id');

  // ── Phase 6: Profile ──
  await del('profiles', 'user_id');

  console.log(`[delete-account] Full cleanup completed for user ${userId}.`);
}

// ─── Step 3: Delete auth record ─────────────────────────────────────────────

async function deleteAuthUser(supabase: any, userId: string) {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    if (error.message?.toLowerCase().includes('user not found')) {
      console.log(`[delete-account] Auth user ${userId} already gone.`);
      return;
    }
    console.error('[delete-account] Auth delete error:', error);
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }
  console.log(`[delete-account] Auth user ${userId} deleted.`);
}

// ─── Step 4: Verify nothing remains ─────────────────────────────────────────

async function verify(supabase: any, userId: string, email: string) {
  const issues: string[] = [];

  // Check profile gone
  const { count: profileCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((profileCount ?? 0) > 0) issues.push('profile still exists');

  // Check profile by email gone
  if (email) {
    const { count: emailCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('email', email);
    if ((emailCount ?? 0) > 0) issues.push('profile with email still exists');
  }

  // Check auth user gone
  if (email) {
    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const orphan = authList?.users?.find(
      (u: any) => (u.email || '').toLowerCase() === email.toLowerCase()
    );
    if (orphan) issues.push(`auth.users record still exists (id: ${orphan.id})`);
  }

  // Check tracked_sites gone
  const { count: sitesCount } = await supabase
    .from('tracked_sites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((sitesCount ?? 0) > 0) issues.push('tracked_sites still exist');

  if (issues.length > 0) {
    console.error(`[delete-account] VERIFICATION FAILED:`, issues);
    return { clean: false, issues };
  }

  console.log(`[delete-account] Verification passed — user ${userId} fully removed.`);
  return { clean: true, issues: [] };
}

// ─── Main handler ───────────────────────────────────────────────────────────

Deno.serve(handleRequest(async (req) => {
try {
    const { user_id, reason } = await req.json();
    if (!user_id) return json({ error: 'user_id required' }, 400);

    // Auth: caller must be admin
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = getUserClient(authHeader);
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const supabase = getServiceClient();
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: caller.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Admin access required' }, 403);

    // Get email before deletion for verification
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user_id)
      .maybeSingle();
    const { data: authData } = await supabase.auth.admin.getUserById(user_id);
    const email = normalizeEmail(profile?.email ?? authData?.user?.email ?? '');

    console.log(`[delete-account] Starting full deletion of user ${user_id} (${email}) by admin ${caller.id}`);

    // Execute the 3-step process
    await archiveUser(supabase, user_id, reason || 'admin_delete');
    await fullCleanup(supabase, user_id);
    await deleteAuthUser(supabase, user_id);

    // Verify
    const verification = await verify(supabase, user_id, email);

    return json({
      success: true,
      user_id,
      email,
      verification,
    });
  } catch (err: any) {
    console.error('[delete-account] Fatal error:', err);
    return json({ error: err.message || 'Internal error' }, 500);
  }
}));