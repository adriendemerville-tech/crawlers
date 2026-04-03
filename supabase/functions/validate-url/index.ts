import { stealthFetch } from '../_shared/stealthFetch.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

async function checkUrl(url: string): Promise<{ ok: boolean; status: number; finalUrl: string; contentLength: number }> {
  try {
    const { response } = await stealthFetch(url, {
      timeout: 8000,
      maxRetries: 1,
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, finalUrl: response.url || url, contentLength: text.length };
  } catch {
    return { ok: false, status: 0, finalUrl: url, contentLength: 0 };
  }
}

function isRealSite(result: { ok: boolean; status: number; contentLength: number; finalUrl: string }): boolean {
  // Accept 200-399 with enough content, or 403/503 (WAF/Cloudflare) if the response has some content
  // Many major sites (fnac.com, liberation.fr, etc.) return 403/503 to bot-like user agents but are real sites
  if ((result.status === 403 || result.status === 503) && result.contentLength > 50) return true;
  // Accept any response with substantial content (some WAFs return odd status codes)
  if (result.contentLength > 500) return true;
  return result.ok && result.contentLength > 200;
}

// Use Gemini to resolve brand name to official domain, then validate
async function searchBrandDomain(query: string): Promise<string | null> {
  try {
    const cleanQuery = query
      .replace(/^https?:\/\//, '')
      .replace(/\.(com|fr|org|net|io|co|eu)$/, '')
      .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçœæ\s-]/gi, '')
      .trim();

    if (!cleanQuery || cleanQuery.length < 2) return null;

    console.log(`[validate-url] Resolving brand via LLM: "${cleanQuery}"`);

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('[validate-url] LOVABLE_API_KEY not configured');
      return null;
    }

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        max_tokens: 100,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You are a domain resolver. Given a brand/company name, return ONLY the official website domain (e.g. "emmaus-france.org" or "croix-rouge.fr"). Return ONLY the domain, nothing else. No protocol, no path. If you are unsure, return "UNKNOWN".'
          },
          {
            role: 'user',
            content: `What is the official website domain for: "${cleanQuery}"?`
          }
        ]
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!res.ok) {
      console.error(`[validate-url] LLM error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const domain = data.choices?.[0]?.message?.content?.trim()
      ?.replace(/^https?:\/\//, '')
      ?.replace(/^www\./, '')
      ?.replace(/\/$/, '')
      ?.toLowerCase();

    if (!domain || domain === 'unknown' || domain.length < 4 || !domain.includes('.')) {
      console.log(`[validate-url] LLM returned no valid domain: "${domain}"`);
      return null;
    }

    console.log(`[validate-url] LLM suggested domain: ${domain}`);

    // Validate the LLM suggestion with both www and non-www
    const candidates = [`https://www.${domain}`, `https://${domain}`];
    for (const url of candidates) {
      const result = await checkUrl(url);
      if (isRealSite(result)) {
        console.log(`[validate-url] Brand resolved: "${cleanQuery}" → ${result.finalUrl || url}`);
        return result.finalUrl || url;
      }
    }

    // If HTTP validation failed but LLM confidently returned a domain,
    // trust it — many large sites (fnac.com, amazon.fr, etc.) block server-side requests entirely
    // Only trust domains that look legitimate (has a recognized TLD)
    const trustedTlds = ['.com', '.fr', '.org', '.net', '.eu', '.co', '.io', '.de', '.es', '.it', '.uk', '.be', '.ch', '.ca', '.us'];
    const hasTrustedTld = trustedTlds.some(tld => domain.endsWith(tld));
    if (hasTrustedTld && cleanQuery.length >= 2) {
      console.log(`[validate-url] Trusting LLM domain (HTTP blocked): "${cleanQuery}" → https://www.${domain}`);
      return `https://www.${domain}`;
    }

    return null;
  } catch (err) {
    console.error('[validate-url] Brand search error:', err);
    return null;
  }
}

Deno.serve(handleRequest(async (req) => {
try {
    const { urls, searchBrand } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return jsonError('urls array is required', 400);
    }

    const toCheck = urls.slice(0, 10) as string[];
    console.log(`[validate-url] Checking ${toCheck.length} URLs, searchBrand=${searchBrand || 'none'}`);

    const results = await Promise.all(
      toCheck.map(async (url: string) => {
        const formatted = url.startsWith('http') ? url : `https://${url}`;
        // Try the URL as-is first
        let result = await checkUrl(formatted);
        
        // If it fails and doesn't have www., try with www.
        if (!isRealSite(result) && !formatted.includes('://www.')) {
          const withWww = formatted.replace('://', '://www.');
          const wwwResult = await checkUrl(withWww);
          if (isRealSite(wwwResult)) {
            result = wwwResult;
          }
        }
        
        return {
          url: formatted,
          valid: isRealSite(result),
          status: result.status,
          finalUrl: result.finalUrl,
          contentLength: result.contentLength,
        };
      })
    );

    const anyValid = results.some(r => r.valid);
    let brandResult: string | null = null;

    // Always run brand search when original URL failed, even if a candidate matched
    // (candidates may match parking pages, LLM gives the real official domain)
    if (searchBrand) {
      brandResult = await searchBrandDomain(searchBrand);
    }

    console.log(`[validate-url] Results:`, results.map(r => `${r.url}: ${r.valid}`).join(', '));
    if (brandResult) console.log(`[validate-url] Brand fallback: ${brandResult}`);

    return jsonOk({ results, brandResult });
  } catch (err: any) {
    console.error('[validate-url] Error:', err);
    return jsonError(err.message, 500);
  }
}));