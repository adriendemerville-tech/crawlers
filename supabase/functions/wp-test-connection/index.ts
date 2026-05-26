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
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT_MS = 12_000;

interface AuthSuccess {
  user: { id: number; name: string; roles: string[]; email: string | null };
  strategy: 'basic_header' | 'url_credentials' | 'rest_route' | 'cookie_nonce';
}

async function fetchOnce(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
}

// ─── Smart fetch: handles 429 (Retry-After) + 502/503/504 (1 retry) transparently ───
// Returns the final Response. Caller still reads body once.
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  let res = await fetchOnce(url, init);

  // 429 — respect Retry-After (seconds or HTTP-date), max 1 retry, capped at 5s
  if (res.status === 429) {
    const ra = res.headers.get('retry-after');
    let delayMs = 1000;
    if (ra) {
      const asInt = parseInt(ra, 10);
      if (!Number.isNaN(asInt)) delayMs = Math.min(asInt * 1000, 5000);
      else {
        const dateMs = Date.parse(ra);
        if (!Number.isNaN(dateMs)) delayMs = Math.max(0, Math.min(dateMs - Date.now(), 5000));
      }
    }
    await new Promise((r) => setTimeout(r, delayMs));
    try { await res.body?.cancel(); } catch { /**/ }
    res = await fetchOnce(url, init);
  }

  // 502/503/504 — single retry after 800ms (transient gateway hiccups)
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    await new Promise((r) => setTimeout(r, 800));
    try { await res.body?.cancel(); } catch { /**/ }
    res = await fetchOnce(url, init);
  }

  return res;
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

// ─── Detect HTML interceptor (WAF, login wall, maintenance page) ───
// When the body is HTML instead of JSON, an upstream protection caught the request.
function detectHtmlInterceptor(text: string, contentType: string | null): { code: string; message: string; vendor?: string } | null {
  const head = (text || '').slice(0, 4096).toLowerCase();
  const ct = (contentType || '').toLowerCase();
  const looksHtml = head.startsWith('<!doctype html') || head.startsWith('<html') || ct.includes('text/html');

  // ModSecurity / OVH-style fingerprints — detected even when body isn't HTML
  // (OVH mutualisé renvoie parfois du texte brut "Not Acceptable" sans <html>)
  const isModSec =
    head.includes('mod_security') ||
    head.includes('modsecurity') ||
    head.includes('not acceptable') ||
    head.includes('reference&#32;') ||
    head.includes('mwp-') ||
    head.includes('ovhcloud') ||
    head.includes('access denied') && head.includes('rule');
  if (isModSec) {
    return { code: 'html_interceptor', vendor: 'ModSecurity', message: "ModSecurity (souvent OVH mutualisé) bloque la requête API. Ajoutez dans .htaccess : SetEnvIf Authorization \"(.*)\" HTTP_AUTHORIZATION=$1 — ou utilisez le plugin Crawlers (lien magique) qui contourne ModSecurity." };
  }

  if (!looksHtml) return null;

  if (head.includes('wordfence')) {
    return { code: 'html_interceptor', vendor: 'Wordfence', message: "Wordfence intercepte les requêtes API et renvoie une page HTML au lieu du JSON. Whitelistez l'IP du serveur Crawlers ou désactivez la règle bloquante." };
  }
  if (head.includes('sucuri') || head.includes('cloudproxy')) {
    return { code: 'html_interceptor', vendor: 'Sucuri', message: "Sucuri WAF bloque l'accès à l'API REST. Whitelistez l'IP serveur Crawlers dans le tableau de bord Sucuri." };
  }
  if (head.includes('cloudflare') && (head.includes('attention required') || head.includes('challenge') || head.includes('cf-error'))) {
    return { code: 'html_interceptor', vendor: 'Cloudflare', message: "Cloudflare présente un challenge (Bot Fight Mode / Under Attack). Désactivez le challenge pour /wp-json/ ou whitelistez l'IP." };
  }
  if (head.includes('imunify')) {
    return { code: 'html_interceptor', vendor: 'Imunify360', message: "Imunify360 bloque l'API REST. Whitelistez l'IP serveur depuis cPanel." };
  }
  if (head.includes('maintenance') || head.includes('be right back') || head.includes('briefly unavailable')) {
    return { code: 'html_interceptor', vendor: 'Maintenance', message: "Le site WordPress est en mode maintenance. Réessayez une fois la maintenance terminée." };
  }
  if (head.includes('wp-login') || head.includes('name="log"') || head.includes('id="loginform"')) {
    return { code: 'html_interceptor', vendor: 'Login wall', message: "Une protection redirige les requêtes API vers la page de login (souvent un plugin de masquage d'admin). Désactivez la protection pour les routes /wp-json/." };
  }
  return { code: 'html_interceptor', message: "Le serveur renvoie une page HTML au lieu du JSON attendu. Une protection (WAF, plugin de sécurité, page de maintenance) intercepte les requêtes API." };
}

