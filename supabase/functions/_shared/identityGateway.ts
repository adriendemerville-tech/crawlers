/**
 * identityGateway — Single write point for tracked_sites identity card
 * 
 * ALL writes to identity card fields MUST go through this gateway.
 * It centralizes:
 * - Field validation (only known columns accepted)
 * - Protection of user_manual source (never overwritten by LLM)
 * - Hybrid mode: critical fields → suggestion, minor fields → direct update
 * - Automatic confidence recalculation
 * - Change logging for audit trail
 * 
 * Callers: enrichSiteContext, siteMemory, voice-identity-enrichment,
 *          cocoon-strategist, seasonality-detector, expert-audit, agent-seo, marina, parse-matrix-hybrid
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { calculateConfidence } from './enrichSiteContext.ts'

// ─── Field Registry ─────────────────────────────────────────────────
// These are the ONLY fields that can be written to tracked_sites identity card.
// Any field not listed here is silently rejected.

const CRITICAL_FIELDS = new Set([
  'site_name', 'market_sector', 'entity_type', 'commercial_model',
])

const MINOR_FIELDS = new Set([
  'company_size', 'target_audience', 'commercial_area', 'products_services',
  'media_specialties', 'nonprofit_type', 'address',
  'is_seasonal', 'seasonality_profile', 'founding_year',
  'business_type', 'competitors', 'cms_platform',
  'brand_name', 'primary_language', 'siren_siret',
  'gmb_presence', 'gmb_city', 'social_profiles', 'legal_structure',
  'client_targets', 'jargon_distance',
  'short_term_goal', 'mid_term_goal', 'main_serp_competitor', 'confusion_risk',
  'target_segment', 'primary_use_case', 'location_detail', 'brand_site_url',
  'is_local_business', 'local_schema_status', 'local_schema_audit',
])

const ALL_ALLOWED_FIELDS = new Set([...CRITICAL_FIELDS, ...MINOR_FIELDS])

// Sources that should never be overwritten by LLM auto
const PROTECTED_SOURCES = new Set(['user_manual', 'user_voice'])

export type IdentitySource = 
  | 'llm_auto'       // Auto-enrichment via LLM
  | 'llm_verified'   // LLM re-verified existing data
  | 'user_manual'    // User edited directly
  | 'user_voice'     // User voice input
  | 'felix'          // SAV agent
  | 'stratege'       // Cocoon strategist
  | 'seasonality'    // Seasonality detector
  | 'expert_audit'   // Technical audit
  | 'agent_seo'      // SEO agent
  | 'marina'         // Marina pipeline
  | 'matrix'         // Matrice d'audit
  | 'extension'      // Crawlers Chrome extension
  | 'system'         // System/migration

export interface IdentityWriteRequest {
  siteId: string
  fields: Record<string, unknown>
  source: IdentitySource
  userId?: string
  /** If true, skip hybrid mode and write all fields directly (used by enrichSiteContext for initial fill) */
  forceDirectWrite?: boolean
  /** If true, overwrite even protected sources (use with extreme caution) */
  forceOverwrite?: boolean
}

export interface IdentityWriteResult {
  applied: string[]
  pendingReview: string[]
  rejected: string[]
  confidence: number
}

function getClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

/**
 * Main entry point: write identity card fields through the gateway.
 * 
 * Rules:
 * 1. Only fields in ALL_ALLOWED_FIELDS are accepted
 * 2. If current source is user_manual/user_voice, LLM sources cannot overwrite
 * 3. Critical fields with existing values → identity_card_suggestions (unless forceDirectWrite)
 * 4. Minor fields → direct update
 * 5. Confidence is recalculated after write
 */
