import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { normalizeScanMode } from './scanMode';

/**
 * Liste les audits Marina de l'utilisateur connecté (lancés depuis l'interface
 * ou via l'API). RLS s'applique : on ne lit que ses propres jobs.
 */
export const listMyMarinaAudits = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('async_jobs')
      .select('id, status, progress, created_at, updated_at, input_payload, result_data, error_message')
      .eq('user_id', context.userId)
      .eq('function_name', 'marina')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    return (data || []).map((j: any) => {
      const payload = j.input_payload || {};
      const result = j.result_data || {};
      return {
        id: j.id as string,
        status: j.status as string,
        progress: (j.progress ?? 0) as number,
        createdAt: j.created_at as string,
        url: (payload.url || result.url || result.domain || '') as string,
        domain: (result.domain || payload.url || '') as string,
        scanMode: normalizeScanMode(payload.scan_mode ?? payload.scanMode ?? result.scan_mode),
        multipage: Boolean(payload.urls?.length || payload.multipage),
        viaApi: Boolean(payload.via_api || payload.source === 'api' || payload.api_key_id),
        hasReport: Boolean(result.report_path),
        globalScore: (result.strategic_score ?? null) as number | null,
        error: (j.error_message || null) as string | null,
      };
    });
  });

/**
 * Régénère une URL signée pour le rapport HTML d'un job Marina appartenant
 * à l'utilisateur (les URLs signées stockées expirent).
 */
export const getMyMarinaReportUrl = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) => {
    if (!input?.jobId || typeof input.jobId !== 'string') throw new Error('jobId requis');
    return { jobId: input.jobId };
  })
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from('async_jobs')
      .select('id, user_id, result_data')
      .eq('id', data.jobId)
      .eq('user_id', context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const path = (job as any)?.result_data?.report_path as string | undefined;
    if (!path) return { url: null as string | null };

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: signed } = await supabaseAdmin.storage
      .from('shared-reports')
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    return { url: signed?.signedUrl || null };
  });
