/**
 * ingest-seasonal-context — Dynamic seasonal context ingestion
 * 
 * Two modes:
 *   1. "cron" — Weekly scan: finds uncovered sectors in tracked_sites, generates events via LLM
 *   2. "on-demand" — Triggered when a new sector is detected, enriches for that sector only
 */
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { trackTokenUsage } from '../_shared/logAIUsage.ts'

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const MODEL = 'google/gemini-2.5-flash'

interface SeasonalEvent {
  event_name: string
  event_type: 'calendar' | 'seasonal' | 'sectorial' | 'trend'
  description: string
  sectors: string[]
  geo_zones: string[]
  start_month: number
  start_day: number
  end_month: number
  end_day: number
  prep_weeks_before: number
  peak_keywords: string[]
  impact_level: 'high' | 'medium' | 'low'
}

async function generateSectorEvents(sector: string, geo: string = 'FR'): Promise<SeasonalEvent[]> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  if (!lovableKey) {
    console.warn('[ingest-seasonal] No LOVABLE_API_KEY, skipping LLM generation')
    return []
  }

  const now = new Date()
  const currentMonth = now.toLocaleString('fr-FR', { month: 'long' })

  const prompt = `Tu es un expert en marketing saisonnier et SEO. 
Pour le secteur "${sector}" en zone géographique "${geo}", génère les événements saisonniers importants de l'année.

Nous sommes en ${currentMonth} ${now.getFullYear()}.

Pour chaque événement, donne :
- event_name: nom court
- event_type: "calendar" (date fixe), "seasonal" (période large), "sectorial" (spécifique au métier), ou "trend" (tendance émergente)
- description: 1 phrase explicative
- sectors: tableau de secteurs concernés (inclure "${sector}")
- geo_zones: ["${geo}"]
- start_month, start_day, end_month, end_day: période (1-12 pour mois, 1-31 pour jour)
- prep_weeks_before: semaines de préparation SEO recommandées (4-12)
- peak_keywords: 3-6 mots-clés de recherche associés
- impact_level: "high", "medium" ou "low"

Génère entre 4 et 8 événements pertinents. 
Inclus à la fois les événements universels adaptés au secteur ET les événements spécifiques au métier.
Ne génère PAS les événements trop génériques (Noël, Black Friday) sauf s'ils ont un angle sectoriel unique.

Réponds UNIQUEMENT en JSON valide : { "events": [...] }`

  try {
    const resp = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'Tu es un expert en marketing saisonnier. Réponds uniquement en JSON valide.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!resp.ok) {
      console.error(`[ingest-seasonal] LLM error: ${resp.status}`)
      return []
    }

    const data = await resp.json()
    trackTokenUsage('ingest-seasonal-context', MODEL, data.usage)

    const raw = data.choices?.[0]?.message?.content || ''
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    
    return (parsed.events || []).filter((e: any) =>
      e.event_name && e.start_month && e.start_day && e.end_month && e.end_day
    )
  } catch (err) {
    console.error('[ingest-seasonal] LLM call failed:', err)
    return []
  }
}

Deno.serve(handleRequest(async (req) => {
  const sb = getServiceClient()
  const body = await req.json().catch(() => ({}))
  const mode = body.mode || 'cron' // 'cron' | 'on-demand'
  const targetSector = body.sector || null
  const geo = body.geo || 'FR'

  if (mode === 'on-demand' && !targetSector) {
    return jsonError('sector is required for on-demand mode', 400)
  }

  let sectorsToProcess: string[] = []

  if (mode === 'on-demand') {
    sectorsToProcess = [targetSector]
  } else {
    // Cron mode: find all unique sectors in tracked_sites that are NOT yet covered
    const { data: sites } = await sb
      .from('tracked_sites')
      .select('market_sector')
      .not('market_sector', 'is', null)

    const allSectors = [...new Set(
      (sites || [])
        .map((s: any) => s.market_sector?.toLowerCase()?.trim())
        .filter(Boolean)
    )] as string[]

    // Get sectors already covered in seasonal_context
    const { data: existingEvents } = await sb
      .from('seasonal_context')
      .select('sectors')

    const coveredSectors = new Set<string>()
    for (const ev of existingEvents || []) {
      for (const s of (ev.sectors || [])) {
        coveredSectors.add(s.toLowerCase().trim())
      }
    }

    // Filter to uncovered sectors
    sectorsToProcess = allSectors.filter(s => !coveredSectors.has(s))

    if (sectorsToProcess.length === 0) {
      console.log('[ingest-seasonal] All sectors covered, nothing to do')
      return jsonOk({ message: 'All sectors already covered', sectors_checked: allSectors.length })
    }

    // Limit to 5 sectors per cron run to control LLM costs
    sectorsToProcess = sectorsToProcess.slice(0, 5)
  }

  console.log(`[ingest-seasonal] Processing ${sectorsToProcess.length} sector(s): ${sectorsToProcess.join(', ')}`)

  let totalInserted = 0
  let totalSkipped = 0
  const errors: string[] = []

  for (const sector of sectorsToProcess) {
    try {
      const events = await generateSectorEvents(sector, geo)
      
      for (const event of events) {
        // Deduplicate: skip if event with same name + overlapping sectors already exists
        const { data: existing } = await sb
          .from('seasonal_context')
          .select('id')
          .eq('event_name', event.event_name)
          .contains('sectors', [sector])
          .limit(1)

        if (existing && existing.length > 0) {
          totalSkipped++
          continue
        }

        const { error: insertErr } = await sb.from('seasonal_context').insert({
          event_name: event.event_name,
          event_type: event.event_type || 'sectorial',
          description: event.description || '',
          sectors: event.sectors || [sector],
          geo_zones: event.geo_zones || [geo],
          start_month: event.start_month,
          start_day: event.start_day,
          end_month: event.end_month,
          end_day: event.end_day,
          prep_weeks_before: event.prep_weeks_before || 6,
          peak_keywords: event.peak_keywords || [],
          impact_level: event.impact_level || 'medium',
          is_recurring: true,
          source: 'ai',
        })

        if (insertErr) {
          console.warn(`[ingest-seasonal] Insert error for ${event.event_name}:`, insertErr.message)
          totalSkipped++
        } else {
          totalInserted++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${sector}: ${msg}`)
    }
  }

  // Log analytics
  await sb.from('analytics_events').insert({
    event_type: 'ingest-seasonal-context',
    event_data: {
      mode,
      sectors_processed: sectorsToProcess,
      inserted: totalInserted,
      skipped: totalSkipped,
      errors: errors.length,
    },
  }).catch(() => {})

  return jsonOk({
    mode,
    sectors_processed: sectorsToProcess,
    inserted: totalInserted,
    skipped: totalSkipped,
    errors: errors.length > 0 ? errors : undefined,
  })
}))
