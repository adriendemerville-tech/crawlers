import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * matomo-connector: Fetch analytics data from Matomo Reporting API
 * 
 * Actions:
 * - test_connection: Validate matomo_url + token_auth + site_id
 * - fetch_metrics: Pull visit/pageview/bounce data for a date range
 * - sync_weekly: Pull weekly aggregated data and upsert into matomo_history_log
 */

const MATOMO_METHODS = {
  visits: 'VisitsSummary.get',
  actions: 'Actions.get',
  users: 'VisitsSummary.getUniqueVisitors',
} as const;

interface MatomoRequestParams {
  matomoUrl: string;
  tokenAuth: string;
  siteId: number;
  method: string;
  period?: string;
  date?: string;
  extraParams?: Record<string, string>;
}

async function callMatomoApi(params: MatomoRequestParams): Promise<any> {
  const { matomoUrl, tokenAuth, siteId, method, period = 'day', date = 'today', extraParams = {} } = params;
  
  const baseUrl = matomoUrl.replace(/\/+$/, '');
  const urlParams = new URLSearchParams({
    module: 'API',
    method,
    idSite: String(siteId),
    period,
    date,
    format: 'JSON',
    token_auth: tokenAuth,
    ...extraParams,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(`${baseUrl}/index.php?${urlParams}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      throw new Error(`Matomo API ${resp.status}: ${await resp.text()}`);
    }

    const data = await resp.json();
    
    // Matomo returns { result: 'error', message: '...' } on API errors
    if (data?.result === 'error') {
      throw new Error(`Matomo error: ${data.message}`);
    }
    
    return data;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

Deno.serve(handleRequest(async (req) => {
try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return jsonError('Unauthorized', 401);
    }

    const body = await req.json();
    const { action } = body;
    const supabase = getServiceClient();

    // ── TEST CONNECTION ──
    if (action === 'test_connection') {
      const { matomo_url, token_auth, site_id } = body;
      if (!matomo_url || !token_auth || !site_id) {
        return jsonError('Missing matomo_url, token_auth, or site_id', 400);
      }

      const data = await callMatomoApi({
        matomoUrl: matomo_url,
        tokenAuth: token_auth,
        siteId: site_id,
        method: 'SitesManager.getSiteFromId',
        period: 'day',
        date: 'today',
      });

      return jsonOk({ success: true, site_name: data?.[0]?.name || data?.name || 'OK' });
    }

    // ── FETCH METRICS (ad-hoc) ──
    if (action === 'fetch_metrics') {
      const { tracked_site_id, period = 'week', date = 'today' } = body;

      const { data: conn } = await supabase
        .from('matomo_connections')
        .select('*')
        .eq('tracked_site_id', tracked_site_id)
        .eq('user_id', auth.userId)
        .eq('is_active', true)
        .maybeSingle();

      if (!conn) {
        return jsonError('No active Matomo connection for this site', 404);
      }

      const [visitData, actionData] = await Promise.all([
        callMatomoApi({
          matomoUrl: conn.matomo_url,
          tokenAuth: conn.auth_token,
          siteId: conn.site_id,
          method: MATOMO_METHODS.visits,
          period, date,
        }),
        callMatomoApi({
          matomoUrl: conn.matomo_url,
          tokenAuth: conn.auth_token,
          siteId: conn.site_id,
          method: MATOMO_METHODS.actions,
          period, date,
        }),
      ]);

      const metrics = {
        total_users: visitData?.nb_uniq_visitors || 0,
        sessions: visitData?.nb_visits || 0,
        pageviews: actionData?.nb_pageviews || 0,
        bounce_rate: visitData?.bounce_rate ? parseFloat(String(visitData.bounce_rate).replace('%', '')) : 0,
        avg_session_duration: visitData?.avg_time_on_site || 0,
        actions_per_visit: visitData?.nb_actions_per_visit || 0,
      };

      // Update last_sync
      await supabase
        .from('matomo_connections')
        .update({ last_sync_at: new Date().toISOString(), sync_error: null })
        .eq('id', conn.id);

      return jsonOk({ success: true, metrics });
    }

    // ── SYNC WEEKLY (for history log) ──
    if (action === 'sync_weekly') {
      const { tracked_site_id } = body;

      const { data: conn } = await supabase
        .from('matomo_connections')
        .select('*')
        .eq('tracked_site_id', tracked_site_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!conn) {
        return jsonError('No active Matomo connection', 404);
      }

      // Fetch last 9 weeks for anomaly detection compatibility
      const weeks: string[] = [];
      for (let i = 0; i < 9; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        // Get Monday of that week
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        weeks.push(d.toISOString().split('T')[0]);
      }

      const uniqueWeeks = [...new Set(weeks)];
      let synced = 0;

      for (const weekStart of uniqueWeeks) {
        try {
          const [visitData, actionData] = await Promise.all([
            callMatomoApi({
              matomoUrl: conn.matomo_url,
              tokenAuth: conn.auth_token,
              siteId: conn.site_id,
              method: MATOMO_METHODS.visits,
              period: 'week',
              date: weekStart,
            }),
            callMatomoApi({
              matomoUrl: conn.matomo_url,
              tokenAuth: conn.auth_token,
              siteId: conn.site_id,
              method: MATOMO_METHODS.actions,
              period: 'week',
              date: weekStart,
            }),
          ]);

          await supabase.from('matomo_history_log').upsert({
            tracked_site_id,
            user_id: conn.user_id,
            week_start_date: weekStart,
            total_users: visitData?.nb_uniq_visitors || 0,
            sessions: visitData?.nb_visits || 0,
            pageviews: actionData?.nb_pageviews || 0,
            bounce_rate: visitData?.bounce_rate ? parseFloat(String(visitData.bounce_rate).replace('%', '')) : 0,
            avg_session_duration: visitData?.avg_time_on_site || 0,
            actions_per_visit: visitData?.nb_actions_per_visit || 0,
            measured_at: new Date().toISOString(),
          }, { onConflict: 'tracked_site_id,week_start_date' });

          synced++;
        } catch (e) {
          console.error(`[matomo-connector] Week ${weekStart} error:`, e);
        }
      }

      // Update connection status
      await supabase
        .from('matomo_connections')
        .update({ last_sync_at: new Date().toISOString(), sync_error: null })
        .eq('id', conn.id);

      return jsonOk({ success: true, weeks_synced: synced });
    }

    return jsonError('Unknown action', 400);

  } catch (error) {
    console.error('[matomo-connector] Error:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}));