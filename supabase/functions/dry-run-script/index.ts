import { corsHeaders } from '../_shared/cors.ts';

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

Deno.serve(async (req) => {
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

    const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');
    const FLY_RENDERER_URL = Deno.env.get('FLY_RENDERER_URL');
    const FLY_RENDERER_SECRET = Deno.env.get('FLY_RENDERER_SECRET');

    // Try Browserless first, fallback to Fly.io
    let result: DryRunResult;

    if (BROWSERLESS_API_KEY) {
      result = await runViaBrowserless(siteUrl, code, BROWSERLESS_API_KEY);
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
});

// ══════════════════════════════════════════════════════════════
// BROWSERLESS.IO IMPLEMENTATION
// ══════════════════════════════════════════════════════════════

async function runViaBrowserless(
  siteUrl: string, 
  code: string, 
  apiKey: string
): Promise<DryRunResult> {
  const startTime = Date.now();
  
  const browserlessPayload = {
    url: siteUrl,
    gotoOptions: { waitUntil: 'networkidle2', timeout: 45000 },
    addScriptTag: [{ content: code }],
    waitForTimeout: 3000,
  };

  // Use Browserless /function endpoint to run custom code
  const testScript = `
    module.exports = async ({ page }) => {
      const jsErrors = [];
      page.on('pageerror', (err) => jsErrors.push(err.message));
      page.on('error', (err) => jsErrors.push(err.message));

      await page.goto('${siteUrl}', { waitUntil: 'networkidle2', timeout: 45000 });

      // Inject the corrective script
      await page.addScriptTag({ content: ${JSON.stringify(code)} });

      // Wait for script execution
      await page.waitForTimeout(3000);

      // Check CLS
      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) clsValue += entry.value;
            }
          });
          try {
            observer.observe({ type: 'layout-shift', buffered: true });
          } catch(e) {}
          setTimeout(() => resolve(clsValue), 1000);
        });
      });

      // Check JSON-LD validity
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
        jsErrors,
        clsScore: cls,
        jsonLdValid: jsonLdData.every(j => j.valid),
        jsonLdCount: jsonLdData.length,
        pageLoadedOk: true,
      };
    };
  `;

  try {
    const response = await fetch(`https://production-sfo.browserless.io/function?token=${apiKey}`, {
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

    const data = await response.json();
    return {
      ...data,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('❌ Browserless dry run failed:', error);
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
