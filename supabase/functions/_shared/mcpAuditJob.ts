/**
 * Détache un audit long du client MCP.
 *
 * mcp-remote coupe vers 60 s (« fetch failed » / « Request timed out »).
 * L'appelant crée la ligne `async_jobs`, puis poste `_detach: true`.
 * Cette fonction répond 202 tout de suite et relance la même edge function
 * pour le travail réel (`EdgeRuntime.waitUntil`). Le second appel, qui porte
 * `_job_id` sans `_detach`, écrit le résultat.
 */
import { corsHeaders } from './cors.ts';
import { getServiceClient } from './supabaseClient.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AUDIT_FUNCTION_NAMES = ['audit-expert-seo', 'audit-strategique-ia'] as const;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export async function updateAuditJob(jobId: string, patch: Record<string, unknown>): Promise<void> {
  if (!isUuid(jobId)) return;
  try {
    await getServiceClient().from('async_jobs').update(patch).eq('id', jobId);
  } catch (e) {
    console.warn('[mcp-audit-job] update failed', e instanceof Error ? e.message : e);
  }
}

export async function persistAuditResult(jobId: string | undefined, payload: unknown, httpStatus: number): Promise<void> {
  if (!jobId || !isUuid(jobId)) return;
  const body = payload as { success?: boolean; error?: unknown; message?: unknown } | null;
  const failed = httpStatus >= 400 || body?.success === false;
  const err = failed ? String(body?.error ?? body?.message ?? 'audit failed').slice(0, 500) : null;
  await updateAuditJob(jobId, {
    status: failed ? 'failed' : 'completed',
    progress: 100,
    result_data: payload ?? null,
    error_message: err,
    completed_at: new Date().toISOString(),
  });
}

function edgeWaitUntil(work: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
}

export function startDetachedAudit(functionName: string, body: Record<string, unknown>): Response | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (body['_detach'] !== true) return null;
  const jobId = body['_job_id'];
  if (!isUuid(jobId)) {
    return new Response(JSON.stringify({ error: 'job_id invalide' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!serviceKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'Backend service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const work = fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, _detach: false }),
  }).then(async (r) => {
    if (!r.ok) {
      const text = await r.text();
      await updateAuditJob(jobId, {
        status: 'failed',
        error_message: text.slice(0, 500),
        completed_at: new Date().toISOString(),
      });
    }
  }).catch(async (e) => {
    await updateAuditJob(jobId, {
      status: 'failed',
      error_message: (e instanceof Error ? e.message : 'detach failed').slice(0, 500),
      completed_at: new Date().toISOString(),
    });
  });
  edgeWaitUntil(work);

  return new Response(JSON.stringify({ job_id: jobId, status: 'accepted' }), {
    status: 202,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Garde un fetch déjà lancé vivant après la réponse 202 (mode async historique). */
export function keepAlive(work: Promise<unknown>): void {
  edgeWaitUntil(work);
}
