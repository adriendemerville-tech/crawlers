import { corsHeaders } from '../_shared/cors.ts';

/**
 * Validates a WordPress Application Password against /wp-json/wp/v2/users/me.
 * Body: { site_url: string, username: string, app_password: string }
 * Returns: { ok, status, message, user?: { id, name, roles, capabilities? } }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { site_url?: string; username?: string; app_password?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const siteUrl = (body.site_url || '').trim().replace(/\/+$/, '');
  const username = (body.username || '').trim();
  // App passwords contain spaces by design; keep them, only trim outer whitespace.
  const appPassword = (body.app_password || '').trim();

  if (!siteUrl || !username || !appPassword) {
    return new Response(
      JSON.stringify({ ok: false, error: 'site_url, username, app_password requis' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!/^https?:\/\//i.test(siteUrl)) {
    return new Response(JSON.stringify({ ok: false, error: 'site_url doit commencer par http(s)://' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = `${siteUrl}/wp-json/wp/v2/users/me?context=edit`;
  const basic = btoa(`${username}:${appPassword}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/json',
        'User-Agent': 'crawlers.fr/wp-test-connection',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    // Try to parse JSON body either way (errors come back as JSON too)
    let payload: any = null;
    const text = await res.text();
    try { payload = JSON.parse(text); } catch { /* not JSON */ }

    if (res.status === 200 && payload?.id) {
      return new Response(
        JSON.stringify({
          ok: true,
          status: 200,
          message: 'Application Password valide',
          user: {
            id: payload.id,
            name: payload.name || payload.slug || username,
            roles: payload.roles || [],
            email: payload.email || null,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Map WP REST errors to clear messages (FR)
    let message = 'Identifiants refusés par WordPress';
    const code: string | undefined = payload?.code;
    if (res.status === 401 || code === 'rest_not_logged_in' || code === 'incorrect_password' || code === 'invalid_username' || code === 'invalid_email') {
      message = "Identifiant ou Application Password incorrect.";
    } else if (res.status === 403 || code === 'rest_forbidden' || code === 'rest_cannot_view') {
      message = "Connexion réussie mais ce compte n'a pas les droits suffisants (rôle Éditeur ou Administrateur requis).";
    } else if (res.status === 404 || code === 'rest_no_route') {
      message = "L'API REST WordPress n'est pas accessible (route /wp-json/ introuvable). Vérifiez les permaliens.";
    } else if (res.status === 405) {
      message = "Application Passwords désactivés sur ce site (souvent : site en HTTP, ou hébergeur qui les bloque).";
    } else if (res.status >= 500) {
      message = `Erreur serveur WordPress (${res.status}).`;
    } else if (payload?.message) {
      message = payload.message;
    }

    return new Response(
      JSON.stringify({ ok: false, status: res.status, error: message, code: code || null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    const isAbort = e?.name === 'AbortError';
    return new Response(
      JSON.stringify({
        ok: false,
        error: isAbort
          ? "Le site WordPress n'a pas répondu dans les 12 secondes."
          : `Impossible de joindre le site : ${e?.message || 'erreur réseau'}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
