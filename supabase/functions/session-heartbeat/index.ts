import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkIpRate, getClientIp, rateLimitResponse } from '../_shared/ipRateLimiter.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: session-heartbeat
 * 
 * Called every 4 minutes by the client.
 * Enforces fair-use: 1 active IP per user seat.
 * 
 * - Owner only → 1 IP max
 * - Owner + N collaborators → 1 + N IPs max
 * 
 * If a new IP connects, older sessions on different IPs are kicked.
 * Returns { active: true/false, kicked: boolean }
 */

Deno.serve(handleRequest(async (req) => {
const ip = getClientIp(req);
  const rateCheck = checkIpRate(ip, 'session-heartbeat', 20, 60_000);
  if (!rateCheck.allowed) return rateLimitResponse(corsHeaders, rateCheck.retryAfterMs);

  try {
    const supabase = getServiceClient();

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonError('Non autorisé', 401);
    }
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return jsonError('Non autorisé', 401);
    }

    const body = await req.json().catch(() => ({}));
    const sessionToken = body.session_token;
    const userAgent = req.headers.get('user-agent') || '';

    if (!sessionToken) {
      return jsonError('session_token requis', 400);
    }

    // Auto-save workspace state if provided (before potential kick)
    if (body.autosave && body.autosave.workspace_type && body.autosave.workspace_key) {
      await supabase
        .from('workspace_autosaves')
        .upsert({
          user_id: user.id,
          tracked_site_id: body.autosave.tracked_site_id || null,
          workspace_type: body.autosave.workspace_type,
          workspace_key: body.autosave.workspace_key,
          state_data: body.autosave.state_data || {},
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,workspace_type,workspace_key' });
    }

    // Cleanup stale sessions first
    await supabase.rpc('cleanup_stale_sessions');

    // Get max allowed sessions for this user
    const { data: maxSessions } = await supabase.rpc('get_max_sessions', { p_user_id: user.id });
    const maxIps = maxSessions || 1;

    // Get all active sessions for this user
    const { data: activeSessions } = await supabase
      .from('user_sessions')
      .select('id, ip_address, session_token, last_heartbeat_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_heartbeat_at', { ascending: false });

    const sessions = activeSessions || [];

    // Check if this session_token already exists
    const existingSession = sessions.find(s => s.session_token === sessionToken);

    if (existingSession) {
      // Update heartbeat for existing session
      await supabase
        .from('user_sessions')
        .update({ last_heartbeat_at: new Date().toISOString(), ip_address: ip })
        .eq('id', existingSession.id);

      return jsonOk({
        active: true,
        kicked: false,
        active_sessions: sessions.length,
        max_sessions: maxIps,
      });
    }

    // New session — count distinct active IPs
    const distinctIps = new Set(sessions.map(s => s.ip_address));
    
    // If this IP is already in use by another session of this user, just add
    const ipAlreadyActive = distinctIps.has(ip);

    if (!ipAlreadyActive && distinctIps.size >= maxIps) {
      // Need to kick oldest sessions on different IPs to make room
      // Sort by oldest heartbeat, kick sessions until we have room
      const sessionsToKick = sessions
        .filter(s => s.ip_address !== ip)
        .sort((a, b) => new Date(a.last_heartbeat_at).getTime() - new Date(b.last_heartbeat_at).getTime());

      // Kick enough sessions to free one IP slot
      const ipsToFree = distinctIps.size - maxIps + 1;
      const ipsFreed = new Set<string>();
      const kickIds: string[] = [];

      for (const s of sessionsToKick) {
        if (ipsFreed.size >= ipsToFree) break;
        kickIds.push(s.id);
        ipsFreed.add(s.ip_address);
      }

      if (kickIds.length > 0) {
        await supabase
          .from('user_sessions')
          .update({ is_active: false, kicked_reason: 'new_ip_connected' })
          .in('id', kickIds);
      }
    }

    // Register new session
    await supabase
      .from('user_sessions')
      .upsert({
        user_id: user.id,
        session_token: sessionToken,
        ip_address: ip,
        user_agent: userAgent.slice(0, 500),
        last_heartbeat_at: new Date().toISOString(),
        is_active: true,
        kicked_reason: null,
      }, { onConflict: 'user_id,session_token' });

    return jsonOk({
      active: true,
      kicked: false,
      active_sessions: Math.min(sessions.length + 1, maxIps),
      max_sessions: maxIps,
      new_session: true,
    });

  } catch (error) {
    console.error('[session-heartbeat] Error:', error);
    return jsonError('Erreur interne', 500);
  }
}));