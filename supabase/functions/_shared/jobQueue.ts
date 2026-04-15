/**
 * Job Queue helpers — enqueue jobs with automatic plan-based priority.
 * 
 * Priority levels:
 *   10 = agency_premium (highest)
 *   20 = agency_pro
 *   30 = new user (<24h)
 *   40 = registered (default)
 * 
 * Usage:
 * ```ts
 * import { enqueueJob, enqueueBatch } from '../_shared/jobQueue.ts';
 * 
 * // Single job with auto-priority
 * const job = await enqueueJob(supabase, {
 *   userId: auth.userId,
 *   functionName: 'audit-expert-seo',
 *   payload: { url: 'https://example.com' },
 * });
 * 
 * // Batch of jobs
 * const jobs = await enqueueBatch(supabase, userId, [
 *   { functionName: 'check-eeat', payload: { url } },
 *   { functionName: 'strategic-orchestrator', payload: { url } },
 * ]);
 * ```
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface EnqueueOptions {
  userId: string;
  functionName: string;
  payload: Record<string, unknown>;
  priority?: number; // Override auto-priority
  maxAttempts?: number;
}

export interface QueuedJob {
  id: string;
  status: string;
  priority: number;
  function_name: string;
}

/**
 * Enqueue a single job. Auto-resolves priority from user plan if not provided.
 */
export async function enqueueJob(
  supabase: SupabaseClient,
  opts: EnqueueOptions,
): Promise<QueuedJob> {
  let priority = opts.priority;

  // Auto-resolve priority from plan
  if (priority === undefined) {
    const { data } = await supabase.rpc('resolve_job_priority', { p_user_id: opts.userId });
    priority = typeof data === 'number' ? data : 40;
  }

  const { data, error } = await supabase
    .from('job_queue')
    .insert({
      user_id: opts.userId,
      function_name: opts.functionName,
      input_payload: opts.payload,
      priority,
      max_attempts: opts.maxAttempts ?? 3,
    })
    .select('id, status, priority, function_name')
    .single();

  if (error) throw new Error(`enqueueJob failed: ${error.message}`);
  return data as QueuedJob;
}

/**
 * Enqueue multiple jobs for the same user (batch insert).
 * Resolves priority once for all jobs.
 */
export async function enqueueBatch(
  supabase: SupabaseClient,
  userId: string,
  jobs: Array<{ functionName: string; payload: Record<string, unknown>; maxAttempts?: number }>,
): Promise<QueuedJob[]> {
  // Resolve priority once
  const { data: prio } = await supabase.rpc('resolve_job_priority', { p_user_id: userId });
  const priority = typeof prio === 'number' ? prio : 40;

  const rows = jobs.map((j) => ({
    user_id: userId,
    function_name: j.functionName,
    input_payload: j.payload,
    priority,
    max_attempts: j.maxAttempts ?? 3,
  }));

  const { data, error } = await supabase
    .from('job_queue')
    .insert(rows)
    .select('id, status, priority, function_name');

  if (error) throw new Error(`enqueueBatch failed: ${error.message}`);
  return (data ?? []) as QueuedJob[];
}

/**
 * Mark a job as done with result data.
 */
export async function completeJob(
  supabase: SupabaseClient,
  jobId: string,
  resultData?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('job_queue')
    .update({
      status: 'done',
      result_data: resultData ?? {},
      completed_at: new Date().toISOString(),
      locked_until: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) throw new Error(`completeJob failed: ${error.message}`);
}

/**
 * Mark a job as failed. Will be retried if attempts < max_attempts.
 */
export async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  errorMessage: string,
  currentAttempts: number,
  maxAttempts: number,
): Promise<void> {
  const shouldRetry = currentAttempts < maxAttempts;

  const { error } = await supabase
    .from('job_queue')
    .update({
      status: shouldRetry ? 'queued' : 'failed',
      error_message: errorMessage,
      locked_until: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
      ...(shouldRetry ? {} : { completed_at: new Date().toISOString() }),
    })
    .eq('id', jobId);

  if (error) throw new Error(`failJob failed: ${error.message}`);
}
