/**
 * siteMemory — Shared helper for persistent site-specific memory
 * 
 * Used by Félix (SAV) and Stratège Cocoon to:
 * 1. Read accumulated insights/preferences per tracked site
 * 2. Write new discoveries from conversations & analyses
 * 3. Auto-update identity card fields (hybrid mode)
 * 
 * Memory categories:
 * - preference: user preferences (tone, priorities, deadlines)
 * - insight: AI-discovered facts (competitor info, market position)
 * - objective: stated business goals
 * - context: contextual info (team size, CMS used, budget)
 * - identity: identity card related data
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { writeIdentity, type IdentitySource } from './identityGateway.ts'

// Field classification is now centralized in identityGateway.ts
// CRITICAL_IDENTITY_FIELDS and AUTO_UPDATE_FIELDS are managed there.

export interface MemoryEntry {
  memory_key: string
  memory_value: string
  category: string
  confidence: number
}

export interface IdentityUpdate {
  field_name: string
  value: string
  reason: string
}

/**
 * Get a service-role Supabase client
 */
function getClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

/**
 * Read all memory entries for a tracked site.
 * Returns a formatted string for injection into LLM prompts.
 */
export async function readSiteMemory(
  trackedSiteId: string,
  category?: string,
): Promise<{ entries: MemoryEntry[]; promptSnippet: string }> {
  const sb = getClient()

  let query = sb
    .from('site_memory')
    .select('memory_key, memory_value, category, confidence')
    .eq('tracked_site_id', trackedSiteId)
    .order('category')
    .order('confidence', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query.limit(50)

  if (error || !data?.length) {
    return { entries: [], promptSnippet: '' }
  }

  const entries = data as MemoryEntry[]

  // Group by category for prompt
  const grouped: Record<string, MemoryEntry[]> = {}
  for (const e of entries) {
    if (!grouped[e.category]) grouped[e.category] = []
    grouped[e.category].push(e)
  }

  const categoryLabels: Record<string, string> = {
    preference: '🎯 Préférences utilisateur',
    insight: '💡 Insights découverts',
    objective: '🎪 Objectifs business',
    context: '📋 Contexte',
    identity: '🏢 Identité',
  }

  let promptSnippet = '\n\n# MÉMOIRE PERSISTANTE DU SITE\n'
  for (const [cat, items] of Object.entries(grouped)) {
    promptSnippet += `\n## ${categoryLabels[cat] || cat}\n`
    for (const item of items) {
      promptSnippet += `- **${item.memory_key}**: ${item.memory_value}\n`
    }
  }

  return { entries, promptSnippet }
}

/**
 * Write or update memory entries for a tracked site.
 * Uses upsert on (tracked_site_id, memory_key).
 */
export async function writeSiteMemory(
  trackedSiteId: string,
  userId: string,
  entries: MemoryEntry[],
  source = 'felix',
): Promise<{ written: number; errors: string[] }> {
  const sb = getClient()
  let written = 0
  const errors: string[] = []

  for (const entry of entries) {
    const { error } = await sb
      .from('site_memory')
      .upsert(
        {
          tracked_site_id: trackedSiteId,
          user_id: userId,
          memory_key: entry.memory_key,
          memory_value: entry.memory_value,
          category: entry.category,
          source,
          confidence: entry.confidence,
        },
        { onConflict: 'tracked_site_id,memory_key' },
      )

    if (error) {
      errors.push(`${entry.memory_key}: ${error.message}`)
    } else {
      written++
    }
  }

  return { written, errors }
}

/**
 * Apply identity card updates via the centralized Identity Gateway.
 * Hybrid validation (critical vs minor) is handled by the gateway.
 */
export async function applyIdentityUpdates(
  trackedSiteId: string,
  userId: string,
  updates: IdentityUpdate[],
  source = 'felix',
): Promise<{ autoApplied: string[]; pendingReview: string[] }> {
  // Convert IdentityUpdate[] to flat fields map
  const fields: Record<string, unknown> = {}
  for (const update of updates) {
    fields[update.field_name] = update.value
  }

  const result = await writeIdentity({
    siteId: trackedSiteId,
    fields,
    source: source as IdentitySource,
    userId,
  })

  return {
    autoApplied: result.applied,
    pendingReview: result.pendingReview,
  }
}

/**
 * Extract memory-worthy facts from an LLM response.
 * Returns structured tool call instructions for the LLM.
 */
export function getMemoryExtractionPrompt(): string {
  return `

# MÉMOIRE PERSISTANTE — INSTRUCTIONS
Après chaque échange, si tu découvres une information NOUVELLE et UTILE sur le site ou l'utilisateur, ajoute un bloc JSON à la fin de ta réponse (invisible pour l'utilisateur) :

<!--MEMORY_EXTRACT
{
  "memories": [
    { "key": "objectif_principal", "value": "augmenter le trafic organique de 30% en 6 mois", "category": "objective", "confidence": 0.8 },
    { "key": "concurrent_principal", "value": "semrush.com", "category": "insight", "confidence": 0.9 }
  ],
  "identity_updates": [
    { "field_name": "target_audience", "value": "PME françaises du e-commerce", "reason": "L'utilisateur a précisé sa cible" }
  ]
}
MEMORY_EXTRACT-->

Catégories possibles : preference, insight, objective, context, identity
Confiance : 0.0 à 1.0 (0.5 = déduit, 0.8 = confirmé par l'utilisateur, 1.0 = affirmé explicitement)

N'ajoute ce bloc QUE si tu as découvert quelque chose de nouveau. Ne répète pas ce qui est déjà en mémoire.
IMPORTANT : ce bloc est INVISIBLE pour l'utilisateur, ne le mentionne pas.`
}

/**
 * Parse memory extraction from LLM response.
 * Returns the clean response (without memory block) + extracted data.
 */
export function parseMemoryExtraction(response: string): {
  cleanResponse: string
  memories: MemoryEntry[]
  identityUpdates: IdentityUpdate[]
} {
  const memoryRegex = /<!--MEMORY_EXTRACT\s*([\s\S]*?)\s*MEMORY_EXTRACT-->/
  const match = response.match(memoryRegex)

  const cleanResponse = response.replace(memoryRegex, '').trim()

  if (!match) {
    return { cleanResponse, memories: [], identityUpdates: [] }
  }

  try {
    const parsed = JSON.parse(match[1])
    return {
      cleanResponse,
      memories: (parsed.memories || []) as MemoryEntry[],
      identityUpdates: (parsed.identity_updates || []) as IdentityUpdate[],
    }
  } catch {
    return { cleanResponse, memories: [], identityUpdates: [] }
  }
}

/**
 * Get pending identity card suggestions for a site.
 */
export async function getPendingSuggestions(
  trackedSiteId: string,
): Promise<Array<{ id: string; field_name: string; current_value: string; suggested_value: string; reason: string; source: string }>> {
  const sb = getClient()
  const { data } = await sb
    .from('identity_card_suggestions')
    .select('id, field_name, current_value, suggested_value, reason, source')
    .eq('tracked_site_id', trackedSiteId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)

  return (data || []) as any
}
