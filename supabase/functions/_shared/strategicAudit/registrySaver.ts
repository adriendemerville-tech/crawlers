/**
 * Post-audit persistence: recommendations registry, cache, keyword universe, identity card.
 */
import { getServiceClient, getUserClient } from '../supabaseClient.ts';
import type { MarketData, RankingOverview } from './types.ts';

function generateStrategicPromptSummary(title: string, description: string, priority: string): string {
  const priorityLabel = priority === 'Prioritaire' ? '🔴 PRIORITAIRE' : priority === 'Important' ? '🟠 IMPORTANT' : '🟢 OPPORTUNITÉ';
  return `[${priorityLabel}] ${title} - ${description.substring(0, 200)}`;
}

export async function saveStrategicRecommendationsToRegistry(
  authHeader: string, domain: string, url: string, parsedAnalysis: any
): Promise<void> {
  try {
    const supabase = getUserClient(authHeader);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return;

    await supabase.from('audit_recommendations_registry').delete().eq('user_id', user.id).eq('domain', domain).eq('audit_type', 'strategic');

    const registryEntries: any[] = [];
    if (parsedAnalysis.executive_roadmap && Array.isArray(parsedAnalysis.executive_roadmap)) {
      parsedAnalysis.executive_roadmap.forEach((item: any, idx: number) => {
        const priorityMap: Record<string, string> = { 'Prioritaire': 'critical', 'Important': 'important', 'Opportunité': 'optional' };
        registryEntries.push({
          user_id: user.id, domain, url, audit_type: 'strategic',
          recommendation_id: `roadmap_${idx}`, title: item.title || `Recommandation ${idx + 1}`,
          description: item.prescriptive_action || item.strategic_rationale || '',
          category: item.category?.toLowerCase() || 'contenu',
          priority: priorityMap[item.priority] || 'important',
          fix_type: null,
          fix_data: { expected_roi: item.expected_roi, category: item.category, full_action: item.prescriptive_action },
          prompt_summary: generateStrategicPromptSummary(item.title || `Recommandation ${idx + 1}`, item.prescriptive_action || '', item.priority || 'Important'),
          is_resolved: false,
        });
      });
    }

    if (parsedAnalysis.keyword_positioning?.recommendations && Array.isArray(parsedAnalysis.keyword_positioning.recommendations)) {
      parsedAnalysis.keyword_positioning.recommendations.forEach((rec: string, idx: number) => {
        registryEntries.push({
          user_id: user.id, domain, url, audit_type: 'strategic',
          recommendation_id: `kw_rec_${idx}`, title: `SEO Keywords #${idx + 1}`,
          description: rec, category: 'seo', priority: 'important',
          fix_type: null, fix_data: { type: 'keyword_recommendation' },
          prompt_summary: `[🟠 SEO] ${rec.substring(0, 200)}`, is_resolved: false,
        });
      });
    }

    if (registryEntries.length > 0) {
      const { error: insertError } = await supabase.from('audit_recommendations_registry').insert(registryEntries);
      if (insertError) console.error('❌ Registre stratégique:', insertError);
      else console.log(`✅ ${registryEntries.length} recommandations sauvegardées`);
    }
  } catch (error) { console.error('❌ Erreur registre:', error); }
}

/** Save result to audit_cache (fire-and-forget) */
export async function saveToCache(domain: string, url: string, result: any): Promise<void> {
  try {
    const adminClient = getServiceClient();
    const normalizedCacheUrl = url.replace(/\/+$/, '');
    const cacheDomain = domain.replace(/^www\./, '');
    const cacheKey = `strategic_${cacheDomain}_${normalizedCacheUrl}`;
    await adminClient.from('audit_cache').upsert({
      cache_key: cacheKey, function_name: 'audit-strategique-ia',
      result_data: result, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }, { onConflict: 'cache_key' });
    console.log('✅ Result saved to audit_cache for timeout recovery');
  } catch (cacheErr) { console.warn('⚠️ Failed to cache result:', cacheErr); }
}

