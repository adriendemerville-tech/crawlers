/**
 * Fair Use Policy — invisible daily/hourly caps for ALL users (including Pro).
 * 
 * Commercially labeled "Illimité" for Pro Agency, but silently enforces
 * reasonable usage limits to prevent API cost explosion.
 * 
 * Uses analytics_events table for counting (already exists, no new table needed).
 * Falls back to in-memory counters if DB is unavailable.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Fair Use Limits by plan ─────────────────────────────────────────
// These are intentionally generous — only meant to block bots/scrapers/abuse

interface FairUseLimits {
  hourly: number;
  daily: number;
}

type ActionType =
  | 'expert_audit'
  | 'geo_check'
  | 'llm_check'
  | 'pagespeed_check'
  | 'crawl_site'
  | 'corrective_code'
  | 'strategic_audit'
  | 'llm_depth'
  | 'audit_compare'
  | 'hallucination_diagnosis'
  | 'target_queries';

const LIMITS: Record<string, Record<ActionType, FairUseLimits>> = {
  // Free users: low limits (credits already gate them, this is anti-bot)
  free: {
    expert_audit:            { hourly: 5,  daily: 15 },
    geo_check:               { hourly: 10, daily: 30 },
    llm_check:               { hourly: 5,  daily: 15 },
    pagespeed_check:         { hourly: 10, daily: 30 },
    crawl_site:              { hourly: 3,  daily: 5 },
    corrective_code:         { hourly: 5,  daily: 15 },
    strategic_audit:         { hourly: 3,  daily: 10 },
    llm_depth:               { hourly: 5,  daily: 15 },
    audit_compare:           { hourly: 3,  daily: 10 },
    hallucination_diagnosis: { hourly: 3,  daily: 10 },
    target_queries:          { hourly: 5,  daily: 15 },
  },
  // Pro Agency: generous but capped — these are HIGH, meant only to stop abuse
  agency_pro: {
    expert_audit:            { hourly: 20, daily: 100 },
    geo_check:               { hourly: 30, daily: 200 },
    llm_check:               { hourly: 20, daily: 100 },
    pagespeed_check:         { hourly: 30, daily: 200 },
    crawl_site:              { hourly: 5,  daily: 20 },
    corrective_code:         { hourly: 15, daily: 80 },
    strategic_audit:         { hourly: 10, daily: 50 },
    llm_depth:               { hourly: 15, daily: 80 },
    audit_compare:           { hourly: 10, daily: 50 },
    hallucination_diagnosis: { hourly: 10, daily: 50 },
    target_queries:          { hourly: 15, daily: 80 },
  },
};

// ── In-memory fallback counter (per-isolate, resets on cold start) ──
const memoryCounters = new Map<string, { count: number; resetAt: number }>();

function checkMemoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memoryCounters.get(key);
  if (!entry || now > entry.resetAt) {
    memoryCounters.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// ── Main function ───────────────────────────────────────────────────

interface FairUseResult {
  allowed: boolean;
  reason?: string;
  hourly_count?: number;
  daily_count?: number;
  hourly_limit?: number;
  daily_limit?: number;
}

/**
 * Check if a user is within fair use limits.
 * Returns { allowed: true } or { allowed: false, reason: '...' }.
 * 
 * IMPORTANT: Admins bypass all limits.
 */
export async function checkFairUse(
  userId: string,
  action: ActionType,
  planType: string = 'free',
): Promise<FairUseResult> {
  // Get limits for this plan (default to free)
  const planLimits = LIMITS[planType] || LIMITS.free;
  const actionLimits = planLimits[action];
  if (!actionLimits) {
    // Unknown action — allow (don't break things)
    return { allowed: true };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Fallback to in-memory if no DB
  if (!supabaseUrl || !serviceKey) {
    const hourlyOk = checkMemoryLimit(`${userId}:${action}:h`, actionLimits.hourly, 3600_000);
    const dailyOk = checkMemoryLimit(`${userId}:${action}:d`, actionLimits.daily, 86400_000);
    if (!hourlyOk) return { allowed: false, reason: 'Limite horaire atteinte. Réessayez dans quelques minutes.' };
    if (!dailyOk) return { allowed: false, reason: 'Limite journalière atteinte. Réessayez demain.' };
    return { allowed: true };
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Check admin status — admins are truly unlimited
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (isAdmin === true) return { allowed: true };

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600_000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Count hourly usage
    const { count: hourlyCount } = await supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', `fair_use:${action}`)
      .gte('created_at', oneHourAgo);

    // Count daily usage
    const { count: dailyCount } = await supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', `fair_use:${action}`)
      .gte('created_at', todayStart);

    const hCount = hourlyCount || 0;
    const dCount = dailyCount || 0;

    if (hCount >= actionLimits.hourly) {
      console.warn(`[FairUse] BLOCKED ${userId} on ${action}: ${hCount}/${actionLimits.hourly} hourly`);
      return {
        allowed: false,
        reason: 'Vous avez atteint la limite d\'utilisation horaire. Réessayez dans quelques minutes.',
        hourly_count: hCount,
        daily_count: dCount,
        hourly_limit: actionLimits.hourly,
        daily_limit: actionLimits.daily,
      };
    }

    if (dCount >= actionLimits.daily) {
      console.warn(`[FairUse] BLOCKED ${userId} on ${action}: ${dCount}/${actionLimits.daily} daily`);
      return {
        allowed: false,
        reason: 'Vous avez atteint la limite d\'utilisation journalière. Réessayez demain.',
        hourly_count: hCount,
        daily_count: dCount,
        hourly_limit: actionLimits.hourly,
        daily_limit: actionLimits.daily,
      };
    }

    // Record this usage (fire-and-forget)
    supabase.from('analytics_events').insert({
      user_id: userId,
      event_type: `fair_use:${action}`,
      event_data: { plan: planType, action },
    }).then(() => {}).catch(() => {});

    return {
      allowed: true,
      hourly_count: hCount + 1,
      daily_count: dCount + 1,
      hourly_limit: actionLimits.hourly,
      daily_limit: actionLimits.daily,
    };
  } catch (e) {
    // On error, allow (fail-open) — don't break production
    console.error('[FairUse] Error (allowing):', e);
    return { allowed: true };
  }
}

/**
 * Helper: extract userId and planType from request + supabase.
 * Returns null if user not authenticated.
 */
export async function getUserContext(req: Request): Promise<{
  userId: string;
  planType: string;
  supabase: ReturnType<typeof createClient>;
} | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch plan type
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await adminClient
    .from('profiles')
    .select('plan_type, subscription_status')
    .eq('user_id', user.id)
    .single();

  const planType = (profile?.plan_type === 'agency_pro' && 
    (profile?.subscription_status === 'active' || profile?.subscription_status === 'canceling'))
    ? 'agency_pro' : 'free';

  return { userId: user.id, planType, supabase };
}
