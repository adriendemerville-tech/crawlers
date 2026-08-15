/**
 * gscQuery.ts — Accès Search Console mutualisé pour les signaux Breathing Spiral
 *
 * Un seul point d'entrée pour :
 *  - résoudre la propriété GSC vérifiée qui couvre un domaine (sc-domain ou URL-prefix)
 *  - interroger searchAnalytics sur une plage de dates
 *
 * Les utilisateurs sans connexion Google sont simplement ignorés (retour null) :
 * aucun signal n'est inventé en l'absence de données.
 */
import { resolveGoogleToken } from './resolveGoogleToken.ts'

export interface GscRow {
  query: string
  position: number
  clicks: number
  impressions: number
  ctr: number
  date?: string
}

export interface GscAccess {
  accessToken: string
  siteUrl: string
}

const propertyCache = new Map<string, string>()

/**
 * Résout token + propriété GSC pour un (user, domain).
 * Retourne null si pas de connexion Google ou aucune propriété vérifiée couvrant le domaine.
 */
export async function resolveGscAccess(
  supabase: any,
  userId: string,
  domain: string,
): Promise<GscAccess | null> {
  const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null

  const resolved = await resolveGoogleToken(supabase, userId, domain, clientId, clientSecret)
  if (!resolved?.access_token) return null

  const bare = domain.replace(/^www\./, '').toLowerCase()
  const cacheKey = `${userId}:${bare}`
  const cached = propertyCache.get(cacheKey)
  if (cached) return { accessToken: resolved.access_token, siteUrl: cached }

  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${resolved.access_token}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    console.warn(`[gscQuery] liste des propriétés indisponible pour ${bare} (${res.status})`)
    return null
  }

  const { siteEntry = [] } = await res.json()
  const verified = siteEntry.filter((s: any) => s.permissionLevel !== 'siteUnverifiedUser')

  // 1) Domain property, 2) URL-prefix https/www, 3) tout prefix couvrant l'hôte
  const domainProp = verified.find((s: any) => String(s.siteUrl).toLowerCase() === `sc-domain:${bare}`)
  const prefixProp = verified.find((s: any) => {
    const su = String(s.siteUrl).toLowerCase()
    if (su.startsWith('sc-domain:')) return false
    const host = su.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
    return host === bare
  })

  const siteUrl = domainProp?.siteUrl || prefixProp?.siteUrl
  if (!siteUrl) {
    console.warn(`[gscQuery] aucune propriété vérifiée pour ${bare}`)
    return null
  }

  propertyCache.set(cacheKey, siteUrl)
  return { accessToken: resolved.access_token, siteUrl }
}

/** Interroge searchAnalytics et normalise les lignes. */
export async function queryGscRows(
  access: GscAccess,
  opts: {
    startDate: string
    endDate: string
    dimensions?: string[]
    rowLimit?: number
    country?: string | null
  },
): Promise<GscRow[]> {
  const dimensions = opts.dimensions ?? ['query']
  const body: Record<string, unknown> = {
    startDate: opts.startDate,
    endDate: opts.endDate,
    dimensions,
    rowLimit: opts.rowLimit ?? 1000,
  }
  if (opts.country) {
    body.dimensionFilterGroups = [{ filters: [{ dimension: 'country', expression: opts.country }] }]
  }

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(access.siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn(`[gscQuery] searchAnalytics ${res.status} sur ${access.siteUrl}: ${text.slice(0, 200)}`)
    return []
  }

  const data = await res.json()
  const dateIndex = dimensions.indexOf('date')
  const queryIndex = dimensions.indexOf('query')

  return (data.rows || []).map((row: any) => ({
    query: queryIndex >= 0 ? String(row.keys[queryIndex]) : '',
    date: dateIndex >= 0 ? String(row.keys[dateIndex]) : undefined,
    position: Math.round((row.position || 0) * 100) / 100,
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Math.round((row.ctr || 0) * 10000) / 100,
  }))
}

/** GSC a ~2 jours de latence : la fenêtre utile s'arrête à J-2. */
export function gscWindow(days: number): { startDate: string; endDate: string } {
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 2)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1))
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}
