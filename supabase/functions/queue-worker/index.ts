/**
 * Queue Worker — processes jobs from job_queue in priority order.
 * 
 * Triggered by cron (every 30s) or manually.
 * Claims a batch of jobs atomically, executes them with concurrency control,
 * and respects rate limits for LLM calls.
 * 
 * Priority: agency_premium(10) > agency_pro(20) > new_user(30) > registered(40)
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { completeJob, failJob } from '../_shared/jobQueue.ts';

const BATCH_SIZE = 15;
const CONCURRENCY = 10;

interface JobRow {
  id: string;
  function_name: string;
  input_payload: Record<string, unknown>;
  user_id: string;
  attempts: number;
  max_attempts: number;
  priority: number;
}

/**
 * Execute a single job by invoking its target edge function.
 */
async function executeJob(supabase: ReturnType<typeof getServiceClient>, job: JobRow): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const url = `${supabaseUrl}/functions/v1/${job.function_name}`;

  // Inject user_id into payload so the target function knows who the caller is
  const payload = {
    ...job.input_payload,
    _queue_user_id: job.user_id,
    _queue_job_id: job.id,
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'unknown error');
      throw new Error(`${job.function_name} returned ${resp.status}: ${errorText.slice(0, 500)}`);
    }

    const result = await resp.json().catch(() => ({}));
    await completeJob(supabase, job.id, result);
  } catch (err) {
    await failJob(supabase, job.id, String(err), job.attempts, job.max_attempts);
  }
}

/**
 * Process jobs with controlled concurrency using a semaphore pattern.
 */
async function processWithConcurrency(
  supabase: ReturnType<typeof getServiceClient>,
  jobs: JobRow[],
  maxConcurrent: number,
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  let index = 0;

  async function worker() {
    while (index < jobs.length) {
      const job = jobs[index++];
      if (!job) break;
      try {
        await executeJob(supabase, job);
        processed++;
      } catch {
        failed++;
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, jobs.length) }, () => worker());
  await Promise.allSettled(workers);

  return { processed, failed };
}

/**
 * Recover stale processing jobs (locked_until expired).
 */
async function recoverStaleJobs(supabase: ReturnType<typeof getServiceClient>): Promise<number> {
  const { data, error } = await supabase
    .from('job_queue')
    .update({
      status: 'queued',
      locked_until: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('locked_until', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Recovery error:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

Deno.serve(handleRequest(async (req) => {
  try {
    const supabase = getServiceClient();

    // 1. Recover stale jobs
    const recovered = await recoverStaleJobs(supabase);

    // 2. Claim a batch (ordered by priority ASC, created_at ASC)
    const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;
    const { data: jobs, error } = await supabase.rpc('claim_jobs', {
      batch_size: BATCH_SIZE,
      worker_id: workerId,
    });

    if (error) {
      console.error('claim_jobs error:', error.message);
      return jsonError(`claim_jobs failed: ${error.message}`, 500);
    }

    const claimed = (jobs as JobRow[]) ?? [];
    if (claimed.length === 0) {
      return jsonOk({ message: 'No jobs to process', recovered });
    }

    console.log(`[queue-worker] Claimed ${claimed.length} jobs (recovered ${recovered} stale). Priorities: ${claimed.map(j => j.priority).join(',')}`);

    // 3. Process with concurrency control
    const result = await processWithConcurrency(supabase, claimed, CONCURRENCY);

    // 4. Get queue depth for monitoring
    const { count } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    return jsonOk({
      claimed: claimed.length,
      ...result,
      recovered,
      queue_depth: count ?? 0,
    });
  } catch (err) {
    console.error('[queue-worker] Fatal error:', err);
    return jsonError(String(err), 500);
  }
}));