/** Build a minimal fallback result when LLM fails */
export function buildFallbackResult(url: string, domain: string, marketData: MarketData | null, rankingOverview: RankingOverview | null, llmData: any, cachedContextOut: any): any {
  return {
    success: true,
    data: {
      url, domain, scannedAt: new Date().toISOString(), overallScore: 0,
      introduction: { presentation: 'L\'analyse IA n\'a pas pu être complétée. Les données de marché sont disponibles.', strengths: '', improvement: '', competitors: [] },
      brand_authority: { dna_analysis: 'Non disponible', thought_leadership_score: 0, entity_strength: 'unknown' },
      social_signals: { proof_sources: [], thought_leadership: { founder_authority: 'unknown', entity_recognition: '', eeat_score: 0, analysis: '' }, sentiment: { overall_polarity: 'neutral', hallucination_risk: 'medium', reputation_vibration: '' } },
      market_intelligence: { sophistication: { level: 1, description: '', emotional_levers: [] }, semantic_gap: { current_position: 0, leader_position: 0, gap_analysis: '', priority_themes: [], closing_strategy: '' } },
      competitive_landscape: { leader: { name: 'Non identifié', url: null, authority_factor: '', analysis: '' }, direct_competitor: { name: 'Non identifié', url: null, authority_factor: '', analysis: '' }, challenger: { name: 'Non identifié', url: null, authority_factor: '', analysis: '' }, inspiration_source: { name: 'Non identifié', url: null, authority_factor: '', analysis: '' } },
      geo_readiness: { citability_score: 0, readiness_level: 'basic', analysis: 'Non disponible', strengths: [], weaknesses: [], recommendations: [] },
      executive_roadmap: [],
      client_targets: { primary: [], secondary: [], untapped: [] },
      keyword_positioning: marketData ? { main_keywords: marketData.top_keywords.slice(0, 5).map(kw => ({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, current_rank: kw.current_rank })), quick_wins: [], content_gaps: [], opportunities: [], competitive_gaps: [], recommendations: [] } : null,
      market_data_summary: marketData ? { total_market_volume: marketData.total_market_volume, keywords_ranked: marketData.top_keywords.filter(k => k.is_ranked).length, keywords_analyzed: marketData.top_keywords.length, average_position: 0, data_source: 'dataforseo' } : null,
      executive_summary: 'L\'analyse stratégique n\'a pas pu être complétée par l\'IA. Les données de marché et de positionnement sont disponibles.',
      quotability: { score: 0, quotes: [] }, summary_resilience: { score: 0, originalH1: '', llmSummary: '' },
      lexical_footprint: { jargonRatio: 50, concreteRatio: 50 }, expertise_sentiment: { rating: 1, justification: 'Non évalué' },
      red_team: { flaws: [] }, raw_market_data: marketData, ranking_overview: rankingOverview,
      toolsData: null, llm_visibility_raw: llmData, _cachedContext: cachedContextOut,
    },
  };
}

/** Feed keyword_universe SSOT from audit results */
export async function feedKeywordUniverse(authHeader: string, domain: string, parsedAnalysis: any): Promise<void> {
  try {
    const svcKw = getServiceClient();
    const sbKw = getUserClient(authHeader);
    const { data: { user: kwUser } } = await sbKw.auth.getUser();
    if (!kwUser) return;

    const kp = parsedAnalysis.keyword_positioning;
    if (!kp) return;
    const kwPayload: any[] = [];

    if (Array.isArray(kp.main_keywords)) {
      for (const mk of kp.main_keywords) {
        if (!mk?.keyword) continue;
        kwPayload.push({ keyword: mk.keyword, search_volume: mk.volume || 0, difficulty: mk.difficulty || null, position: mk.current_rank ? parseInt(String(mk.current_rank), 10) || null : null, intent: mk.strategic_analysis?.intent || 'default', target_url: mk.target_url || mk.page_url || null, is_quick_win: false });
      }
    }
    if (Array.isArray(kp.quick_wins)) {
      for (const qw of kp.quick_wins) {
        kwPayload.push({ keyword: qw.keyword || qw.title || 'unknown', search_volume: qw.volume || qw.search_volume || 0, position: qw.position || qw.current_rank ? parseInt(String(qw.position || qw.current_rank), 10) : null, intent: qw.intent || 'default', target_url: qw.url || qw.page_url || qw.target_url || null, is_quick_win: true, quick_win_type: qw.type || qw.quick_win_type || 'general', quick_win_action: qw.action || qw.recommended_action || '' });
      }
    }
    if (Array.isArray(kp.content_gaps)) {
      for (const cg of kp.content_gaps) {
        if (!cg?.keyword && !cg?.title) continue;
        kwPayload.push({ keyword: cg.keyword || cg.title, search_volume: cg.volume || 0, intent: 'informational', target_url: cg.url || cg.suggested_url || null, is_quick_win: false });
      }
    }
    if (Array.isArray(kp.missing_terms)) {
      for (const mt of kp.missing_terms) {
        if (!mt?.term) continue;
        kwPayload.push({ keyword: mt.term, search_volume: 0, intent: 'default', target_url: mt.url || mt.page_url || null, is_quick_win: false });
      }
    }

    if (kwPayload.length > 0) {
      const { data: tsData } = await svcKw.from('tracked_sites').select('id').eq('user_id', kwUser.id).ilike('domain', `%${domain}%`).limit(1).maybeSingle();
      await svcKw.rpc('upsert_keyword_universe', { p_domain: domain, p_user_id: kwUser.id, p_keywords: kwPayload, p_source: 'audit_strategic', p_tracked_site_id: tsData?.id || null });
      console.log(`[audit-strategique-ia] keyword_universe: ${kwPayload.length} keywords upserted`);
    }
  } catch (kwErr) { console.warn('[audit-strategique-ia] keyword_universe upsert failed:', kwErr); }
}

