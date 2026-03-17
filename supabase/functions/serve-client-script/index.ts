import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Edge Function: serve-client-script
 * 
 * v2: Single API key per user (profiles.api_key) + automatic domain routing via Referer/Origin.
 * Also supports legacy tracked_sites.api_key for backward compatibility.
 * 
 * Optimized with:
 * - In-memory cache (TTL 60s) for rules
 * - Batched last_widget_ping updates (max 1 write per 5 min per site)
 * - Singleton Supabase client
 */

// ── In-memory caches ────────────────────────────────────────
interface CachedRules {
  rules: any[];
  domain: string;
  legacyScript: string;
  siteId: string;
  fetchedAt: number;
}

// Cache key = `${apiKey}::${domain}`
const rulesCache = new Map<string, CachedRules>();
const CACHE_TTL_MS = 60_000;

const lastPingUpdate = new Map<string, number>();
const PING_THROTTLE_MS = 5 * 60_000;

let globalSwitchCache: { enabled: boolean; fetchedAt: number } | null = null;
const GLOBAL_SWITCH_TTL_MS = 30_000;

async function isGloballyEnabled(): Promise<boolean> {
  const now = Date.now();
  if (globalSwitchCache && (now - globalSwitchCache.fetchedAt) < GLOBAL_SWITCH_TTL_MS) {
    return globalSwitchCache.enabled;
  }
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'sdk_enabled')
      .maybeSingle();
    const enabled = !(data && data.value === false);
    globalSwitchCache = { enabled, fetchedAt: now };
    return enabled;
  } catch {
    return true;
  }
}

function extractDomain(req: Request): string | null {
  // Try Referer first, then Origin
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      return url.hostname.replace(/^www\./, '');
    } catch { /* ignore */ }
  }
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const url = new URL(origin);
      return url.hostname.replace(/^www\./, '');
    } catch { /* ignore */ }
  }
  return null;
}

async function getSiteRules(apiKey: string, callerDomain: string | null, req: Request): Promise<CachedRules | null> {
  const now = Date.now();
  const cacheKey = `${apiKey}::${callerDomain || '_'}`;
  const cached = rulesCache.get(cacheKey);
  if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached;
  }

  const supabase = getServiceClient();

  // ── Strategy 1: Try profiles.api_key (new universal key) ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, api_key')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (profile && callerDomain) {
    // Find the tracked_site matching this user + caller domain
    const normalizedDomain = callerDomain.replace(/^www\./, '');
    const { data: sites } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id, current_config')
      .eq('user_id', profile.user_id)
      .or(`domain.eq.${normalizedDomain},domain.eq.www.${normalizedDomain}`)
      .limit(1);
    const site = sites?.[0] || null;

    if (site) {
      return await buildCacheEntry(supabase, site, cacheKey, now);
    }
    // Domain not tracked for this user — return empty
    return null;
  }

  if (profile && !callerDomain) {
    // No Referer/Origin — can't route. Return comment.
    return null;
  }

  // ── Strategy 2: Legacy fallback — try tracked_sites.api_key ──
  const { data: legacySite, error: siteErr } = await supabase
    .from('tracked_sites')
    .select('id, domain, user_id, current_config')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (siteErr || !legacySite) return null;

  return await buildCacheEntry(supabase, legacySite, cacheKey, now);
}

async function buildCacheEntry(supabase: any, site: any, cacheKey: string, now: number): Promise<CachedRules> {
  const { data: rules } = await supabase
    .from('site_script_rules')
    .select('url_pattern, payload_type, payload_data, is_active')
    .eq('domain_id', site.id)
    .eq('is_active', true)
    .order('url_pattern', { ascending: true });

  const activeRules = (rules || []).filter((r: any) => r.is_active);
  const legacyScript = (site.current_config as Record<string, any>)?.corrective_script || '';

  const entry: CachedRules = {
    rules: activeRules,
    domain: site.domain,
    legacyScript,
    siteId: site.id,
    fetchedAt: now,
  };

  rulesCache.set(cacheKey, entry);
  return entry;
}

