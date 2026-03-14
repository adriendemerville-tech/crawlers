import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Edge Function: serve-client-script
 * 
 * Serves the dynamic client-side router JS for a given tracked_site API key.
 * The script includes all active rules and implements:
 * - Longest-match-wins routing
 * - Anti-XSS (DOMPurify-lite sanitization)
 * - Anti-cloaking (forced visibility CSS)
 * - JSON-LD dedup (removes pre-existing ld+json)
 * - Telemetry ping
 * - Kill switch check
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API key from query string or header
    const url = new URL(req.url);
    const apiKey = url.searchParams.get('key') || req.headers.get('x-crawlers-key') || '';

    if (!apiKey) {
      return new Response('// Crawlers.fr: missing API key', {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=60' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Look up the tracked site by API key
    const { data: site, error: siteErr } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id, current_config')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (siteErr || !site) {
      return new Response('// Crawlers.fr: invalid API key', {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=300' },
      });
    }

    // 2. Check global kill switch
    const { data: globalSwitch } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'sdk_enabled')
      .maybeSingle();

    if (globalSwitch && globalSwitch.value === false) {
      return new Response('// Crawlers.fr: SDK globally disabled', {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=60' },
      });
    }

    // 3. Check feature flag for multipage router
    const { data: featureFlag } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'enable_multipage_router')
      .maybeSingle();

    const multipageEnabled = featureFlag?.value !== false;

    // 4. Fetch active rules for this domain
    const { data: rules, error: rulesErr } = await supabase
      .from('site_script_rules')
      .select('url_pattern, payload_type, payload_data, is_active')
      .eq('domain_id', site.id)
      .eq('is_active', true)
      .order('url_pattern', { ascending: true });

    if (rulesErr) {
      console.error('[serve-client-script] Rules fetch error:', rulesErr);
    }

    const activeRules = (rules || []).filter(r => r.is_active);

    // 5. Also get the legacy corrective_script from current_config
    const legacyScript = (site.current_config as Record<string, any>)?.corrective_script || '';

    // 6. Build the client-side router script
    const sdkStatusUrl = `${supabaseUrl}/functions/v1/sdk-status`;
    const telemetryUrl = `${supabaseUrl}/functions/v1/sdk-status`;

    const rulesJson = JSON.stringify(activeRules.map(r => ({
      p: r.url_pattern,
      t: r.payload_type,
      d: r.payload_data,
    })));

    const script = `/**
 * Crawlers.fr — Dynamic Multi-Page Router v1.0
 * Domain: ${site.domain}
 * Rules: ${activeRules.length}
 * Generated: ${new Date().toISOString()}
 */
(function(){
'use strict';

var RULES=${rulesJson};
var DOMAIN='${site.domain}';
var SDK_STATUS='${sdkStatusUrl}';
var TELEMETRY='${telemetryUrl}';

// ═══ ANTI-XSS: Sanitize HTML payloads ═══
function sanitizeHtml(html){
  if(!html||typeof html!=='string')return'';
  // Strip script tags, event handlers, javascript: URIs
  return html
    .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi,'')
    .replace(/\\son\\w+\\s*=/gi,' data-blocked=')
    .replace(/javascript\\s*:/gi,'blocked:')
    .replace(/data\\s*:/gi,'blocked:');
}

// ═══ ANTI-CLOAKING: Force visibility on injected elements ═══
function forceVisible(el){
  if(!el||!el.style)return;
  el.style.setProperty('display','block','important');
  el.style.setProperty('opacity','1','important');
  el.style.setProperty('visibility','visible','important');
  el.style.setProperty('position','static','important');
  el.style.setProperty('clip','auto','important');
  el.style.setProperty('clip-path','none','important');
}

// ═══ JSON-LD DEDUP: Remove pre-existing ld+json to prevent conflicts ═══
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

// ═══ ROUTING: Longest-match-wins ═══
function matchRule(pathname){
  var matched=[];
  for(var i=0;i<RULES.length;i++){
    var r=RULES[i];
    if(r.p==='GLOBAL'){
      matched.push({rule:r,specificity:0});
      continue;
    }
    // Wildcard pattern: /blog/* matches /blog/anything
    if(r.p.endsWith('/*')){
      var prefix=r.p.slice(0,-1);
      if(pathname.indexOf(prefix)===0){
        matched.push({rule:r,specificity:prefix.length});
      }
    }
    // Exact match
    else if(pathname===r.p||pathname===r.p+'/'){
      matched.push({rule:r,specificity:r.p.length+1000});
    }
  }
  // Sort by specificity descending (longest match wins)
  matched.sort(function(a,b){return b.specificity-a.specificity;});
  return matched.map(function(m){return m.rule;});
}

// ═══ INJECT PAYLOAD ═══
function injectPayload(rule){
  var d=rule.d||{};
  var type=rule.t;

  // JSON-LD payloads → inject in <head>
  if(type==='FAQPage'||type==='Organization'||type==='LocalBusiness'||type==='BreadcrumbList'||type==='Article'||type==='Product'){
    cleanExistingJsonLd(type);
    var s=document.createElement('script');
    s.type='application/ld+json';
    s.setAttribute('data-crawlers-rule',type);
    s.textContent=JSON.stringify(d);
    document.head.appendChild(s);
    return;
  }

  // HTML payloads → sanitize + inject with forced visibility
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

  // GLOBAL_FIXES → execute the corrective script
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

// ═══ TELEMETRY ═══
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

// ═══ KILL SWITCH CHECK ═══
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
      // Fail-open
      executeRouter();
    });
  }catch(e){
    executeRouter();
  }
}

// ═══ MAIN ROUTER ═══
function executeRouter(){
  try{
    var pathname=location.pathname;
    var matched=matchRule(pathname);
    if(matched.length===0){
      ${legacyScript ? `
      // Fallback to legacy corrective script
      try{
        ${legacyScript.replace(/`/g, '\\`').slice(0, 50000)}
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

// ═══ ENTRY POINT ═══
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',checkAndExecute);
}else{
  var idle=typeof requestIdleCallback==='function'?requestIdleCallback:function(fn){setTimeout(fn,0);};
  idle(checkAndExecute);
}

})();`;

    // Update last_widget_ping
    await supabase
      .from('tracked_sites')
      .update({ last_widget_ping: new Date().toISOString() })
      .eq('id', site.id);

    return new Response(script, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'X-Crawlers-Rules': String(activeRules.length),
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