/** Normalize and persist client_targets + jargon_distance + business_model to identity card */
export async function persistIdentityData(
  domain: string,
  parsedAnalysis: any,
  jargonDistance: any,
  businessModelDetection?: { model: string | null; confidence: number; needs_llm_fallback: boolean } | null,
): Promise<void> {
  if (!domain || (!parsedAnalysis?.client_targets && !jargonDistance && !businessModelDetection && !parsedAnalysis?.business_model)) return;
  try {
    const svcSb = getServiceClient();
    const updatePayload: Record<string, any> = {};
    if (parsedAnalysis?.client_targets) {
      const raw = parsedAnalysis.client_targets;
      const ensureArray = (v: any): any[] => { if (Array.isArray(v)) return v; if (v && typeof v === 'object' && !Array.isArray(v)) return [v]; return []; };
      const normalized = { primary: ensureArray(raw?.primary), secondary: ensureArray(raw?.secondary), untapped: ensureArray(raw?.untapped) };
      const validateTarget = (t: any) => t && typeof t === 'object' && typeof t.market === 'string' && typeof t.confidence === 'number';
      normalized.primary = normalized.primary.filter(validateTarget);
      normalized.secondary = normalized.secondary.filter(validateTarget);
      normalized.untapped = normalized.untapped.filter(validateTarget);
      updatePayload.client_targets = normalized;
      parsedAnalysis.client_targets = normalized;
      console.log(`[audit-strategique-ia] client_targets normalized: P=${normalized.primary.length} S=${normalized.secondary.length} U=${normalized.untapped.length}`);
    }
    if (jargonDistance) updatePayload.jargon_distance = jargonDistance;

    // ── Business model: priority manual (already in DB) > LLM > heuristic ──
    const ALLOWED = new Set([
      'saas_b2b','saas_b2c','marketplace_b2b','marketplace_b2c','marketplace_b2b2c',
      'ecommerce_b2c','ecommerce_b2b','media_publisher','service_local','service_agency',
      'leadgen','nonprofit',
    ]);
    let bmModel: string | null = null;
    let bmConfidence = 0;
    let bmSource: 'heuristic' | 'llm' | null = null;

    // Heuristic baseline
    if (businessModelDetection?.model && ALLOWED.has(businessModelDetection.model)) {
      bmModel = businessModelDetection.model;
      bmConfidence = Math.max(0, Math.min(1, Number(businessModelDetection.confidence || 0)));
      bmSource = 'heuristic';
    }
    // LLM override (only if heuristic confidence was insufficient OR LLM is more confident)
    const llmModel = parsedAnalysis?.business_model?.model;
    const llmConf = Number(parsedAnalysis?.business_model?.confidence ?? 0);
    if (llmModel && ALLOWED.has(llmModel) && (bmConfidence < 0.7 || llmConf > bmConfidence)) {
      bmModel = llmModel;
      bmConfidence = Math.max(0, Math.min(1, llmConf || 0.6));
      bmSource = 'llm';
    }

    if (bmModel && bmSource) {
      // Don't overwrite a manual value
      const { data: existing } = await svcSb
        .from('tracked_sites')
        .select('business_model, business_model_source')
        .ilike('domain', `%${domain}%`)
        .limit(1)
        .maybeSingle();
      const isManual = existing?.business_model_source === 'manual' || existing?.business_model_source === 'user_manual';
      if (!isManual) {
        updatePayload.business_model = bmModel;
        updatePayload.business_model_confidence = bmConfidence;
        updatePayload.business_model_source = bmSource;
        updatePayload.business_model_detected_at = new Date().toISOString();
        console.log(`[audit-strategique-ia] business_model=${bmModel} (${bmSource}, conf=${bmConfidence})`);
      } else {
        console.log(`[audit-strategique-ia] business_model preserved (manual override in DB)`);
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      await svcSb.from('tracked_sites').update(updatePayload).ilike('domain', `%${domain}%`);
      console.log(`[audit-strategique-ia] identity persisted for ${domain}: keys=${Object.keys(updatePayload).join(',')}`);
    }
  } catch (e) { console.warn('[audit-strategique-ia] Failed to persist identity data:', e); }
}
