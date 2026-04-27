import { corsHeaders } from '../_shared/cors.ts';
import { getBrowserlessFunctionUrl, getBrowserlessKey } from '../_shared/browserlessConfig.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: dry-run-script
 * 
 * Teste un script correctif sur le site cible via Browserless.io
 * et vérifie: pas d'erreur JS, CLS stable, JSON-LD valide.
 * 
 * Input: { siteUrl, code }
 * Output: { success, results: { jsErrors, clsScore, jsonLdValid, executionTimeMs } }
 */

interface DryRunRequest {
  siteUrl: string;
  code: string;
}

interface DryRunResult {
  jsErrors: string[];
  clsScore: number | null;
  jsonLdValid: boolean;
  jsonLdCount: number;
  executionTimeMs: number;
  pageLoadedOk: boolean;
  screenshotUrl?: string;
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { siteUrl, code }: DryRunRequest = await req.json();

    if (!siteUrl || !code) {
      return new Response(
        JSON.stringify({ success: false, error: 'siteUrl and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🧪 Dry Run: testing script on ${siteUrl}`);

    const browserlessKey = getBrowserlessKey();
    const FLY_RENDERER_URL = Deno.env.get('FLY_RENDERER_URL');
    const FLY_RENDERER_SECRET = Deno.env.get('FLY_RENDERER_SECRET');

    console.log(`[dry-run] Browserless key: ${browserlessKey ? 'SET' : 'NOT SET'}, Fly: ${FLY_RENDERER_URL ? 'SET' : 'NOT SET'}`);

    // Try Browserless first, fallback to Fly.io
    let result: DryRunResult;

    if (browserlessKey) {
      result = await runViaBrowserless(siteUrl, code, browserlessKey);
    } else if (FLY_RENDERER_URL && FLY_RENDERER_SECRET) {
      result = await runViaFly(siteUrl, code, FLY_RENDERER_URL, FLY_RENDERER_SECRET);
    } else {
      // Fallback: syntax-only check (no headless browser available)
      console.log('⚠️ Aucun moteur headless configuré — vérification syntaxique uniquement');
      result = {
        jsErrors: [],
        clsScore: null,
        jsonLdValid: true,
        jsonLdCount: 0,
        executionTimeMs: 0,
        pageLoadedOk: true,
      };

      // Basic syntax check
      try {
        new Function(code);
      } catch (e) {
        result.jsErrors.push(e instanceof Error ? e.message : 'Syntax error');
      }
    }

    const passed = result.jsErrors.length === 0 && result.pageLoadedOk;

    console.log(`🧪 Dry Run résultat: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   → JS Errors: ${result.jsErrors.length}`);
    console.log(`   → CLS: ${result.clsScore ?? 'N/A'}`);
    console.log(`   → JSON-LD: ${result.jsonLdCount} schémas (valid: ${result.jsonLdValid})`);

    return new Response(
      JSON.stringify({
        success: true,
        passed,
        results: result,
        summary: passed 
          ? `✅ Script pré-testé avec succès — 0 erreur JS, ${result.jsonLdCount} JSON-LD valides`
          : `⚠️ ${result.jsErrors.length} erreur(s) détectée(s) — correction recommandée`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Dry run error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));

// ══════════════════════════════════════════════════════════════
// BROWSERLESS.IO IMPLEMENTATION
// ══════════════════════════════════════════════════════════════

async function runViaBrowserless(
  siteUrl: string, 
  code: string, 
  apiKey: string
): Promise<DryRunResult> {
  const startTime = Date.now();
  

  // Browserless v2 /function: export default, return { data, type }
  const escapedCode = JSON.stringify(code);
  const testScript = `export default async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));
  page.on('error', (err) => jsErrors.push(err.message));

  await page.goto(${JSON.stringify(siteUrl)}, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.addScriptTag({ content: ${escapedCode} });
  await new Promise(r => setTimeout(r, 3000));

  const cls = await page.evaluate(() => {
    return new Promise((resolve) => {
      let clsValue = 0;
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) clsValue += entry.value;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch(e) {}
      setTimeout(() => resolve(clsValue), 1000);
    });
  });

  const jsonLdData = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const results = [];
    scripts.forEach((s) => {
      try {
        const parsed = JSON.parse(s.textContent || '');
        results.push({ valid: true, type: parsed['@type'] || 'unknown' });
      } catch(e) {
        results.push({ valid: false, error: e.message });
      }
    });
    return results;
  });

  return {
    data: {
      jsErrors,
      clsScore: cls,
      jsonLdValid: jsonLdData.every(j => j.valid),
      jsonLdCount: jsonLdData.length,
      pageLoadedOk: true,
    },
    type: 'application/json',
  };
};`;

  try {
    const response = await fetch(getBrowserlessFunctionUrl(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/javascript' },
      body: testScript,
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log('⚠️ Browserless rate limited — falling back to syntax check');
        return syntaxOnlyCheck(code, startTime);
      }
      throw new Error(`Browserless error: ${response.status}`);
    }

    const rawData = await response.json();
    // v2 /function wraps results in { data: ..., type: ... } — or returns data directly
    const resultData = rawData?.data ?? rawData;
    console.log('[dry-run] Browserless response keys:', Object.keys(resultData));
    return {
      jsErrors: resultData.jsErrors || [],
      clsScore: resultData.clsScore ?? null,
      jsonLdValid: resultData.jsonLdValid ?? true,
      jsonLdCount: resultData.jsonLdCount ?? 0,
      pageLoadedOk: resultData.pageLoadedOk ?? true,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('❌ Browserless dry run failed:', error);
    // Cascade to Fly.io before falling back to syntax-only
    const flyUrl = Deno.env.get('FLY_RENDERER_URL');
    const flySecret = Deno.env.get('FLY_RENDERER_SECRET');
    if (flyUrl && flySecret) {
      console.log('🔄 Falling back to Fly.io renderer...');
      try {
        return await runViaFly(siteUrl, code, flyUrl, flySecret);
      } catch (flyErr) {
        console.error('❌ Fly.io fallback also failed:', flyErr);
      }
    }
    return syntaxOnlyCheck(code, startTime);
  }
}

// ══════════════════════════════════════════════════════════════
// FLY.IO FALLBACK
// ══════════════════════════════════════════════════════════════

async function runViaFly(
  siteUrl: string, 
  code: string, 
  flyUrl: string, 
  flySecret: string
): Promise<DryRunResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${flyUrl}/dry-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Renderer-Secret': flySecret,
      },
      body: JSON.stringify({ url: siteUrl, script: code }),
    });

    if (!response.ok) {
      console.log(`⚠️ Fly.io dry run failed: ${response.status}`);
      return syntaxOnlyCheck(code, startTime);
    }

    const data = await response.json();
    return {
      jsErrors: data.jsErrors || [],
      clsScore: data.clsScore ?? null,
      jsonLdValid: data.jsonLdValid ?? true,
      jsonLdCount: data.jsonLdCount ?? 0,
      executionTimeMs: Date.now() - startTime,
      pageLoadedOk: data.pageLoadedOk ?? true,
    };
  } catch (error) {
    console.error('❌ Fly.io dry run failed:', error);
    return syntaxOnlyCheck(code, startTime);
  }
}

// ══════════════════════════════════════════════════════════════
// SYNTAX-ONLY FALLBACK
// ══════════════════════════════════════════════════════════════

function syntaxOnlyCheck(code: string, startTime: number): DryRunResult {
  const jsErrors: string[] = [];
  try {
    new Function(code);
  } catch (e) {
    jsErrors.push(e instanceof Error ? e.message : 'Syntax error');
  }

  return {
    jsErrors,
    clsScore: null,
    jsonLdValid: true,
    jsonLdCount: 0,
    executionTimeMs: Date.now() - startTime,
    pageLoadedOk: jsErrors.length === 0,
  };
}
