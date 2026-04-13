/**
 * autopilot/iktrackerBridge.ts — Push events to IKtracker + analytics tracking.
 * Extracted from autopilot-engine monolith. Replaces silent .catch(() => {}) with proper logging.
 */

import { getServiceClient } from '../supabaseClient.ts';
import { isIktrackerDomain, normalizePageKey } from '../domainUtils.ts';
import type { AnalyticsPayload, IktrackerPushInput } from './types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export async function trackAnalyticsEvent(
  supabase: ReturnType<typeof getServiceClient>,
  eventType: string,
  eventData: AnalyticsPayload,
  userId?: string,
) {
  try {
    await supabase.from('analytics_events').insert({
      user_id: userId || null,
      event_type: eventType,
      event_data: eventData,
    });
  } catch (error) {
    console.warn(`[AutopilotEngine] Failed to store analytics event ${eventType}:`, error);
  }
}

export async function pushIktrackerEvent(
  supabase: ReturnType<typeof getServiceClient>,
  input: IktrackerPushInput,
) {
  if (!isIktrackerDomain(input.domain)) {
    return { attempted: false, ok: false as const };
  }

  const payload = {
    action: 'push-event',
    event_type: `autopilot_${input.pipelinePhase}`,
    severity: input.executionSuccess ? 'info' : 'warning',
    page_key: normalizePageKey(input.targetUrl),
    message: input.message,
    details: {
      cycle_number: input.cycleNumber,
      phase: input.pipelinePhase,
      functions: input.functions || [],
      status: input.finalStatus,
      ...(input.details || {}),
    },
  };

  try {
    console.log('[AutopilotEngine] Pushing IKtracker event:', JSON.stringify({
      domain: input.domain,
      tracked_site_id: input.trackedSiteId,
      ...payload,
    }));

    const response = await fetch(`${SUPABASE_URL}/functions/v1/iktracker-actions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let responseBody: unknown = rawText;

    try {
      responseBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      // keep raw text for debugging
    }

    const downstreamStatus = typeof (responseBody as any)?.result?.status === 'number'
      ? (responseBody as any).result.status
      : undefined;
    const ok = response.ok && (downstreamStatus === undefined || downstreamStatus < 400);

    await trackAnalyticsEvent(
      supabase,
      'autopilot:iktracker_push',
      {
        tracked_site_id: input.trackedSiteId,
        domain: input.domain,
        cycle_number: input.cycleNumber,
        pipeline_phase: input.pipelinePhase,
        final_status: input.finalStatus,
        http_status: response.status,
        downstream_status: downstreamStatus,
        ok,
        page_key: payload.page_key,
        event_type: payload.event_type,
        response: responseBody,
      },
      input.userId,
    );

    if (!ok) {
      console.error('[AutopilotEngine] IKtracker push returned non-success response:', {
        http_status: response.status,
        downstream_status: downstreamStatus,
        response: responseBody,
      });
    } else {
      console.log('[AutopilotEngine] IKtracker push succeeded:', {
        http_status: response.status,
        downstream_status: downstreamStatus,
      });
    }

    return { attempted: true, ok, httpStatus: response.status, downstreamStatus, responseBody };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.error('[AutopilotEngine] IKtracker event push failed:', error);

    await trackAnalyticsEvent(
      supabase,
      'autopilot:iktracker_push',
      {
        tracked_site_id: input.trackedSiteId,
        domain: input.domain,
        cycle_number: input.cycleNumber,
        pipeline_phase: input.pipelinePhase,
        final_status: input.finalStatus,
        ok: false,
        error: message,
        page_key: payload.page_key,
        event_type: payload.event_type,
      },
      input.userId,
    );

    return { attempted: true, ok: false as const, error: message };
  }
}
