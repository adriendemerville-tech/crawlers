import { corsHeaders } from '../_shared/cors.ts';

interface UaTest {
  label: string;
  ua: string;
  status: number | null;
  ok: boolean;
  blocked: boolean;
  contentLength: number;
  redirected: boolean;
  finalUrl: string | null;
  server: string | null;
  cfRay: string | null;
  via: string | null;
  setCookie: string | null;
  error: string | null;
  durationMs: number;
}

interface RedirectHop {
  from: string;
  to: string;
  status: number;
}

const UA_PROFILES: Array<{ label: string; ua: string }> = [
  { label: 'Chrome Desktop (Mozilla/5.0)', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { label: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { label: 'GPTBot (OpenAI)', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot' },
  { label: 'Crawlers.fr (legacy)', ua: 'CrawlersBot/1.0' },
  { label: 'curl/8', ua: 'curl/8.4.0' },
  { label: 'Aucun User-Agent', ua: '' },
];

function normalizeUrl(input: string): string | null {
  let url = (input || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    return u.toString();
  } catch {
    return null;
  }
}

async function manualRedirectChain(targetUrl: string, ua: string): Promise<{ hops: RedirectHop[]; finalUrl: string; finalStatus: number | null; error: string | null }> {
  const hops: RedirectHop[] = [];
  let current = targetUrl;
  let finalStatus: number | null = null;
  let error: string | null = null;
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(current, {
        method: 'GET',
        headers: ua ? { 'User-Agent': ua, 'Accept': 'text/html,*/*' } : { 'Accept': 'text/html,*/*' },
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      finalStatus = res.status;
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) break;
        const next = new URL(loc, current).toString();
        hops.push({ from: current, to: next, status: res.status });
        current = next;
        continue;
      }
      break;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      break;
    }
  }
  return { hops, finalUrl: current, finalStatus, error };
}

async function probeUA(targetUrl: string, label: string, ua: string): Promise<UaTest> {
  const start = Date.now();
  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  };
  if (ua) headers['User-Agent'] = ua;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const blocked = res.status === 403 || res.status === 401 || res.status === 429
      || /access denied|cloudflare|attention required|blocked|forbidden/i.test(text.slice(0, 4000));
    return {
      label,
      ua: ua || '(vide)',
      status: res.status,
      ok: res.ok,
      blocked,
      contentLength: text.length,
      redirected: res.redirected,
      finalUrl: res.url,
      server: res.headers.get('server'),
      cfRay: res.headers.get('cf-ray'),
      via: res.headers.get('via'),
      setCookie: res.headers.get('set-cookie'),
      error: null,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      label,
      ua: ua || '(vide)',
      status: null,
      ok: false,
      blocked: false,
      contentLength: 0,
      redirected: false,
      finalUrl: null,
      server: null,
      cfRay: null,
      via: null,
      setCookie: null,
      error: msg.includes('AbortError') || msg.includes('timeout') ? 'Timeout (>10s)' : msg,
      durationMs: Date.now() - start,
    };
  }
}

async function fetchRobots(origin: string): Promise<{ status: number | null; body: string | null; userAgentRules: Array<{ ua: string; disallow: string[]; allow: string[] }>; error: string | null }> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersDiagnostic/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { status: res.status, body: null, userAgentRules: [], error: null };
    }
    const body = await res.text();
    const rules: Array<{ ua: string; disallow: string[]; allow: string[] }> = [];
    let currentBlock: { ua: string; disallow: string[]; allow: string[] } | null = null;
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) continue;
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.+)$/);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const value = m[2].trim();
      if (key === 'user-agent') {
        if (currentBlock) rules.push(currentBlock);
        currentBlock = { ua: value, disallow: [], allow: [] };
      } else if (currentBlock && key === 'disallow') {
        currentBlock.disallow.push(value);
      } else if (currentBlock && key === 'allow') {
        currentBlock.allow.push(value);
      }
    }
    if (currentBlock) rules.push(currentBlock);
    return { status: res.status, body: body.slice(0, 4000), userAgentRules: rules, error: null };
  } catch (e) {
    return { status: null, body: null, userAgentRules: [], error: e instanceof Error ? e.message : String(e) };
  }
}

function extractSecurityHeaders(headers: Headers): Record<string, string | null> {
  return {
    'server': headers.get('server'),
    'x-powered-by': headers.get('x-powered-by'),
    'cf-ray': headers.get('cf-ray'),
    'cf-cache-status': headers.get('cf-cache-status'),
    'x-sucuri-id': headers.get('x-sucuri-id'),
    'x-sucuri-cache': headers.get('x-sucuri-cache'),
    'x-iinfo': headers.get('x-iinfo'),
    'x-cdn': headers.get('x-cdn'),
    'via': headers.get('via'),
    'x-frame-options': headers.get('x-frame-options'),
    'content-security-policy': headers.get('content-security-policy'),
    'strict-transport-security': headers.get('strict-transport-security'),
  };
}

