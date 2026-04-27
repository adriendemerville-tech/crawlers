/**
 * cms-register-api-key
 *
 * Valide une clé API Bearer (ex: dk_… pour Dictadevi) auprès du CMS distant
 * puis l'enregistre dans `cms_connections` (status='active') pour que le
 * bouton « CMS branché » de Mes Sites passe au vert et que les workers
 * back-office (autopilot, copilot, content-architect) disposent d'une
 * connexion vérifiable.
 *
 * Génériquement adapté aux CMS REST custom :
 *   - platform: 'dictadevi' (pour l'instant ; extensible)
 *   - auth_method: 'bearer'
 *   - api_key: stocké en clair (cohérent avec basic_auth_pass / oauth_*)
 *
 * Multi-tenant strict : on déduit user_id de auth.uid() (header Authorization),
 * jamais du body — voir mem://tech/security/multi-tenant-isolation-fr.
 *
 * Modes :
 *   - mode='manual' (défaut)  : { tracked_site_id, api_key, platform? }
 *   - mode='reuse_admin'      : { tracked_site_id, platform? }
 *       Réutilise la clé déjà stockée dans parmenion_targets pour le domaine
 *       (utile pour les admins qui ont déjà seedé la clé côté autopilot).
 */

import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { DICTADEVI_BASE_URL } from '../_shared/domainUtils.ts'

// ── Platform registry (extensible) ──
interface PlatformConfig {
  baseUrl: string
  healthPath: string
  writeProbePath: string
  apiKeyPrefix: string
  domainHints: string[]
}

const PLATFORM_REGISTRY: Record<string, PlatformConfig> = {
  dictadevi: {
    baseUrl: DICTADEVI_BASE_URL,
    healthPath: '/health',
    writeProbePath: '/posts?limit=1',
    apiKeyPrefix: 'dk_',
    domainHints: ['dictadevi'],
  },
}

function inferPlatformFromDomain(domain: string): string | null {
  const d = domain.toLowerCase()
  for (const [name, cfg] of Object.entries(PLATFORM_REGISTRY)) {
    if (cfg.domainHints.some((h) => d.includes(h))) return name
  }
  return null
}

// ── Bearer probe ──
async function probeBearer(
  cfg: PlatformConfig,
  apiKey: string,
  timeoutMs = 10000,
): Promise<{ healthOk: boolean; writeReady: boolean; healthStatus: number; writeStatus: number }> {
  const headers = { Authorization: `Bearer ${apiKey}` }
  const ctrl1 = AbortSignal.timeout(timeoutMs)
  const ctrl2 = AbortSignal.timeout(timeoutMs)

  let healthStatus = 0
  let writeStatus = 0
  try {
    const r = await fetch(`${cfg.baseUrl}${cfg.healthPath}`, { signal: ctrl1 })
    healthStatus = r.status
  } catch (_) { /* network */ }

  try {
    const r = await fetch(`${cfg.baseUrl}${cfg.writeProbePath}`, { headers, signal: ctrl2 })
    writeStatus = r.status
  } catch (_) { /* network */ }

  return {
    healthOk: healthStatus === 200,
    writeReady: writeStatus === 200,
    healthStatus,
    writeStatus,
  }
}

