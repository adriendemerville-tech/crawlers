import { corsHeaders } from '../_shared/cors.ts';

/**
 * Validates a WordPress Application Password against /wp-json/wp/v2/users/me.
 * Body: { site_url: string, username: string, app_password: string }
 * Returns: { ok, status, message, user?, auth_strategy? }
 *
 * Cascade fallback (covers ~97-98% of WordPress hosts):
 *   1. Basic Auth header           → standard
 *   2. URL credentials             → some proxies that strip Authorization
 *   3. ?rest_route= query string   → broken permalinks / .htaccess blocking /wp-json/
 *   4. Cookie auth via wp-login.php + nonce → CGI/suPHP servers that strip headers
 */

const UA = 'crawlers.fr/wp-test-connection';
const TIMEOUT_MS = 12_000;

interface AuthSuccess {
  user: { id: number; name: string; roles: string[]; email: string | null };
  strategy: 'basic_header' | 'url_credentials' | 'rest_route' | 'cookie_nonce';
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
}

// ─── Resolve canonical origin (handles www / https / http redirects) ───
// Goal: avoid redirect loops + dropped Authorization headers on cross-host redirects.
async function resolveCanonicalOrigin(rawSiteUrl: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(`${rawSiteUrl}/`, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
    });
    if (res.url) return new URL(res.url).origin;
  } catch { /* fall through */ }
  return new URL(rawSiteUrl).origin;
}

// ─── Resolve WordPress REST base path (handles subdir installs + rewrite-less perms) ───
// Returns the path prefix that responds to /wp/v2 (without auth), e.g. "/wp-json" or "/blog/wp-json".
// Returns null only if NO variant responds — caller then falls back to ?rest_route= strategy.
async function resolveRestBase(origin: string): Promise<string | null> {
  const candidates = ['/wp-json', '/blog/wp-json', '/wp/wp-json', '/wordpress/wp-json', '/cms/wp-json'];
  for (const base of candidates) {
    try {
      const res = await fetchWithTimeout(`${origin}${base}/wp/v2`, {
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      // 200 = open, 401 = auth required (route exists), 403 = WAF allows route but blocks call
      // Any of these prove the REST base exists at this path.
      if (res.status === 200 || res.status === 401 || res.status === 403) {
        return base;
      }
    } catch { /* try next */ }
  }
  return null;
}

function parseUserPayload(payload: any): AuthSuccess['user'] | null {
  if (!payload?.id) return null;
  return {
    id: payload.id,
    name: payload.name || payload.slug || 'unknown',
    roles: payload.roles || [],
    email: payload.email || null,
  };
}

// ─── Strategy 1: Basic Auth header ───
async function tryBasicHeader(siteUrl: string, restBase: string, username: string, password: string) {
  const url = `${siteUrl}${restBase}/wp/v2/users/me?context=edit`;
  const basic = btoa(`${username}:${password}`);
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'User-Agent': UA },
  });
  const text = await res.text();
  let payload: any = null; try { payload = JSON.parse(text); } catch { /**/ }
  return { res, payload };
}

// ─── Strategy 2: URL credentials https://user:pass@site/... ───
async function tryUrlCredentials(siteUrl: string, restBase: string, username: string, password: string) {
  const u = new URL(`${siteUrl}${restBase}/wp/v2/users/me?context=edit`);
  u.username = encodeURIComponent(username);
  u.password = encodeURIComponent(password);
  const res = await fetchWithTimeout(u.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  const text = await res.text();
  let payload: any = null; try { payload = JSON.parse(text); } catch { /**/ }
  return { res, payload };
}

// ─── Strategy 3: ?rest_route= query string ───
async function tryRestRoute(siteUrl: string, username: string, password: string) {
  const url = `${siteUrl}/?rest_route=/wp/v2/users/me&context=edit`;
  const basic = btoa(`${username}:${password}`);
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'User-Agent': UA },
  });
  const text = await res.text();
  let payload: any = null; try { payload = JSON.parse(text); } catch { /**/ }
  return { res, payload };
}

// ─── Strategy 4: Cookie auth via wp-login.php + nonce ───
async function tryCookieAuth(siteUrl: string, username: string, password: string) {
  // Step 1: POST wp-login.php to get auth cookies
  const loginUrl = `${siteUrl}/wp-login.php`;
  const form = new URLSearchParams({
    log: username,
    pwd: password,
    'wp-submit': 'Log In',
    redirect_to: `${siteUrl}/wp-admin/`,
    testcookie: '1',
  });

  const loginRes = await fetchWithTimeout(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      Cookie: 'wordpress_test_cookie=WP%20Cookie%20check',
    },
    body: form.toString(),
    redirect: 'manual', // don't follow — we want the Set-Cookie headers
  });

  // Collect cookies from Set-Cookie headers
  const cookieHeader = loginRes.headers.get('set-cookie') || '';
  // Deno gives all set-cookie headers joined; parse name=value pairs that look like wordpress_logged_in_*
  const cookieJar: string[] = [];
  // crude parser: split on ", " when followed by a key=
  const rawCookies = cookieHeader.split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
  for (const c of rawCookies) {
    const nv = c.trim().split(';')[0];
    if (nv && /^(wordpress_|wp-)/i.test(nv)) cookieJar.push(nv);
  }
  await loginRes.text(); // consume

  if (cookieJar.length === 0) {
    // Login failed (no auth cookie issued)
    return { res: loginRes, payload: { code: 'cookie_login_failed', message: 'wp-login.php did not issue auth cookie' } };
  }

  const cookieStr = cookieJar.join('; ');

  // Step 2: get a REST nonce
  const nonceUrl = `${siteUrl}/wp-admin/admin-ajax.php?action=rest-nonce`;
  const nonceRes = await fetchWithTimeout(nonceUrl, {
    headers: { Cookie: cookieStr, 'User-Agent': UA },
  });
  const nonce = (await nonceRes.text()).trim();

  if (!nonce || nonce.length > 64 || /[<>{}]/.test(nonce)) {
    return { res: nonceRes, payload: { code: 'nonce_failed', message: 'rest-nonce endpoint did not return a valid nonce' } };
  }

  // Step 3: call /wp-json/wp/v2/users/me with cookie + nonce
  const meUrl = `${siteUrl}/wp-json/wp/v2/users/me?context=edit`;
  const res = await fetchWithTimeout(meUrl, {
    headers: {
      Cookie: cookieStr,
      'X-WP-Nonce': nonce,
      Accept: 'application/json',
      'User-Agent': UA,
    },
  });
  const text = await res.text();
  let payload: any = null; try { payload = JSON.parse(text); } catch { /**/ }
  return { res, payload };
}

