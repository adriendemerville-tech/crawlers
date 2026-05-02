/**
 * update-claims-audit — Sprint 2 du Pipeline Update
 *
 * Skill atomique #2 : extrait les "claims" factuels de l'artefact `extracted`
 * (statistiques, dates, affirmations chiffrées, citations) et tente de les vérifier
 * via SerpAPI (recherches ciblées sur chaque claim).
 *
 * Inputs : { slug, max_claims? }   // slug d'un artefact `extracted` existant
 * Output : { artifact_id, claims: [{ text, type, verdict, sources[] }] }
 *
 * Persiste un artefact stage='claims'. Réutilise la skill `serpapi-actions` (gateway interne).
 */
import { authAndGate, getExtractedArtifact, upsertArtifact, corsHeaders, jsonResp } from '../_shared/updatePipelineGuards.ts';

type ClaimType = 'stat' | 'date' | 'quote' | 'superlative' | 'study';
interface Claim {
  text: string;
  type: ClaimType;
  verdict: 'verified' | 'unverified' | 'contradicted' | 'unknown';
  confidence: number; // 0-1
  sources: { url: string; snippet: string; domain: string }[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Détecte les phrases "claimables" (avec stat / date / superlatif / étude). */
function extractClaims(text: string, max: number): Claim[] {
  const sentences = (text.match(/[^.!?]+[.!?]+/g) || []).map((s) => s.trim());
  const seen = new Set<string>();
  const claims: Claim[] = [];

  for (const raw of sentences) {
    if (claims.length >= max) break;
    const s = raw.trim();
    if (s.length < 50 || s.length > 300) continue;
    const key = s.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;

    let type: ClaimType | null = null;
    if (/\b\d+([.,]\d+)?\s*(%|pour\s?cent|percent)\b/i.test(s)) type = 'stat';
    else if (/\b(19|20)\d{2}\b/.test(s) && /\b(en|since|depuis|in)\b/i.test(s)) type = 'date';
    else if (/«[^»]{20,200}»|"[^"]{20,200}"/.test(s)) type = 'quote';
    else if (/\b(étude|study|research|rapport|report|enquête|survey|sondage)\b/i.test(s)) type = 'study';
    else if (/\b(leader|premier|meilleur|n°\s?1|number\s?one|seul|unique|first)\b/i.test(s)) type = 'superlative';

    if (!type) continue;
    seen.add(key);
    claims.push({ text: s, type, verdict: 'unknown', confidence: 0, sources: [] });
  }

  return claims;
}

/** Vérifie un claim via SerpAPI (top 3 résultats organiques). */
async function verifyClaim(claim: Claim, serpapiKey: string, lang = 'fr'): Promise<Claim> {
  // Query : on garde 12-15 mots significatifs
  const query = claim.text
    .replace(/["«»"]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 14)
    .join(' ');

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('hl', lang);
  url.searchParams.set('gl', lang === 'fr' ? 'fr' : 'us');
  url.searchParams.set('num', '5');
  url.searchParams.set('api_key', serpapiKey);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ...claim, verdict: 'unknown', confidence: 0 };
    const data = await res.json();
    const organic = (data?.organic_results || []) as Array<{
      link?: string; snippet?: string; title?: string;
    }>;
    const sources = organic.slice(0, 3).map((r) => ({
      url: r.link || '',
      snippet: (r.snippet || r.title || '').slice(0, 220),
      domain: (() => { try { return new URL(r.link || '').hostname; } catch { return ''; } })(),
    })).filter((s) => s.url);

    // Heuristique simple de verdict
    const numMatch = claim.text.match(/\b(\d+([.,]\d+)?)\b/);
    let verdict: Claim['verdict'] = 'unverified';
    let confidence = 0.2;
    if (sources.length > 0) {
      verdict = 'unverified';
      confidence = 0.4;
      if (numMatch) {
        const num = numMatch[1].replace(',', '.');
        const matchingSnippet = sources.find((s) => s.snippet.includes(num));
        if (matchingSnippet) {
          verdict = 'verified';
          confidence = 0.75;
        }
      }
    }
    return { ...claim, verdict, confidence, sources };
  } catch {
    return { ...claim, verdict: 'unknown', confidence: 0 };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const guard = await authAndGate(req);
    if (!guard.ok) return jsonResp(guard.body, guard.status);

    const body = await req.json().catch(() => ({}));
    const { slug, max_claims } = body as { slug?: string; max_claims?: number };
    if (!slug) return jsonResp({ error: 'slug is required' }, 400);

    const extracted = await getExtractedArtifact(guard.admin, guard.userId, slug);
    if (!extracted) {
      return jsonResp({
        error: 'extracted_artifact_missing',
        message: "Lance d'abord update-extract-content pour ce slug.",
      }, 404);
    }

    // On retravaille à partir des H1+H2+H3 + meta + (si dispo) un retry HTML léger
    const payload = extracted.payload as any;
    const corpus = [
      payload?.title,
      payload?.meta_description,
      payload?.og_description,
      ...(payload?.h1 || []),
      ...(payload?.h2 || []),
      ...(payload?.h3 || []),
    ].filter(Boolean).join('. ');

    // Re-fetch pour obtenir le body complet (ne consomme pas de quota externe)
    let fullText = corpus;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8_000);
      const res = await fetch(extracted.url, {
        headers: { 'User-Agent': 'CrawlersUpdatePipeline/1.0 (+https://crawlers.fr)' },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      clearTimeout(t);
      if (res.ok) {
        const html = await res.text();
        fullText = `${corpus}. ${stripHtml(html)}`;
      }
    } catch { /* fallback corpus */ }

    const max = Math.min(Math.max(Number(max_claims) || 8, 1), 15);
    const candidates = extractClaims(fullText, max);

    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    let claims: Claim[] = candidates;
    if (SERPAPI_KEY && candidates.length > 0) {
      // séquentiel pour rester sous le quota et éviter les rate limits
      const verified: Claim[] = [];
      for (const c of candidates) {
        verified.push(await verifyClaim(c, SERPAPI_KEY));
      }
      claims = verified;
    }

    const summary = {
      total: claims.length,
      verified: claims.filter((c) => c.verdict === 'verified').length,
      unverified: claims.filter((c) => c.verdict === 'unverified').length,
      contradicted: claims.filter((c) => c.verdict === 'contradicted').length,
      unknown: claims.filter((c) => c.verdict === 'unknown').length,
      avg_confidence: claims.length
        ? Number((claims.reduce((s, c) => s + c.confidence, 0) / claims.length).toFixed(2))
        : 0,
    };

    const { data: artifact, error } = await upsertArtifact(guard.admin, {
      userId: guard.userId,
      tracked_site_id: extracted.tracked_site_id,
      slug,
      url: extracted.url,
      stage: 'claims',
      payload: { claims, summary, audited_at: new Date().toISOString(), serpapi_used: !!SERPAPI_KEY },
      source: 'manual',
    });

    if (error) {
      console.error('[update-claims-audit] persist error', error);
      return jsonResp({ error: 'persist_failed', detail: error.message }, 500);
    }

    return jsonResp({
      success: true,
      artifact_id: artifact.id,
      slug,
      summary,
      claims,
    });
  } catch (e) {
    console.error('[update-claims-audit] fatal', e);
    return jsonResp({ error: 'internal', message: (e as Error).message }, 500);
  }
});
