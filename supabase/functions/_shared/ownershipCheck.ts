/**
 * Ownership verification for injection operations.
 * Prevents a user from injecting code into a site they don't own.
 * Logs abuse attempts to injection_abuse_logs.
 */

interface OwnershipResult {
  allowed: boolean;
  siteOwnerId?: string;
  reason?: string;
}

/**
 * Verify that the requesting user owns the target tracked_site.
 * If mismatch, logs to injection_abuse_logs and returns { allowed: false }.
 */
export async function verifyInjectionOwnership(
  supabase: any,
  userId: string,
  trackedSiteId: string,
  context: {
    scriptType?: string;
    payloadPreview?: string;
    ipAddress?: string;
  } = {}
): Promise<OwnershipResult> {
  // Fetch site ownership
  const { data: site, error } = await supabase
    .from('tracked_sites')
    .select('id, user_id, domain')
    .eq('id', trackedSiteId)
    .single();

  if (error || !site) {
    return { allowed: false, reason: 'Site not found' };
  }

  // Check ownership
  if (site.user_id === userId) {
    return { allowed: true, siteOwnerId: site.user_id };
  }

  // ── MISMATCH DETECTED ──
  // Log the abuse attempt
  console.warn(`[SECURITY] Injection ownership mismatch: user ${userId} tried to inject into site ${site.domain} owned by ${site.user_id}`);

  await supabase.from('injection_abuse_logs').insert({
    user_id: userId,
    target_domain: site.domain || 'unknown',
    target_site_id: trackedSiteId,
    owner_user_id: site.user_id,
    abuse_type: 'ownership_mismatch',
    script_type: context.scriptType || null,
    script_payload_preview: context.payloadPreview?.substring(0, 500) || null,
    ip_address: context.ipAddress || null,
    request_metadata: {
      timestamp: new Date().toISOString(),
      attempted_action: 'inject_code',
    },
  });

  return {
    allowed: false,
    siteOwnerId: site.user_id,
    reason: 'Ownership mismatch — you are not the owner of this site',
  };
}

/**
 * Verify that a GTM container key matches the expected owner.
 * Cross-references the api_key from tracked_sites with the requesting user.
 */
export async function verifyGtmOwnership(
  supabase: any,
  userId: string,
  domain: string,
  context: {
    scriptType?: string;
    ipAddress?: string;
  } = {}
): Promise<OwnershipResult> {
  // Find all tracked_sites for this domain
  const { data: sites } = await supabase
    .from('tracked_sites')
    .select('id, user_id, domain, api_key')
    .ilike('domain', `%${domain.replace(/^www\./, '')}%`);

  if (!sites || sites.length === 0) {
    return { allowed: true, reason: 'No tracked site found — first claim' };
  }

  // Check if the requesting user owns at least one tracked_site for this domain
  const ownedSite = sites.find((s: any) => s.user_id === userId);
  if (ownedSite) {
    return { allowed: true, siteOwnerId: userId };
  }

  // Another user already tracks this domain
  const actualOwner = sites[0];
  console.warn(`[SECURITY] GTM ownership conflict: user ${userId} vs owner ${actualOwner.user_id} for domain ${domain}`);

  await supabase.from('injection_abuse_logs').insert({
    user_id: userId,
    target_domain: domain,
    target_site_id: actualOwner.id,
    owner_user_id: actualOwner.user_id,
    abuse_type: 'gtm_ownership_conflict',
    script_type: context.scriptType || 'gtm_injection',
    ip_address: context.ipAddress || null,
    request_metadata: {
      timestamp: new Date().toISOString(),
      attempted_action: 'inject_via_gtm',
      domain_already_tracked_by: actualOwner.user_id,
    },
  });

  return {
    allowed: false,
    siteOwnerId: actualOwner.user_id,
    reason: 'This domain is already managed by another account',
  };
}