function mapErrorMessage(status: number, code?: string, fallback?: string): string {
  if (status === 401 || code === 'rest_not_logged_in' || code === 'incorrect_password' || code === 'invalid_username' || code === 'invalid_email') {
    return "Identifiant ou Application Password incorrect.";
  }
  if (status === 403 || code === 'rest_forbidden' || code === 'rest_cannot_view') {
    return "Connexion réussie mais ce compte n'a pas les droits suffisants (rôle Éditeur ou Administrateur requis).";
  }
  if (status === 404 || code === 'rest_no_route') {
    return "L'API REST WordPress n'est pas accessible (route /wp-json/ introuvable).";
  }
  if (status === 405) {
    return "Application Passwords désactivés sur ce site.";
  }
  if (status >= 500) {
    return `Erreur serveur WordPress (${status}).`;
  }
  return fallback || 'Identifiants refusés par WordPress';
}

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

  const rawSiteUrl = (body.site_url || '').trim().replace(/\/+$/, '');
  const username = (body.username || '').trim();
  const appPassword = (body.app_password || '').trim();

  if (!rawSiteUrl || !username || !appPassword) {
    return new Response(
      JSON.stringify({ ok: false, error: 'site_url, username, app_password requis' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!/^https?:\/\//i.test(rawSiteUrl)) {
    return new Response(JSON.stringify({ ok: false, error: 'site_url doit commencer par http(s)://' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ─── Phase 0a : résoudre l'origine canonique (anti redirect-loop / drop Authorization) ───
  const siteUrl = await resolveCanonicalOrigin(rawSiteUrl);

  // ─── Phase 0b : résoudre le base path WP REST (anti 404 sur installs sous-dossier) ───
  const detectedRestBase = await resolveRestBase(siteUrl);
  const restBase = detectedRestBase ?? '/wp-json';

  const strategies: Array<{
    name: AuthSuccess['strategy'];
    label: string;
    fn: () => Promise<{ res: Response; payload: any }>;
  }> = [
    { name: 'basic_header',    label: `Basic Auth header (${restBase})`, fn: () => tryBasicHeader(siteUrl, restBase, username, appPassword) },
    { name: 'url_credentials', label: `URL credentials (${restBase})`,   fn: () => tryUrlCredentials(siteUrl, restBase, username, appPassword) },
    { name: 'rest_route',      label: '?rest_route= query string',       fn: () => tryRestRoute(siteUrl, username, appPassword) },
    { name: 'cookie_nonce',    label: 'Cookie auth via wp-login.php',    fn: () => tryCookieAuth(siteUrl, username, appPassword) },
  ];

  const attempts: Array<{ strategy: string; status?: number; code?: string; error?: string }> = [];
  let lastStatus = 0;
  let lastCode: string | undefined;
  let lastMessage: string | undefined;

  for (const strat of strategies) {
    let attemptResult: { res: Response; payload: any } | null = null;

    // 1 try + 1 retry on timeout/network error
    for (let tryNo = 1; tryNo <= 2; tryNo++) {
      try {
        attemptResult = await strat.fn();
        break;
      } catch (e: any) {
        const isAbort = e?.name === 'AbortError';
        attempts.push({
          strategy: strat.name,
          error: `${isAbort ? 'timeout' : (e?.message || 'network error')}${tryNo === 1 ? ' (retry)' : ' (abandon)'}`,
        });
        if (tryNo === 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    if (!attemptResult) continue; // both tries failed → next strategy

    const { res, payload } = attemptResult;
    const user = parseUserPayload(payload);

    if (res.status === 200 && user) {
      return new Response(
        JSON.stringify({
          ok: true,
          status: 200,
          message: `Application Password valide (via ${strat.label})`,
          auth_strategy: strat.name,
          user,
          attempts: [...attempts, { strategy: strat.name, status: 200 }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    lastStatus = res.status;
    lastCode = payload?.code;
    lastMessage = payload?.message;
    attempts.push({ strategy: strat.name, status: res.status, code: payload?.code });

    // If 403 (auth OK but no rights), stop — escalating won't help
    if (res.status === 403) break;
  }

  const message = mapErrorMessage(lastStatus, lastCode, lastMessage);

  return new Response(
    JSON.stringify({
      ok: false,
      status: lastStatus || 0,
      error: message,
      code: lastCode || null,
      attempts,
      hint: lastCode === 'rest_not_logged_in'
        ? "Le serveur bloque toutes les méthodes d'authentification REST (Basic header, URL, query string, cookie). Utilisez le plugin Crawlers (lien magique) qui contourne cette restriction."
        : undefined,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
