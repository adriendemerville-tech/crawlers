// Quick prerender check across major AI bot user-agents.
// POST { url } -> { results: [{ bot, ua, status, prerenderBot, cfWorker, title, contentLength, ms, error? }] }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BOTS: Array<{ name: string; ua: string }> = [
  { name: 'GPTBot', ua: 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)' },
  { name: 'CCBot', ua: 'CCBot/2.0 (https://commoncrawl.org/faq/)' },
  { name: 'Google-Extended', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; Google-Extended; +http://www.google.com/bot.html)' },
  { name: 'ClaudeBot', ua: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' },
  { name: 'Applebot-Extended', ua: 'Mozilla/5.0 (compatible; Applebot-Extended/0.1; +http://www.apple.com/go/applebot)' },
  { name: 'PerplexityBot', ua: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)' },
];

async function probe(url: string, bot: { name: string; ua: string }) {
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': bot.ua, 'Accept': 'text/html,*/*' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const text = await res.text();
    const titleMatch = text.match(/<title>([^<]*)<\/title>/i);
    const h1Match = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const ldCount = (text.match(/application\/ld\+json/gi) || []).length;
    return {
      bot: bot.name,
      ua: bot.ua,
      status: res.status,
      prerenderBot: res.headers.get('x-prerender-bot') || '',
      cfWorker: res.headers.get('x-cf-worker') || '',
      server: res.headers.get('server') || '',
      cfRay: res.headers.get('cf-ray') || '',
      title: titleMatch ? titleMatch[1].trim().slice(0, 200) : '',
      h1: h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '',
      jsonLdCount: ldCount,
      contentLength: text.length,
      ms: Date.now() - started,
    };
  } catch (e) {
    return {
      bot: bot.name,
      ua: bot.ua,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - started,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
    let target: URL;
    try { target = new URL(url); } catch { return new Response(JSON.stringify({ error: 'invalid url' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } }); }
    if (!['http:', 'https:'].includes(target.protocol)) {
      return new Response(JSON.stringify({ error: 'http(s) only' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
    const results = await Promise.all(BOTS.map((b) => probe(target.toString(), b)));
    return new Response(JSON.stringify({ url: target.toString(), checkedAt: new Date().toISOString(), results }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