function throttledPingUpdate(siteId: string) {
  const now = Date.now();
  const lastPing = lastPingUpdate.get(siteId) || 0;
  if (now - lastPing < PING_THROTTLE_MS) return;

  lastPingUpdate.set(siteId, now);
  const supabase = getServiceClient();
  supabase
    .from('tracked_sites')
    .update({ last_widget_ping: new Date().toISOString() })
    .eq('id', siteId)
    .then(() => {})
    .catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const apiKey = url.searchParams.get('key') || req.headers.get('x-crawlers-key') || '';

    if (!apiKey) {
      return new Response('// Crawlers.fr: missing API key', {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=60' },
      });
    }

    // 1. Global kill switch
    if (!await isGloballyEnabled()) {
      return new Response('// Crawlers.fr: SDK globally disabled', {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=60' },
      });
    }

    // 2. Extract caller domain from Referer/Origin
    const callerDomain = extractDomain(req);

    // 3. Get rules (cached 60s)
    const site = await getSiteRules(apiKey, callerDomain, req);
    if (!site) {
      return new Response('// Crawlers.fr: no matching site for this key/domain', {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=300' },
      });
    }

    // 4. Throttled ping
    throttledPingUpdate(site.siteId);

    // 5. Build script
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const sdkStatusUrl = `${supabaseUrl}/functions/v1/sdk-status`;
    const telemetryUrl = `${supabaseUrl}/functions/v1/sdk-status`;

    const rulesJson = JSON.stringify(site.rules.map((r: any) => ({
      p: r.url_pattern,
      t: r.payload_type,
      d: r.payload_data,
    })));

    const script = `/**
 * Crawlers.fr — Dynamic Multi-Page Router v2.0
 * Domain: ${site.domain}
 * Rules: ${site.rules.length}
 * Generated: ${new Date().toISOString()}
 */
(function(){
'use strict';

var RULES=${rulesJson};
var DOMAIN='${site.domain}';
var SDK_STATUS='${sdkStatusUrl}';
var TELEMETRY='${telemetryUrl}';

function sanitizeHtml(html){
  if(!html||typeof html!=='string')return'';
  return html
    .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi,'')
    .replace(/\\son\\w+\\s*=/gi,' data-blocked=')
    .replace(/javascript\\s*:/gi,'blocked:')
    .replace(/data\\s*:/gi,'blocked:');
}

function forceVisible(el){
  if(!el||!el.style)return;
  el.style.setProperty('display','block','important');
  el.style.setProperty('opacity','1','important');
  el.style.setProperty('visibility','visible','important');
  el.style.setProperty('position','static','important');
  el.style.setProperty('clip','auto','important');
  el.style.setProperty('clip-path','none','important');
}

function cleanExistingJsonLd(type){
  try{
    var existing=document.querySelectorAll('script[type="application/ld+json"]');
    for(var i=0;i<existing.length;i++){
      try{
        var data=JSON.parse(existing[i].textContent||'');
        if(data['@type']===type){
          existing[i].parentNode.removeChild(existing[i]);
        }
      }catch(e){}
    }
  }catch(e){}
}

function matchRule(pathname){
  var matched=[];
  for(var i=0;i<RULES.length;i++){
    var r=RULES[i];
    if(r.p==='GLOBAL'){
      matched.push({rule:r,specificity:0});
      continue;
    }
    if(r.p.endsWith('/*')){
      var prefix=r.p.slice(0,-1);
      if(pathname.indexOf(prefix)===0){
        matched.push({rule:r,specificity:prefix.length});
      }
    }
    else if(pathname===r.p||pathname===r.p+'/'){
      matched.push({rule:r,specificity:r.p.length+1000});
    }
  }
  matched.sort(function(a,b){return b.specificity-a.specificity;});
  return matched.map(function(m){return m.rule;});
}

function injectPayload(rule){
  var d=rule.d||{};
  var type=rule.t;

  if(type==='FAQPage'||type==='Organization'||type==='LocalBusiness'||type==='BreadcrumbList'||type==='Article'||type==='Product'){
    cleanExistingJsonLd(type);
    var s=document.createElement('script');
    s.type='application/ld+json';
    s.setAttribute('data-crawlers-rule',type);
    s.textContent=JSON.stringify(d);
    document.head.appendChild(s);
    return;
  }

  if(type==='HTML_INJECTION'&&d.html){
    var container=document.createElement('div');
    container.setAttribute('data-crawlers-rule','html');
    container.innerHTML=sanitizeHtml(d.html);
    forceVisible(container);

    var target=d.targetSelector?document.querySelector(d.targetSelector):null;
    if(target&&d.insertPosition==='before'){
      target.parentNode.insertBefore(container,target);
    }else if(target&&d.insertPosition==='after'){
      target.parentNode.insertBefore(container,target.nextSibling);
    }else{
      var footer=document.querySelector('footer');
      if(footer)footer.parentNode.insertBefore(container,footer);
      else document.body.appendChild(container);
    }
    return;
  }

  if(type==='GLOBAL_FIXES'&&d.script){
    try{
      var fn=new Function(d.script);
      fn();
    }catch(e){
      console.warn('[Crawlers.fr] Global fix error:',e);
    }
    return;
  }
}

function sendTelemetry(fixesApplied){
  try{
    if(navigator.sendBeacon){
      navigator.sendBeacon(TELEMETRY,JSON.stringify({
        domain:DOMAIN,
        event:'script_executed',
        fixes:fixesApplied,
        pathname:location.pathname,
        ts:Date.now()
      }));
    }
  }catch(e){}
}

function checkAndExecute(){
  try{
    var ctrl=new AbortController();
    var tid=setTimeout(function(){ctrl.abort();},2000);
    fetch(SDK_STATUS,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({domain:location.hostname}),
      signal:ctrl.signal
    }).then(function(r){
      clearTimeout(tid);
      return r.json();
    }).then(function(data){
      if(data&&data.isEnabled===false)return;
      executeRouter();
    }).catch(function(){
      clearTimeout(tid);
      executeRouter();
    });
  }catch(e){
    executeRouter();
  }
}

function executeRouter(){
  try{
    var pathname=location.pathname;
    var matched=matchRule(pathname);
    if(matched.length===0){
      ${site.legacyScript ? `
      try{
        ${site.legacyScript.replace(/`/g, '\\`').slice(0, 50000)}
      }catch(e){}` : '// No rules matched and no legacy script'}
      return;
    }

    var applied=0;
    for(var i=0;i<matched.length;i++){
      try{
        injectPayload(matched[i]);
        applied++;
      }catch(e){
        console.warn('[Crawlers.fr] Payload error:',e);
      }
    }

    sendTelemetry(applied);
  }catch(e){
    console.warn('[Crawlers.fr] Router error:',e);
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',checkAndExecute);
}else{
  var idle=typeof requestIdleCallback==='function'?requestIdleCallback:function(fn){setTimeout(fn,0);};
  idle(checkAndExecute);
}

})();`;

    return new Response(script, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'X-Crawlers-Rules': String(site.rules.length),
      },
    });

  } catch (error) {
    console.error('[serve-client-script] Error:', error);
    return new Response('// Crawlers.fr: server error (fail-open)', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' },
    });
  }
});