export async function writeIdentity(req: IdentityWriteRequest): Promise<IdentityWriteResult> {
  const sb = getClient()
  const applied: string[] = []
  const pendingReview: string[] = []
  const rejected: string[] = []

  // 1. Filter to allowed fields only
  const validFields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(req.fields)) {
    if (!ALL_ALLOWED_FIELDS.has(key)) {
      rejected.push(key)
      continue
    }
    if (value === null || value === undefined || value === '') continue
    validFields[key] = value
  }

  if (Object.keys(validFields).length === 0) {
    return { applied, pendingReview, rejected, confidence: 0 }
  }

  // 2. Fetch current site state
  const { data: site, error: fetchError } = await sb
    .from('tracked_sites')
    .select('*')
    .eq('id', req.siteId)
    .single()

  if (fetchError || !site) {
    console.error(`[identity-gateway] Site ${req.siteId} not found:`, fetchError?.message)
    return { applied, pendingReview, rejected, confidence: 0 }
  }

  const currentSource = (site.identity_source as string) || 'none'
  const isSourceProtected = PROTECTED_SOURCES.has(currentSource) && !req.forceOverwrite
  const isLLMSource = ['llm_auto', 'llm_verified'].includes(req.source)

  // 3. Classify each field
  const directUpdates: Record<string, unknown> = {}

  for (const [field, value] of Object.entries(validFields)) {
    const currentValue = (site as Record<string, unknown>)[field]
    const currentStr = currentValue != null ? String(currentValue).trim() : ''
    const newStr = typeof value === 'string' ? value.trim() : JSON.stringify(value)

    // Skip if value is identical
    if (currentStr === newStr) continue

    // Protected source check: LLM cannot overwrite user data
    if (isSourceProtected && isLLMSource && currentStr) {
      rejected.push(field)
      continue
    }

    if (CRITICAL_FIELDS.has(field) && currentStr && !req.forceDirectWrite) {
      // Critical field with existing value → suggestion
      try {
        await sb.from('identity_card_suggestions').insert({
          tracked_site_id: req.siteId,
          user_id: req.userId || site.user_id,
          field_name: field,
          current_value: currentStr,
          suggested_value: newStr,
          source: req.source,
          reason: `Auto-detected by ${req.source}`,
          status: 'pending',
        })
        pendingReview.push(field)
      } catch (err) {
        console.warn(`[identity-gateway] Failed to create suggestion for ${field}:`, err)
        rejected.push(field)
      }
    } else {
      // Minor field OR empty critical field OR forceDirectWrite → direct update
      directUpdates[field] = value
      applied.push(field)
    }
  }

  // 4. Apply direct updates
  if (Object.keys(directUpdates).length > 0) {
    directUpdates.identity_source = req.source
    directUpdates.identity_enriched_at = new Date().toISOString()

    // Recalculate confidence
    const confidenceInput = { ...site, ...directUpdates }
    const confidence = calculateConfidence(confidenceInput)
    directUpdates.identity_confidence = confidence

    const { error: updateError } = await sb
      .from('tracked_sites')
      .update(directUpdates)
      .eq('id', req.siteId)

    if (updateError) {
      console.error(`[identity-gateway] DB update error for ${req.siteId}:`, updateError)
      // Move applied back to rejected
      rejected.push(...applied.splice(0))
    } else {
      const domain = site.domain || req.siteId
      console.log(`[identity-gateway] ✅ ${domain} updated ${applied.length} fields (source: ${req.source}, confidence: ${confidence})`)
    }
  }

  // 5. Return result with current confidence
  const finalSite = { ...site, ...directUpdates }
  const confidence = calculateConfidence(finalSite)

  return { applied, pendingReview, rejected, confidence }
}

/**
 * Convenience: check if a field name is allowed in the identity card
 */
export function isAllowedField(field: string): boolean {
  return ALL_ALLOWED_FIELDS.has(field)
}

/**
 * Convenience: get the field classification
 */
export function getFieldType(field: string): 'critical' | 'minor' | 'unknown' {
  if (CRITICAL_FIELDS.has(field)) return 'critical'
  if (MINOR_FIELDS.has(field)) return 'minor'
  return 'unknown'
}
