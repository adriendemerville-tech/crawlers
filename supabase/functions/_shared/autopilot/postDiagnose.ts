/**
 * autopilot/postDiagnose.ts — Post-audit and post-diagnose phase logic.
 * Handles: workbench population, stale item recycling, proactive scans,
 * seasonal boost, keyword enrichment.
 * 
 * Extracted from autopilot-engine monolith for maintainability.
 * Each sub-step is isolated so one failure doesn't block the rest.
 */

import { getServiceClient } from '../supabaseClient.ts';
import type { AutopilotConfig, SiteInfo } from './types.ts';

type Supabase = ReturnType<typeof getServiceClient>;

/**
 * Post-audit: Auto-inject audit findings into architect_workbench.
 */
export async function runPostAudit(
  supabase: Supabase,
  config: AutopilotConfig,
  site: SiteInfo,
) {
  try {
    console.log(`[AutopilotEngine] 🔄 Auto-populating workbench from audit results for ${site.domain}`);
    const { data, error } = await supabase.rpc('populate_architect_workbench', {
      p_domain: site.domain,
      p_user_id: config.user_id,
      p_tracked_site_id: config.tracked_site_id,
    });
    if (error) console.warn('[AutopilotEngine] Workbench populate error:', error.message);
    else console.log(`[AutopilotEngine] ✅ Workbench populated: ${JSON.stringify(data)}`);
  } catch (e) {
    console.warn('[AutopilotEngine] Workbench populate exception:', e);
  }
}

/**
 * Post-diagnose: Full pipeline of workbench maintenance + proactive scans.
 * Each sub-step is isolated — failures are logged but don't block others.
 */
export async function runPostDiagnose(
  supabase: Supabase,
  config: AutopilotConfig,
  site: SiteInfo,
) {
  // 1. Re-populate workbench
  await populateWorkbench(supabase, config, site);

  // 2. Recycle stale items (consumed but never deployed after 48h)
  await recycleStaleItems(supabase, config, site);

  // 3. Proactive: stale content scan
  await scanStaleContent(supabase, config, site);

  // 4. Proactive: EEAT freshness check
  await checkEeatFreshness(supabase, config, site);

  // 5. Seasonal context boost
  await applySeasonalBoost(supabase, config, site);

  // 6. Keyword enrichment
  await enrichWithKeywords(supabase, config, site);
}

async function populateWorkbench(supabase: Supabase, config: AutopilotConfig, site: SiteInfo) {
  try {
    console.log(`[AutopilotEngine] 🔄 Re-populating workbench after diagnose for ${site.domain}`);
    const { data, error } = await supabase.rpc('populate_architect_workbench', {
      p_domain: site.domain,
      p_user_id: config.user_id,
      p_tracked_site_id: config.tracked_site_id,
    });
    if (error) console.warn('[AutopilotEngine] Post-diagnose populate error:', error.message);
    else console.log(`[AutopilotEngine] ✅ Post-diagnose workbench: ${JSON.stringify(data)}`);
  } catch (e) {
    console.warn('[AutopilotEngine] Post-diagnose populate exception:', e);
  }
}