// ── Handler ──
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Auth: required (multi-tenant) ──
  const auth = await getAuthenticatedUser(req)
  if (!auth || auth.userId === 'service-role') {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Parse body ──
  let body: {
    tracked_site_id?: string
    api_key?: string
    platform?: string
    mode?: 'manual' | 'reuse_admin'
  } = {}
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const trackedSiteId = (body.tracked_site_id || '').trim()
  const mode = body.mode || 'manual'
  if (!trackedSiteId) {
    return new Response(JSON.stringify({ error: 'tracked_site_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = getServiceClient()

  // ── Verify ownership of tracked_site (auth.uid() must own it) ──
  const { data: site, error: siteErr } = await supabase
    .from('tracked_sites')
    .select('id, domain, user_id, current_config')
    .eq('id', trackedSiteId)
    .maybeSingle()

  if (siteErr || !site) {
    return new Response(JSON.stringify({ error: 'Site not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (site.user_id !== auth.userId) {
    console.warn(`[cms-register-api-key] User ${auth.userId} attempted to bind site ${trackedSiteId} owned by ${site.user_id}`)
    return new Response(JSON.stringify({ error: 'You do not own this site' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Resolve platform ──
  const platform = (body.platform || inferPlatformFromDomain(site.domain) || '').toLowerCase()
  const cfg = PLATFORM_REGISTRY[platform]
  if (!cfg) {
    return new Response(JSON.stringify({
      error: `Unsupported platform "${platform}" — known: ${Object.keys(PLATFORM_REGISTRY).join(', ')}`,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Resolve API key (manual vs reuse_admin) ──
  let apiKey = ''
  if (mode === 'reuse_admin') {
    if (!auth.isAdmin) {
      return new Response(JSON.stringify({ error: 'reuse_admin mode requires admin role' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    try {
      const { data, error } = await supabase.rpc('get_parmenion_target_api_key', { p_domain: site.domain })
      if (error || !data || typeof data !== 'string') {
        return new Response(JSON.stringify({
          error: `No admin key found in parmenion_targets for "${site.domain}"`,
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      apiKey = data
    } catch (e) {
      return new Response(JSON.stringify({ error: `Lookup failed: ${e instanceof Error ? e.message : String(e)}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } else {
    apiKey = (body.api_key || '').trim()
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'api_key is required (or use mode=reuse_admin)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // ── Sanity check on prefix ──
  if (cfg.apiKeyPrefix && !apiKey.startsWith(cfg.apiKeyPrefix)) {
    return new Response(JSON.stringify({
      error: `API key for ${platform} must start with "${cfg.apiKeyPrefix}"`,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Probe the remote API ──
  const probe = await probeBearer(cfg, apiKey)
  if (!probe.healthOk) {
    return new Response(JSON.stringify({
      error: `Remote /health unreachable (status ${probe.healthStatus})`,
      probe,
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!probe.writeReady) {
    return new Response(JSON.stringify({
      error: `API key rejected by ${platform} (probe ${cfg.writeProbePath} → ${probe.writeStatus})`,
      probe,
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Upsert cms_connections ──
  const capabilities = {
    posts: true,
    pages: 'read',
    auth_scheme: 'bearer',
    bridge: platform === 'dictadevi' ? 'dictadevi-actions' : undefined,
    registered_via: mode,
    last_probe: {
      health_status: probe.healthStatus,
      write_status: probe.writeStatus,
      probed_at: new Date().toISOString(),
    },
  }

  const { error: upsertErr } = await supabase
    .from('cms_connections')
    .upsert({
      user_id: auth.userId,
      tracked_site_id: trackedSiteId,
      platform,
      auth_method: 'bearer',
      api_key: apiKey,
      site_url: cfg.baseUrl,
      scopes: ['posts:read', 'posts:write', 'pages:read'],
      status: 'active',
      capabilities,
      managed_by: mode === 'reuse_admin' ? 'admin' : 'user',
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>, {
      onConflict: 'user_id,tracked_site_id,platform',
    })

  if (upsertErr) {
    console.error('[cms-register-api-key] Upsert failed:', upsertErr)
    return new Response(JSON.stringify({ error: `Failed to save connection: ${upsertErr.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Mirror signature into tracked_sites.current_config (drives the green badge) ──
  const newConfig = {
    ...(site.current_config as Record<string, unknown> | null || {}),
    cms_type: 'custom_rest',
    platform,
    base_url: cfg.baseUrl,
    auth_type: 'bearer',
    bridge: platform === 'dictadevi' ? 'dictadevi-actions' : undefined,
    connected_at: new Date().toISOString(),
  }

  const { error: cfgErr } = await supabase
    .from('tracked_sites')
    .update({ current_config: newConfig })
    .eq('id', trackedSiteId)
    .eq('user_id', auth.userId)

  if (cfgErr) {
    console.warn('[cms-register-api-key] tracked_sites.current_config update failed (non-blocking):', cfgErr)
  }

  return new Response(JSON.stringify({
    success: true,
    platform,
    write_ready: true,
    base_url: cfg.baseUrl,
    mode,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
