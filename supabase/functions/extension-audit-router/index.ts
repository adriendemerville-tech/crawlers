/**
 * extension-audit-router — Bridges the Crawlers Chrome Extension to the audit stack.
 *
 * Modes:
 *   GET ?check=1&domain=...  → returns whether the domain is a tracked site of the user
 *   POST { url, domain, title, dom_signals } → runs strategic + expert audits in parallel,
 *     enriches the identity card from DOM signals, irrigates the architect_workbench,
 *     and returns a compact summary.
 *
 * No cocoon, no crawl. Audits only.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { writeIdentity } from '../_shared/identityGateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function normalizeDomain(d: string): string {
  return d.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
}

async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  return { user: data.user, authHeader };
}

// Map DOM signals → identity hints
function mapDomToIdentity(dom: any): Record<string, unknown> {
  if (!dom) return {};
  const updates: Record<string, unknown> = {};

  // CMS detection
  if (dom.cms_hints?.wordpress) updates.cms_platform = 'wordpress';
  else if (dom.cms_hints?.shopify) updates.cms_platform = 'shopify';
  else if (dom.cms_hints?.webflow) updates.cms_platform = 'webflow';
  else if (dom.cms_hints?.wix) updates.cms_platform = 'wix';
  else if (dom.cms_hints?.squarespace) updates.cms_platform = 'squarespace';

  // Language
  if (dom.lang && /^[a-z]{2}/i.test(dom.lang)) {
    updates.primary_language = dom.lang.slice(0, 2).toLowerCase();
  }

  return updates;
}

// Heuristic business_model detection from DOM signals
function detectBusinessModelFromDom(dom: any): { value: string; confidence: number } | null {
  if (!dom) return null;
  const hasCart = !!dom.has_cart_signal;
  const hasPricing = !!dom.has_pricing_signal;
  const hasSignup = !!dom.has_signup_signal;
  const hasForm = !!dom.has_form;

  if (hasCart && hasPricing) return { value: 'ecommerce_b2c', confidence: 0.65 };
  if (hasSignup && hasPricing && !hasCart) return { value: 'saas_b2b', confidence: 0.55 };
  if (hasForm && hasPricing && !hasCart && !hasSignup) return { value: 'leadgen', confidence: 0.5 };
  if (hasForm && !hasPricing && !hasCart) return { value: 'service_local', confidence: 0.4 };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getUser(req);
    if (!auth) return json({ error: 'Authentication required' }, 401);
    const { user, authHeader } = auth;
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Mode 1: GET ?check=1&domain=... ──
    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.get('check') === '1') {
      const domain = normalizeDomain(url.searchParams.get('domain') || '');
      if (!domain) return json({ is_tracked: false });

      const { data } = await svc
        .from('tracked_sites')
        .select('id, domain')
        .eq('user_id', user.id)
        .ilike('domain', `%${domain}%`)
        .limit(1)
        .maybeSingle();

      return json({ is_tracked: !!data, tracked_site_id: data?.id || null });
    }

    // ── Mode 2: POST audit ──
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    const targetUrl = String(body.url || '').trim();
    if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
      return json({ error: 'Valid URL required' }, 400);
    }
    const domain = normalizeDomain(body.domain || targetUrl);
    const domSignals = body.dom_signals || null;

    // Detect tracked site
    const { data: trackedSite } = await svc
      .from('tracked_sites')
      .select('id, domain, business_model, business_model_source')
      .eq('user_id', user.id)
      .ilike('domain', `%${domain}%`)
      .limit(1)
      .maybeSingle();

    const isTracked = !!trackedSite;

    // ── 1. Identity enrichment from DOM signals (best-effort) ──
    let identityUpdated = false;
    if (isTracked && trackedSite) {
      try {
        const identityUpdates = mapDomToIdentity(domSignals);
        const bm = detectBusinessModelFromDom(domSignals);
        if (bm && trackedSite.business_model_source !== 'user_manual' && trackedSite.business_model_source !== 'manual') {
          identityUpdates.business_model = bm.value;
          identityUpdates.business_model_confidence = bm.confidence;
          identityUpdates.business_model_source = 'extension_heuristic';
          identityUpdates.business_model_detected_at = new Date().toISOString();
        }
        if (Object.keys(identityUpdates).length > 0) {
          await writeIdentity(svc, {
            domain: trackedSite.domain,
            updates: identityUpdates,
            source: 'extension',
            forceDirectWrite: true,
          });
          identityUpdated = true;
        }
      } catch (e) {
        console.warn('[extension-audit-router] identity write failed:', e);
      }
    }

    // ── 2. Launch audits in parallel ──
    const audits: Array<Promise<any>> = [];

    // Strategic audit
    audits.push(
      fetch(`${SUPABASE_URL}/functions/v1/audit-strategique-ia`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          apikey: ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl, lang: 'fr' }),
      })
        .then((r) => r.ok ? r.json() : null)
        .catch((e) => { console.warn('[router] strategic failed', e); return null; })
    );

    // Expert audit (technical)
    audits.push(
      fetch(`${SUPABASE_URL}/functions/v1/expert-audit`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          apikey: ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl }),
      })
        .then((r) => r.ok ? r.json() : null)
        .catch((e) => { console.warn('[router] expert failed', e); return null; })
    );

    // Run with a 60s deadline
    const auditDeadline = new Promise((resolve) => setTimeout(() => resolve('timeout'), 60_000));
    const results: any = await Promise.race([
      Promise.allSettled(audits),
      auditDeadline,
    ]);

    let strategicResult = null;
    let expertResult = null;
    if (Array.isArray(results)) {
      strategicResult = results[0]?.status === 'fulfilled' ? results[0].value : null;
      expertResult = results[1]?.status === 'fulfilled' ? results[1].value : null;
    }

    // ── 3. Irrigate architect_workbench (if tracked site) ──
    let workbenchInserted = 0;
    if (isTracked && trackedSite) {
      try {
        const { data: rpcData } = await svc.rpc('populate_architect_workbench', {
          p_domain: trackedSite.domain,
          p_user_id: user.id,
          p_tracked_site_id: trackedSite.id,
        });
        workbenchInserted = (rpcData as any)?.total_inserted || 0;
      } catch (e) {
        console.warn('[router] workbench populate failed:', e);
      }
    }

    // ── 4. Aggregate findings for the side panel ──
    const findings: Array<{ title: string; category: string; severity: string }> = [];

    // From strategic
    if (strategicResult?.data?.executive_roadmap && Array.isArray(strategicResult.data.executive_roadmap)) {
      for (const item of strategicResult.data.executive_roadmap.slice(0, 6)) {
        findings.push({
          title: item.title || item.action || 'Recommandation',
          category: item.category || 'strategic',
          severity: item.priority === 'high' || item.urgency === 'high' ? 'high' : 'medium',
        });
      }
    }

    // From expert audit
    if (expertResult?.recommendations && Array.isArray(expertResult.recommendations)) {
      for (const rec of expertResult.recommendations.slice(0, 6)) {
        findings.push({
          title: rec.title || rec.issue || 'Issue technique',
          category: rec.category || 'technical',
          severity: rec.priority || rec.severity || 'medium',
        });
      }
    }

    const criticalCount = findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length;

    // ── 5. Log analytics event ──
    try {
      await svc.from('analytics_events').insert({
        user_id: user.id,
        event_type: 'extension:audit',
        event_data: {
          url: targetUrl,
          domain,
          is_tracked: isTracked,
          findings_count: findings.length,
          identity_updated: identityUpdated,
        },
      });
    } catch (_e) { /* non-blocking */ }

    return json({
      success: true,
      is_tracked: isTracked,
      tracked_site_id: trackedSite?.id || null,
      summary: {
        findings_count: findings.length,
        critical_count: criticalCount,
        workbench_inserted: workbenchInserted,
        identity_updated: identityUpdated,
      },
      findings,
      strategic_score: strategicResult?.data?.overallScore || null,
      expert_score: expertResult?.overallScore || null,
    });
  } catch (err: any) {
    console.error('[extension-audit-router] error:', err);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
