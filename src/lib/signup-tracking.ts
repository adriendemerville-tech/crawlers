/**
 * Tracking du tunnel d'inscription — côté client.
 *
 * Règles : jamais bloquant (silent fail), jamais côté serveur (SSR), dédup de
 * `signup_view` par session, aucune IP lue côté client (le serveur s'en charge).
 */

export type SignupEventType =
  | 'signup_view'
  | 'signup_oauth_start'
  | 'signup_oauth_return'
  | 'signup_oauth_denied'
  | 'signup_oauth_abandon'
  | 'signup_form_submit'
  | 'signup_error'
  | 'signup_success';

const BOT_UA = /bot|crawler|spider|facebookexternalhit|slurp|headlesschrome|lighthouse|pingdom|gtmetrix/i;

function isBot(): boolean {
  return BOT_UA.test(navigator.userAgent || '');
}

export function getSessionId(): string {
  const key = 'analytics_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent || '';
  if (/ipad|tablet/i.test(ua) || (window.innerWidth >= 768 && window.innerWidth < 1024)) {
    return 'tablet';
  }
  if (/mobi|android|iphone/i.test(ua) || window.innerWidth < 768) return 'mobile';
  return 'desktop';
}

/** Message d'erreur normalisé, pour éviter un top-erreurs pollué par des variantes. */
export function normalizeSignupError(message: string | null | undefined): string {
  const raw = (message || '').toLowerCase();
  if (!raw) return 'unknown_error';
  if (raw.includes('already registered') || raw.includes('already exists')) return 'email_already_used';
  if (raw.includes('password')) return 'weak_password';
  if (raw.includes('email')) return 'invalid_email';
  if (raw.includes('rate') || raw.includes('too many')) return 'rate_limited';
  if (raw.includes('captcha') || raw.includes('turnstile')) return 'captcha_failed';
  if (raw.includes('network') || raw.includes('fetch')) return 'network_error';
  return raw.slice(0, 80);
}

export async function trackSignupEvent(
  eventType: SignupEventType,
  context?: string | null,
  page: 'signup' | 'auth' = 'signup',
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (isBot()) return;

    // Un rechargement de page ne doit pas gonfler les vues.
    if (eventType === 'signup_view') {
      const key = `signup_view_tracked_${page}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    } catch {
      // pas de session : évènement anonyme
    }

    void fetch('/api/public/signup-tracking', {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({
        event_type: eventType,
        page,
        device_type: getDeviceType(),
        session_id: getSessionId(),
        context: context ?? null,
        user_agent: navigator.userAgent,
      }),
    }).catch(() => {
      /* silent fail */
    });
  } catch {
    /* silent fail — le tracking ne bloque jamais l'inscription */
  }
}