async function recycleStaleItems(supabase: Supabase, config: AutopilotConfig, site: SiteInfo) {
  try {
    const recycleThreshold = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: recycled, error } = await supabase
      .from('architect_workbench')
      .update({ 
        status: 'pending', 
        consumed_by_code: false, 
        consumed_by_content: false,
        consumed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('domain', site.domain)
      .eq('status', 'in_progress')
      .is('deployed_at', null)
      .lt('updated_at', recycleThreshold)
      .select('id');
    
    if (recycled && recycled.length > 0) {
      console.log(`[AutopilotEngine] ♻️ Recycled ${recycled.length} stale workbench items for ${site.domain}`);
    }
    if (error) console.warn('[AutopilotEngine] Workbench recycle error:', error.message);
  } catch (e) {
    console.warn('[AutopilotEngine] Recycle exception:', e);
  }
}

async function scanStaleContent(supabase: Supabase, config: AutopilotConfig, site: SiteInfo) {
  try {
    const { data: stalePages } = await supabase
      .from('url_registry')
      .select('url, title, last_crawled_at')
      .eq('domain', site.domain)
      .lt('last_crawled_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString())
      .not('url', 'ilike', '%/wp-admin%')
      .not('url', 'ilike', '%/feed%')
      .order('last_crawled_at', { ascending: true })
      .limit(5);

    if (stalePages && stalePages.length > 0) {
      const staleItems = stalePages.map(p => ({
        domain: site.domain,
        tracked_site_id: config.tracked_site_id,
        user_id: config.user_id,
        source_type: 'proactive_scan' as const,
        source_function: 'autopilot-engine',
        source_record_id: `freshness_${site.domain}_${p.url}`,
        finding_category: 'content_freshness',
        severity: 'medium',
        title: `Contenu obsolète: ${p.title || p.url}`,
        description: `Cette page n'a pas été mise à jour depuis plus de 90 jours. Une actualisation améliorerait le signal de fraîcheur pour Google et les moteurs IA.`,
        target_url: p.url,
        target_operation: 'replace',
        action_type: 'content' as const,
        status: 'pending' as const,
      }));

      for (const item of staleItems) {
        await supabase.from('architect_workbench').upsert(item, { 
          onConflict: 'source_type,source_record_id',
          ignoreDuplicates: true,
        });
      }
      console.log(`[AutopilotEngine] 🔍 Proactive: injected ${staleItems.length} stale content items for ${site.domain}`);
    }
  } catch (e) {
    console.warn('[AutopilotEngine] Freshness scan error:', e);
  }
}

async function checkEeatFreshness(supabase: Supabase, config: AutopilotConfig, site: SiteInfo) {
  try {
    const { data: lastEeat } = await supabase
      .from('audit_raw_data')
      .select('created_at')
      .eq('domain', site.domain)
      .eq('audit_type', 'eeat')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const eeatAge = lastEeat?.created_at 
      ? Date.now() - new Date(lastEeat.created_at).getTime()
      : Infinity;

    if (eeatAge > 14 * 24 * 3600 * 1000) {
      await supabase.from('architect_workbench').upsert({
        domain: site.domain,
        tracked_site_id: config.tracked_site_id,
        user_id: config.user_id,
        source_type: 'proactive_scan' as const,
        source_function: 'autopilot-engine',
        source_record_id: `eeat_refresh_${site.domain}`,
        finding_category: 'eeat',
        severity: 'medium',
        title: `Rafraîchir l'audit E-E-A-T (${lastEeat ? `dernier: ${new Date(lastEeat.created_at).toLocaleDateString('fr')}` : 'jamais fait'})`,
        description: `L'audit E-E-A-T date de plus de 14 jours. Un nouvel audit permettrait d'identifier les signaux de confiance à renforcer.`,
        target_url: `https://${site.domain}`,
        target_operation: 'replace',
        action_type: 'content' as const,
        status: 'pending' as const,
      }, { onConflict: 'source_type,source_record_id', ignoreDuplicates: true });
      console.log(`[AutopilotEngine] 🔍 Proactive: EEAT refresh needed for ${site.domain}`);
    }
  } catch (e) {
    console.warn('[AutopilotEngine] EEAT check error:', e);
  }
}

async function applySeasonalBoost(supabase: Supabase, config: AutopilotConfig, site: SiteInfo) {
  try {
    const { data: seasonalEvents } = await supabase.rpc('get_active_seasonal_context', {
      p_sector: site.market_sector || null,
      p_geo: 'FR',
    });

    if (!seasonalEvents || seasonalEvents.length === 0) return;

    const peakKeywords = new Set<string>();
    for (const ev of seasonalEvents) {
      if (ev.is_in_peak || ev.is_in_prep) {
        for (const kw of (ev.peak_keywords || [])) {
          peakKeywords.add(kw.toLowerCase());
        }
      }
    }

    if (peakKeywords.size === 0) return;

    const { data: pendingItems } = await supabase
      .from('architect_workbench')
      .select('id, title, payload')
      .eq('domain', site.domain)
      .eq('user_id', config.user_id)
      .eq('status', 'pending')
      .in('finding_category', ['content_gap', 'missing_page', 'content_upgrade', 'keyword_data', 'quick_win'])
      .limit(50);

    let boosted = 0;
    for (const item of (pendingItems || [])) {
      const titleLower = (item.title || '').toLowerCase();
      const payloadKw = (item.payload as any)?.keyword?.toLowerCase() || '';
      const matches = [...peakKeywords].some(kw => titleLower.includes(kw) || payloadKw.includes(kw));
      
      if (matches) {
        const existingPayload = (item.payload || {}) as Record<string, unknown>;
        await supabase.from('architect_workbench').update({
          priority_tag: 'seasonal_boost',
          payload: { ...existingPayload, seasonal_roi_boost: 150, seasonal_match: true },
        }).eq('id', item.id);
        boosted++;
      }
    }
    if (boosted > 0) {
      console.log(`[AutopilotEngine] 🌸 Seasonal boost: ${boosted} items repriorized (${peakKeywords.size} peak keywords from ${seasonalEvents.length} events)`);
    }
  } catch (e) {
    console.warn('[AutopilotEngine] Seasonal boost error:', e);
  }
}

async function enrichWithKeywords(supabase: Supabase, config: AutopilotConfig, site: SiteInfo) {
  try {
    const { data: topKeywords } = await supabase
      .from('keyword_universe')
      .select('keyword, opportunity_score, search_volume, intent')
      .eq('domain', site.domain)
      .eq('user_id', config.user_id)
      .order('opportunity_score', { ascending: false })
      .limit(50);

    if (!topKeywords || topKeywords.length === 0) return;

    const { data: unenrichedItems } = await supabase
      .from('architect_workbench')
      .select('id, title, payload')
      .eq('domain', site.domain)
      .eq('user_id', config.user_id)
      .eq('status', 'pending')
      .in('finding_category', ['content_gap', 'missing_page', 'content_upgrade', 'keyword_data', 'quick_win', 'topical_authority'])
      .limit(30);

    const usedKeywords = new Set<string>();
    let enriched = 0;

    for (const item of (unenrichedItems || [])) {
      const existingPayload = (item.payload || {}) as Record<string, unknown>;
      if (existingPayload.target_keywords) continue;

      const titleWords = new Set((item.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const assignedKws: typeof topKeywords = [];

      for (const kw of topKeywords) {
        if (usedKeywords.has(kw.keyword)) continue;
        const kwWords = kw.keyword.toLowerCase().split(/\s+/);
        const hasOverlap = kwWords.some(w => titleWords.has(w));
        if (hasOverlap || assignedKws.length < 2) {
          assignedKws.push(kw);
          usedKeywords.add(kw.keyword);
          if (assignedKws.length >= 5) break;
        }
      }

      if (assignedKws.length > 0) {
        await supabase.from('architect_workbench').update({
          payload: {
            ...existingPayload,
            target_keywords: assignedKws.map(k => k.keyword),
            target_keywords_detail: assignedKws.map(k => ({
              keyword: k.keyword,
              volume: k.search_volume,
              score: k.opportunity_score,
              intent: k.intent,
            })),
          },
        }).eq('id', item.id);
        enriched++;
      }
    }
    if (enriched > 0) {
      console.log(`[AutopilotEngine] 🔑 Keyword enrichment: ${enriched} workbench items got diversified keywords`);
    }
  } catch (e) {
    console.warn('[AutopilotEngine] Keyword enrichment error:', e);
  }
}
