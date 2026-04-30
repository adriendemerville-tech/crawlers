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

interface RemotePlatformConfig {
  // Used when no static baseUrl (resolved per-site from siteUrl)
  resolveBaseUrl?: (siteUrl: string) => string
  healthPath?: string
  writeProbePath: string
  apiKeyPrefix?: string
  authHeader?: (key: string) => Record<string, string>
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

// Platforms requiring a per-site base URL (no static baseUrl)
const REMOTE_PLATFORM_REGISTRY: Record<string, RemotePlatformConfig> = {
  shopify: {
    resolveBaseUrl: (u) => u.replace(/\/+$/, '') + '/admin/api/2024-10',
    writeProbePath: '/shop.json',
    authHeader: (k) => ({ 'X-Shopify-Access-Token': k }),
    domainHints: ['myshopify.com'],
  },
  wix: {
    resolveBaseUrl: (u) => u.replace(/\/+$/, ''),
    writeProbePath: '/_functions/health',
    authHeader: (k) => ({ Authorization: k }),
    domainHints: ['wixsite.com', 'wix.com'],
  },
  prestashop: {
    resolveBaseUrl: (u) => u.replace(/\/+$/, '') + '/api',
    writeProbePath: '/?output_format=JSON',
    authHeader: (k) => ({ Authorization: 'Basic ' + btoa(k + ':') }),
    domainHints: [],
  },
  drupal: {
    resolveBaseUrl: (u) => u.replace(/\/+$/, ''),
    writeProbePath: '/jsonapi',
    authHeader: (k) => ({ Authorization: 'Basic ' + k }),
    domainHints: [],
  },
  odoo: {
    resolveBaseUrl: (u) => u.replace(/\/+$/, ''),
    writeProbePath: '/web/session/get_session_info',
    authHeader: (k) => ({ Authorization: 'Bearer ' + k }),
    domainHints: [],
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

// ── Generic probe (custom auth header) ──
async function probeRemote(
  baseUrl: string,
  writeProbePath: string,
  headers: Record<string, string>,
  healthPath?: string,
  timeoutMs = 10000,
): Promise<{ healthOk: boolean; writeReady: boolean; healthStatus: number; writeStatus: number }> {
  let healthStatus = 0
  let writeStatus = 0

  if (healthPath) {
    try {
      const r = await fetch(`${baseUrl}${healthPath}`, { signal: AbortSignal.timeout(timeoutMs) })
      healthStatus = r.status
    } catch (_) { /* network */ }
  } else {
    healthStatus = 200 // skip when not provided
  }

  try {
    const r = await fetch(`${baseUrl}${writeProbePath}`, { headers, signal: AbortSignal.timeout(timeoutMs) })
    writeStatus = r.status
  } catch (_) { /* network */ }

  return {
    healthOk: healthStatus === 200,
    writeReady: writeStatus >= 200 && writeStatus < 300,
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

  // ── Auth: required (multi-tenant). Service-role allowed ONLY for mode=env (admin-triggered binding) ──
  const auth = await getAuthenticatedUser(req)
  if (!auth) {
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
    site_url?: string
    mode?: 'manual' | 'reuse_admin' | 'env'
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
  // service-role bypass allowed only for mode=env (admin-triggered server binding)
  const isServiceRole = auth.userId === 'service-role'
  if (isServiceRole && mode !== 'env') {
    return new Response(JSON.stringify({ error: 'service-role only allowed with mode=env' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!isServiceRole && site.user_id !== auth.userId) {
    console.warn(`[cms-register-api-key] User ${auth.userId} attempted to bind site ${trackedSiteId} owned by ${site.user_id}`)
    return new Response(JSON.stringify({ error: 'You do not own this site' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  // Effective owner for the cms_connections row
  const ownerUserId = isServiceRole ? site.user_id : auth.userId

  // ── Resolve platform ──
  const platform = (body.platform || inferPlatformFromDomain(site.domain) || '').toLowerCase()
  const staticCfg = PLATFORM_REGISTRY[platform]
  const remoteCfg = REMOTE_PLATFORM_REGISTRY[platform]
  if (!staticCfg && !remoteCfg) {
    return new Response(JSON.stringify({
      error: `Unsupported platform "${platform}" — known: ${[...Object.keys(PLATFORM_REGISTRY), ...Object.keys(REMOTE_PLATFORM_REGISTRY)].join(', ')}`,
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
  } else if (mode === 'env') {
    if (!auth.isAdmin) {
      return new Response(JSON.stringify({ error: 'env mode requires admin role' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Per-platform env var name (currently only dictadevi)
    const envVarName = platform === 'dictadevi' ? 'DICTADEVI_API_KEY' : ''
    if (!envVarName) {
      return new Response(JSON.stringify({ error: `mode=env not supported for platform "${platform}"` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const envKey = Deno.env.get(envVarName)
    if (!envKey) {
      return new Response(JSON.stringify({ error: `${envVarName} is not configured in edge env` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    apiKey = envKey
  } else {
    apiKey = (body.api_key || '').trim()
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'api_key is required (or use mode=reuse_admin|env)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // ── Resolve baseUrl + auth headers + probe ──
  let baseUrl: string
  let authHeaders: Record<string, string>
  let healthPath: string | undefined
  let writeProbePath: string
  let prefix: string | undefined

  if (staticCfg) {
    baseUrl = staticCfg.baseUrl
    authHeaders = { Authorization: `Bearer ${apiKey}` }
    healthPath = staticCfg.healthPath
    writeProbePath = staticCfg.writeProbePath
    prefix = staticCfg.apiKeyPrefix
  } else {
    const userSiteUrl = (body.site_url || `https://${site.domain}`).trim()
    try {
      const u = new URL(userSiteUrl)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol')
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid site_url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    baseUrl = remoteCfg!.resolveBaseUrl!(userSiteUrl)
    authHeaders = remoteCfg!.authHeader!(apiKey)
    healthPath = remoteCfg!.healthPath
    writeProbePath = remoteCfg!.writeProbePath
    prefix = remoteCfg!.apiKeyPrefix
  }

  // ── Sanity check on prefix ──
  if (prefix && !apiKey.startsWith(prefix)) {
    return new Response(JSON.stringify({
      error: `API key for ${platform} must start with "${prefix}"`,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Probe the remote API ──
  const probe = await probeRemote(baseUrl, writeProbePath, authHeaders, healthPath)
  if (!probe.healthOk) {
    return new Response(JSON.stringify({
      error: `Remote ${healthPath || ''} unreachable (status ${probe.healthStatus})`,
      probe,
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!probe.writeReady) {
    return new Response(JSON.stringify({
      error: `API key rejected by ${platform} (probe ${writeProbePath} → ${probe.writeStatus})`,
      probe,
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Upsert cms_connections ──
  const authMethod = staticCfg ? 'bearer' : (platform === 'prestashop' || platform === 'drupal' ? 'basic' : 'bearer')
  const capabilities = {
    posts: true,
    pages: 'read',
    auth_scheme: authMethod,
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
      auth_method: authMethod,
      api_key: apiKey,
      site_url: baseUrl,
      scopes: ['posts:read', 'posts:write', 'pages:read'],
      status: 'active',
      capabilities,
      managed_by: mode === 'manual' ? 'user' : 'admin',
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
    cms_type: staticCfg ? 'custom_rest' : platform,
    platform,
    base_url: baseUrl,
    auth_type: authMethod,
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
    base_url: baseUrl,
    mode,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