function detectWaf(headers: Record<string, string | null>, body?: string): string[] {
  const detected: string[] = [];
  if (headers['cf-ray'] || headers['cf-cache-status']) detected.push('Cloudflare');
  if (headers['x-sucuri-id'] || headers['x-sucuri-cache']) detected.push('Sucuri');
  if (headers['x-iinfo']) detected.push('Imperva Incapsula');
  if (headers['server']?.toLowerCase().includes('akamai')) detected.push('Akamai');
  if (headers['server']?.toLowerCase().includes('aws')) detected.push('AWS WAF');
  if (headers['server']?.toLowerCase().includes('nginx') && body && /ovh/i.test(body)) detected.push('OVH (probable)');
  if (body && /cloudflare/i.test(body) && /attention required|checking your browser|just a moment/i.test(body)) {
    if (!detected.includes('Cloudflare')) detected.push('Cloudflare (challenge actif)');
  }
  return detected;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const target = normalizeUrl(url);
    if (!target) {
      return new Response(JSON.stringify({ success: false, error: 'URL invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const origin = new URL(target).origin;
    console.log(`🛡️ Diagnostic WAF: ${target}`);

    // 1. Test multi-UA en parallèle
    const uaTests = await Promise.all(
      UA_PROFILES.map(p => probeUA(target, p.label, p.ua))
    );

    // 2. Chaîne de redirections (avec UA navigateur)
    const browserUa = UA_PROFILES[0].ua;
    const redirectChain = await manualRedirectChain(target, browserUa);

    // 3. robots.txt
    const robots = await fetchRobots(origin);

    // 4. Headers de sécurité (depuis le test navigateur)
    let securityHeaders: Record<string, string | null> = {};
    let wafDetected: string[] = [];
    let bodySnippet = '';
    try {
      const finalRes = await fetch(target, {
        headers: { 'User-Agent': browserUa, 'Accept': 'text/html,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      securityHeaders = extractSecurityHeaders(finalRes.headers);
      const txt = await finalRes.text();
      bodySnippet = txt.slice(0, 2000);
      wafDetected = detectWaf(securityHeaders, txt);
    } catch (e) {
      console.warn('Security headers fetch failed:', e);
    }

    // 5. Verdict global
    const browserOk = uaTests[0].ok && !uaTests[0].blocked;
    const botBlocked = uaTests[1].blocked || (uaTests[1].status !== null && uaTests[1].status >= 400);
    const legacyBotBlocked = uaTests[3].blocked || (uaTests[3].status !== null && uaTests[3].status >= 400);

    const verdict: { level: 'ok' | 'warning' | 'error'; summary: string; recommendations: string[] } = {
      level: 'ok',
      summary: 'Le site est accessible normalement.',
      recommendations: [],
    };

    if (!browserOk) {
      verdict.level = 'error';
      verdict.summary = 'Le site bloque même un navigateur standard. Le scan ne peut pas aboutir.';
      if (wafDetected.length) {
        verdict.recommendations.push(`WAF détecté (${wafDetected.join(', ')}) — autoriser l'IP de Crawlers ou désactiver le challenge sur la page d'accueil.`);
      }
      if (uaTests[0].status === 403) verdict.recommendations.push('Erreur 403 : le pare-feu rejette la requête. Whitelister User-Agent "Mozilla/5.0" et l\'IP sortante de Supabase Edge.');
      if (uaTests[0].status === 503) verdict.recommendations.push('Erreur 503 : le serveur d\'origine est indisponible ou en maintenance.');
      if (uaTests[0].error?.includes('Timeout')) verdict.recommendations.push('Timeout : le site met >10s à répondre. Vérifier l\'hébergement ou le DNS.');
    } else if (legacyBotBlocked && !botBlocked) {
      verdict.level = 'warning';
      verdict.summary = 'Le navigateur passe, mais l\'ancien User-Agent "CrawlersBot/1.0" est bloqué. La mise à jour vers Mozilla/5.0 résout le problème.';
      verdict.recommendations.push('Aucune action côté site nécessaire — Crawlers utilise désormais un User-Agent standard.');
    } else if (botBlocked) {
      verdict.level = 'warning';
      verdict.summary = 'Le navigateur passe, mais les bots IA (GPTBot, Googlebot) sont bloqués. Cela limite la visibilité GEO.';
      verdict.recommendations.push('Autoriser GPTBot et Googlebot dans robots.txt et au niveau du WAF pour la visibilité IA.');
    }

    // robots.txt warnings
    if (robots.body) {
      const blocksAll = robots.userAgentRules.some(r => r.ua === '*' && r.disallow.includes('/'));
      if (blocksAll) {
        verdict.level = verdict.level === 'error' ? 'error' : 'warning';
        verdict.recommendations.push('robots.txt contient "Disallow: /" pour tous les bots — bloque l\'indexation complète du site.');
      }
    }

    // Redirections
    if (redirectChain.hops.length >= 4) {
      verdict.recommendations.push(`Trop de redirections (${redirectChain.hops.length} sauts) — peut causer des timeouts.`);
    }
    const hasMixedProtocol = redirectChain.hops.some(h => h.from.startsWith('http://') && h.to.startsWith('https://'));
    if (hasMixedProtocol && redirectChain.hops.length > 1) {
      verdict.recommendations.push('Redirection HTTP→HTTPS suivie d\'autres sauts — simplifier la chaîne pour de meilleures performances.');
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        url: target,
        origin,
        verdict,
        uaTests,
        redirectChain: {
          hops: redirectChain.hops,
          finalUrl: redirectChain.finalUrl,
          finalStatus: redirectChain.finalStatus,
          error: redirectChain.error,
        },
        robots,
        securityHeaders,
        wafDetected,
        bodySnippet,
        scannedAt: new Date().toISOString(),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('diagnose-waf error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
