import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Unauthorized', 401);
    }

    const anonClient = getUserClient(authHeader);
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonError('Invalid token', 401);
    }

    const userId = claimsData.claims.sub;

    // Parse body
    const body = await req.json();
    const { domain, json_ld, meta_tags, robots_rules, corrective_script } = body;

    if (!domain || typeof domain !== 'string' || domain.length < 3) {
      return jsonError('Missing or invalid domain', 400);
    }

    const cleanDomain = domain.replace(/[^a-zA-Z0-9.\-]/g, '').toLowerCase();
    const supabase = getServiceClient();

    // Verify user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, credits_balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonError('Profile not found', 404);
    }

    // Update the latest audit with the new config data
    const { data: latestAudit, error: auditFetchError } = await supabase
      .from('audits')
      .select('id, audit_data')
      .eq('user_id', userId)
      .eq('domain', cleanDomain)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditFetchError) {
      return jsonError('Error fetching audit', 500);
    }

    // Build updated audit_data
    const existingAuditData = (latestAudit?.audit_data as Record<string, unknown>) || {};
    const updatedAuditData = {
      ...existingAuditData,
      ...(json_ld !== undefined && { json_ld }),
      ...(meta_tags !== undefined && { meta_tags }),
      ...(robots_rules !== undefined && { robots_rules }),
      wp_sync_updated_at: new Date().toISOString(),
    };

    if (latestAudit) {
      const { error: updateError } = await supabase
        .from('audits')
        .update({ 
          audit_data: updatedAuditData,
          ...(corrective_script ? { generated_code: corrective_script } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', latestAudit.id);

      if (updateError) {
        return jsonError('Error updating audit', 500);
      }
    } else {
      const { error: insertError } = await supabase
        .from('audits')
        .insert({
          user_id: userId,
          domain: cleanDomain,
          url: `https://${cleanDomain}`,
          audit_data: updatedAuditData,
          ...(corrective_script ? { generated_code: corrective_script } : {}),
        });

      if (insertError) {
        return jsonError('Error creating audit record', 500);
      }
    }

    // Also persist current_config to tracked_sites for the matching domain
    const configPayload = {
      ...(json_ld !== undefined && { json_ld }),
      ...(meta_tags !== undefined && { meta_tags }),
      ...(robots_rules !== undefined && { robots_rules }),
      ...(corrective_script ? { corrective_script } : {}),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('tracked_sites')
      .update({ current_config: configPayload })
      .eq('user_id', userId)
      .eq('domain', cleanDomain);

    return jsonOk({
        success: true,
        domain: cleanDomain,
        message: 'Configuration updated. WordPress plugin will sync automatically.',
      });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ update-config error:', error);
    return jsonError('Internal server error', details: errorMessage, 500);
  }
}));