function applyInterceptorDetection(res: Response, payload: any, rawText: string): any {
  if (payload && typeof payload === 'object' && payload.code) return payload;
  const detected = detectHtmlInterceptor(rawText, res.headers.get('content-type'));
  return detected || payload;
}

// 403 sans code JSON connu = blocage UA/.htaccess/WAF avant WordPress.
// Retry avec UA navigateur pour contourner les règles "block bot UA".
function shouldRetryWithBrowserUa(res: Response, payload: any): boolean {
  if (res.status !== 403) return false;
  if (payload?.code === 'html_interceptor') return false; // déjà identifié
  if (payload?.code?.startsWith('rest_')) return false;   // vraie réponse WP
  return true;
}

// ─── Strategy 1: Basic Auth header ───
async function tryBasicHeader(siteUrl: string, restBase: string, username: string, password: string) {
  const url = `${siteUrl}${restBase}/wp/v2/users/me?context=edit`;
  const basic = btoa(`${username}:${password}`);
  const doFetch = (ua: string) => fetchWithTimeout(url, {
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'User-Agent': ua },
  });

  let res = await doFetch(UA);
  let text = await res.text();
  let payload: any = null; try { payload = JSON.parse(text); } catch { /**/ }
  payload = applyInterceptorDetection(res, payload, text);

  // 403 UA-blocking → retry navigateur
  if (shouldRetryWithBrowserUa(res, payload)) {
    res = await doFetch(BROWSER_UA);
    text = await res.text();
    payload = null; try { payload = JSON.parse(text); } catch { /**/ }
    payload = applyInterceptorDetection(res, payload, text);
    if (res.status === 200 && payload?.id) {
      payload._ua_fallback = true; // pour log/debug
    }
  }

  // 401 disambiguation — retry WITHOUT context=edit.
  if (res.status === 401 && payload?.code !== 'html_interceptor') {
    try {
      const probeUrl = `${siteUrl}${restBase}/wp/v2/users/me`;
      const probeRes = await fetchWithTimeout(probeUrl, {
        headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'User-Agent': UA },
      });
      const probeText = await probeRes.text();
      let probePayload: any = null; try { probePayload = JSON.parse(probeText); } catch { /**/ }
      if (probeRes.status === 200 && probePayload?.id) {
        return {
          res: new Response(null, { status: 403 }),
          payload: { code: 'rest_forbidden_context', message: 'Identifiants valides mais rôle insuffisant (Éditeur ou Administrateur requis pour le contexte édition).' },
        };
      }
    } catch { /* ignore — keep original 401 */ }
  }

  return { res, payload };
}

