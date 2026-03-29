/**
 * Fair Use Policy v2 — uses consolidated RPC for 1 DB call instead of 3.
 * 
 * Commercially labeled "Illimité" for Pro Agency, but silently enforces
 * reasonable usage limits to prevent API cost explosion.
 */
import { getServiceClient, getUserClient } from './supabaseClient.ts';

// ── Fair Use Limits by plan ─────────────────────────────────────────
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
  | 'target_queries'
  | 'cocoon_chat'
  | 'cocoon_logic'
  | 'local_seo_audit';

const LIMITS: Record<string, Record<ActionType, FairUseLimits>> = {
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
    cocoon_chat:             { hourly: 15, daily: 50 },
    cocoon_logic:            { hourly: 3,  daily: 8 },
    local_seo_audit:         { hourly: 3,  daily: 10 },
  },
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
    cocoon_chat:             { hourly: 40, daily: 200 },
    cocoon_logic:            { hourly: 10, daily: 40 },
    local_seo_audit:         { hourly: 10, daily: 50 },
  },
};

// ── In-memory fallback counter ──
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

// ── Main function ───────────────────────────────────────────

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
 * Uses consolidated RPC: 1 DB call = admin check + hourly count + daily count + record usage.
 */
export async function checkFairUse(
  userId: string,
  action: ActionType,
  planType: string = 'free',
): Promise<FairUseResult> {
  const planLimits = LIMITS[planType] || LIMITS.free;
  const actionLimits = planLimits[action];
  if (!actionLimits) return { allowed: true };

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

  try {
    const supabase = getServiceClient();

    // Single RPC call: checks admin + counts + records usage atomically
    const { data, error } = await supabase.rpc('check_fair_use_v2', {
      p_user_id: userId,
      p_action: action,
      p_hourly_limit: actionLimits.hourly,
      p_daily_limit: actionLimits.daily,
    });

    if (error) {
      console.error('[FairUse] RPC error (allowing):', error);
      return { allowed: true };
    }

    const result = data as any;

    if (result.is_admin) return { allowed: true };

    if (!result.allowed) {
      const isHourly = result.reason === 'hourly_limit';
      console.warn(`[FairUse] BLOCKED ${userId} on ${action}: ${isHourly ? 'hourly' : 'daily'} limit`);
      return {
        allowed: false,
        reason: isHourly
          ? 'Vous avez atteint la limite d\'utilisation horaire. Réessayez dans quelques minutes.'
          : 'Vous avez atteint la limite d\'utilisation journalière. Réessayez demain.',
        hourly_count: result.hourly_count,
        daily_count: result.daily_count,
        hourly_limit: result.hourly_limit,
        daily_limit: result.daily_limit,
      };
    }

    return {
      allowed: true,
      hourly_count: result.hourly_count,
      daily_count: result.daily_count,
      hourly_limit: result.hourly_limit,
      daily_limit: result.daily_limit,
    };
  } catch (e) {
    console.error('[FairUse] Error (allowing):', e);
    return { allowed: true };
  }
}

/**
 * Helper: extract userId and planType from request + supabase.
 */
// ── Monthly Fair Use (for content creation) ──────────────────────

const MONTHLY_LIMITS: Record<string, Record<string, number>> = {
  free:            { content_creation: 5 },
  agency_pro:      { content_creation: 100 },
  agency_premium:  { content_creation: 150 },
};

interface MonthlyFairUseResult {
  allowed: boolean;
  reason?: string;
  monthly_count?: number;
  monthly_limit?: number;
  resets_at?: string;
}

/**
 * Check monthly fair use limits (e.g. content creation).
 * Uses check_monthly_fair_use RPC: 1 DB call.
 */
export async function checkMonthlyFairUse(
  userId: string,
  action: string,
  planType: string = 'free',
): Promise<MonthlyFairUseResult> {
  const planLimits = MONTHLY_LIMITS[planType] || MONTHLY_LIMITS.free;
  const limit = planLimits[action];
  if (limit === undefined) return { allowed: true };

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc('check_monthly_fair_use', {
      p_user_id: userId,
      p_action: action,
      p_monthly_limit: limit,
    });

    if (error) {
      console.error('[MonthlyFairUse] RPC error (allowing):', error);
      return { allowed: true };
    }

    const result = data as any;
    if (result.is_admin) return { allowed: true };

    if (!result.allowed) {
      console.warn(`[MonthlyFairUse] BLOCKED ${userId} on ${action}: monthly limit (${result.monthly_count}/${limit})`);
      return {
        allowed: false,
        reason: `Vous avez atteint la limite mensuelle de ${limit} contenus. Renouvellement le ${result.resets_at?.substring(0, 10) || 'premier du mois'}.`,
        monthly_count: result.monthly_count,
        monthly_limit: result.monthly_limit,
        resets_at: result.resets_at,
      };
    }

    return {
      allowed: true,
      monthly_count: result.monthly_count,
      monthly_limit: result.monthly_limit,
    };
  } catch (e) {
    console.error('[MonthlyFairUse] Error (allowing):', e);
    return { allowed: true };
  }
}

/**
 * Helper: extract userId and planType from request + supabase.
 */
export async function getUserContext(req: Request): Promise<{
  userId: string;
  planType: string;
  supabase: ReturnType<typeof getUserClient>;
} | null> {
  const authHeader = req.headers.get('Authorization') || '';
  const supabase = getUserClient(authHeader);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch plan type
  const adminClient = getServiceClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('plan_type, subscription_status')
    .eq('user_id', user.id)
    .single();

  const planType = (profile?.plan_type === 'agency_premium' && 
    (profile?.subscription_status === 'active' || profile?.subscription_status === 'canceling'))
    ? 'agency_premium'
    : (profile?.plan_type === 'agency_pro' && 
      (profile?.subscription_status === 'active' || profile?.subscription_status === 'canceling'))
      ? 'agency_pro' : 'free';

  return { userId: user.id, planType, supabase };
}
