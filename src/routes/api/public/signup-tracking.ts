import { createFileRoute } from '@tanstack/react-router';

/**
 * Ingestion publique des évènements du tunnel d'inscription.
 *
 * L'adresse IP est lue côté serveur (jamais via un service tiers, bloqué par
 * les bloqueurs de publicité) puis immédiatement réduite à une empreinte
 * SHA-256 : aucune IP en clair n'est stockée. Les évènements provenant d'un
 * compte administrateur ou d'un robot sont ignorés silencieusement.
 *
 * Les données atterrissent dans `analytics_events` (table de tracking unique du
 * projet) avec `event_data = { page, device_type, context, ip_hash, variant }`.
 */

const ALLOWED_EVENTS = new Set([
  'signup_view',
  'signup_oauth_start',
  'signup_oauth_return',
  'signup_oauth_denied',
  'signup_oauth_abandon',
  'signup_form_submit',
  'signup_error',
  'signup_success',
]);

const ALLOWED_PAGES = new Set(['signup', 'auth']);

const BOT_UA = /bot|crawler|spider|facebookexternalhit|slurp|headlesschrome|lighthouse|pingdom|gtmetrix|preview/i;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    !!origin &&
    (/^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https:\/\/([a-z0-9-]+\.)*crawlers\.fr$/.test(origin) ||
      /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/.test(origin) ||
      /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/.test(origin));

  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': allowed ? origin! : 'https://crawlers.fr',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const Route = createFileRoute('/api/public/signup-tracking')({
  server: {
    handlers: {
      OPTIONS: ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) }),

      POST: async ({ request }) => {
        const headers = corsHeaders(request.headers.get('origin'));
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers });

        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: 'invalid json' }, 400);
        }

        const eventType = typeof payload['event_type'] === 'string' ? payload['event_type'] : '';
        if (!ALLOWED_EVENTS.has(eventType)) {
          return json({ error: 'unknown event_type' }, 400);
        }

        const userAgent =
          (typeof payload['user_agent'] === 'string' ? payload['user_agent'] : '') ||
          request.headers.get('user-agent') ||
          '';
        if (BOT_UA.test(userAgent)) {
          return json({ ok: true, skipped: 'bot' });
        }

        const rawPage = typeof payload['page'] === 'string' ? payload['page'] : 'signup';
        const page = ALLOWED_PAGES.has(rawPage) ? rawPage : 'signup';
        const str = (key: string, max: number): string | null => {
          const raw = payload[key];
          return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, max) : null;
        };

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

        // Résolution éventuelle de l'utilisateur : un admin ne doit rien produire.
        let userId: string | null = null;
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.toLowerCase().startsWith('bearer ')
          ? authHeader.slice(7).trim()
          : null;
        if (token) {
          const { data } = await supabaseAdmin.auth.getUser(token);
          userId = data.user?.id ?? null;
          if (userId) {
            const { data: roles } = await supabaseAdmin
              .from('user_roles')
              .select('role')
              .eq('user_id', userId)
              .eq('role', 'admin')
              .maybeSingle();
            if (roles) return json({ ok: true, skipped: 'admin' });
          }
        }

        const ip =
          request.headers.get('cf-connecting-ip') ||
          request.headers.get('x-real-ip') ||
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          '';
        const ipHash = ip ? await sha256Hex(ip.toLowerCase()) : null;

        const { error } = await supabaseAdmin.from('analytics_events').insert({
          event_type: eventType,
          session_id: str('session_id', 100),
          url: `/${page}`,
          user_id: userId,
          event_data: {
            page,
            device_type: str('device_type', 20),
            context: str('context', 200),
            variant: str('variant', 60),
            ip_hash: ipHash,
          },
        });

        if (error) {
          console.error('[signup-tracking] insert failed', error.message);
          return json({ ok: false }, 500);
        }

        return json({ ok: true });
      },
    },
  },
});