// ─── Strategy 2: URL credentials https://user:pass@site/... ───
async function tryUrlCredentials(siteUrl: string, restBase: string, username: string, password: string) {
  const u = new URL(`${siteUrl}${restBase}/wp/v2/users/me?context=edit`);
  u.username = encodeURIComponent(username);
  u.password = encodeURIComponent(password);
  const doFetch = (ua: string) => fetchWithTimeout(u.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': ua },
  });
  let res = await doFetch(UA);
  let text = await res.text();
  let payload: any = null; try { payload = JSON.parse(text); } catch { /**/ }
  payload = applyInterceptorDetection(res, payload, text);
  if (shouldRetryWithBrowserUa(res, payload)) {
    res = await doFetch(BROWSER_UA);
    text = await res.text();
    payload = null; try { payload = JSON.parse(text); } catch { /**/ }
    payload = applyInterceptorDetection(res, payload, text);
    if (res.status === 200 && payload?.id) payload._ua_fallback = true;
  }
  return { res, payload };
}

// ─── Strategy 3: ?rest_route= query string ───
async function tryRestRoute(siteUrl: string, username: string, password: string) {
  const url = `${siteUrl}/?rest_route=/wp/v2/users/me&context=edit`;
  const basic = btoa(`${username}:${password}`);
  const doFetch = (ua: string) => fetchWithTimeout(url, {
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'User-Agent': ua },
  });
  let res = await doFetch(UA);
  let text = await res.text();
  let payload: any = null; try { payload = JSON.parse(text); } catch { /**/ }
  payload = applyInterceptorDetection(res, payload, text);
  if (shouldRetryWithBrowserUa(res, payload)) {
    res = await doFetch(BROWSER_UA);
    text = await res.text();
    payload = null; try { payload = JSON.parse(text); } catch { /**/ }
    payload = applyInterceptorDetection(res, payload, text);
    if (res.status === 200 && payload?.id) payload._ua_fallback = true;
  }
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
  // html_interceptor → fallback contains the specific vendor message
  if (code === 'html_interceptor' && fallback) {
    return fallback;
  }
  if (status === 401 || code === 'rest_not_logged_in' || code === 'incorrect_password' || code === 'invalid_username' || code === 'invalid_email') {
    return "Identifiant ou Application Password incorrect.";
  }
  if (code === 'rest_forbidden_context') {
    return "Identifiants valides mais rôle insuffisant : ce compte n'a pas le droit d'édition (rôle Éditeur ou Administrateur requis).";
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
          resolved_origin: siteUrl,
          rest_base: restBase,
          rest_base_detected: detectedRestBase !== null,
          user,
          attempts: [...attempts, { strategy: strat.name, status: 200 }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    lastStatus = res.status;
    lastCode = payload?.code;
    lastMessage = payload?.message;
    const vendorTag = payload?.vendor ? ` [${payload.vendor}]` : '';
    attempts.push({ strategy: strat.name, status: res.status, code: payload?.code ? `${payload.code}${vendorTag}` : undefined });

    // If 403 (auth OK but no rights), stop — escalating won't help
    if (res.status === 403) break;
    // If an HTML interceptor (WAF / login wall / maintenance) caught us, the other strategies will hit the same wall.
    if (payload?.code === 'html_interceptor') break;
  }

  const message = mapErrorMessage(lastStatus, lastCode, lastMessage);
  const isInterceptor = lastCode === 'html_interceptor';

  return new Response(
    JSON.stringify({
      ok: false,
      status: lastStatus || 0,
      error: message,
      code: lastCode || null,
      resolved_origin: siteUrl,
      rest_base: restBase,
      rest_base_detected: detectedRestBase !== null,
      attempts,
      hint: isInterceptor
        ? "Une protection serveur (WAF / plugin sécurité / page maintenance) intercepte les requêtes API avant qu'elles n'atteignent WordPress. Le plugin Crawlers (lien magique) contourne cette restriction sans configuration serveur."
        : lastCode === 'rest_not_logged_in'
          ? "Le serveur bloque toutes les méthodes d'authentification REST (Basic header, URL, query string, cookie). Utilisez le plugin Crawlers (lien magique) qui contourne cette restriction."
          : (detectedRestBase === null
            ? "Aucune route /wp-json détectée à la racine ni dans /blog, /wp, /wordpress, /cms. Vérifiez que WordPress est bien installé et que l'API REST n'est pas désactivée."
            : undefined),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
