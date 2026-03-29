/**
 * Unified auth middleware for Edge Functions.
 * Single entry point: getAuthenticatedUser(req) → { user, isAdmin, planType, supabase }
 * 
 * Replaces the scattered auth patterns across 80+ edge functions.
 */
import { getServiceClient, getUserClient } from './supabaseClient.ts';

export interface AuthContext {
  userId: string;
  email: string;
  isAdmin: boolean;
  planType: 'free' | 'agency_pro' | 'agency_premium';
  subscriptionStatus: string | null;
  supabase: ReturnType<typeof getServiceClient>;
  userClient: ReturnType<typeof getUserClient>;
}

/**
 * Authenticate a request and return full user context.
 * Returns null if not authenticated.
 * 
 * Usage:
 * ```ts
 * const auth = await getAuthenticatedUser(req);
 * if (!auth) return new Response('Unauthorized', { status: 401 });
 * // auth.userId, auth.isAdmin, auth.planType are available
 * ```
 */
export async function getAuthenticatedUser(req: Request): Promise<AuthContext | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Service role bypass: internal calls from autopilot-engine etc.
  if (serviceRoleKey && token === serviceRoleKey) {
    const supabase = getServiceClient();
    const userClient = getUserClient(authHeader);
    return {
      userId: 'service-role',
      email: 'system@crawlers.fr',
      isAdmin: true,
      planType: 'agency_premium',
      subscriptionStatus: 'active',
      supabase,
      userClient,
    };
  }

  const userClient = getUserClient(authHeader);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  const supabase = getServiceClient();

  // Fetch profile + admin role in parallel
  const [profileResult, adminResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('plan_type, subscription_status')
      .eq('user_id', user.id)
      .single(),
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
  ]);

  const profile = profileResult.data;
  const isAdmin = adminResult.data === true;

  const isActivePremium = profile?.plan_type === 'agency_premium' &&
    (profile?.subscription_status === 'active' || profile?.subscription_status === 'canceling');
  const isActivePro = profile?.plan_type === 'agency_pro' &&
    (profile?.subscription_status === 'active' || profile?.subscription_status === 'canceling');

  // Admins are treated as agency_premium
  const effectivePlan = isAdmin ? 'agency_premium' : (isActivePremium ? 'agency_premium' : (isActivePro ? 'agency_pro' : 'free'));

  return {
    userId: user.id,
    email: user.email || '',
    isAdmin,
    planType: effectivePlan as 'free' | 'agency_pro' | 'agency_premium',
    subscriptionStatus: profile?.subscription_status || null,
    supabase,
    userClient,
  };
}

/**
 * Lightweight version: just verify auth, no profile/role lookup.
 * Use when you only need to confirm the user is logged in.
 */
export async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const userClient = getUserClient(authHeader);
  const { data: { user } } = await userClient.auth.getUser();
  return user?.id || null;
}
