import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(handleRequest(async (req) => {
try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers: HEADERS });

    const targetUrl = url.startsWith('http') ? url : `https://${url}`;

    // ── Fetch page ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Crawlers.fr/1.0 SEO Audit Bot' },
    });
    clearTimeout(timeout);
    const html = await resp.text();

    // ── Extract title and H1 via regex (lightweight, no DOM parser needed) ──
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const titleText = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';

    // ── Extract visible text (strip non-content elements) ──
    const visibleText = html
      .replace(/<(script|style|noscript|nav|header|footer)[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const allWords = visibleText.split(/\s+/).filter(w => w.length > 0);
    const first150Words = allWords.slice(0, 150).join(' ');
    const totalWordCount = allWords.length;

    // ── Keyword extraction from title/H1 ──
    const combinedTitle = `${titleText} ${h1Text}`.toLowerCase();
    const titleWords = combinedTitle.split(/[\s\-–—:|,]+/).filter(w => w.length >= 4);
    const stopwords = new Set([
      'pour', 'dans', 'avec', 'plus', 'votre', 'notre', 'cette', 'comment', 'tout',
      'what', 'your', 'this', 'that', 'with', 'from', 'about', 'best', 'guide', 'complete',
      'como', 'para', 'todo',
    ]);
    const keywords = [...new Set(titleWords.filter(w => !stopwords.has(w)))].slice(0, 6);

    // ── Analyze first 150 words ──
    const first150Lower = first150Words.toLowerCase();
    const matchedKeywords = keywords.filter(kw => first150Lower.includes(kw));
    const keywordDensity = keywords.length > 0 ? Math.round((matchedKeywords.length / keywords.length) * 100) : 0;
    const hasDirectAnswer = matchedKeywords.length >= Math.min(2, keywords.length);

    // ── Score calculation (0-100) ──
    let score = 0;

    // Keyword presence in first 150 words (40 pts)
    score += Math.min(40, Math.round((matchedKeywords.length / Math.max(1, keywords.length)) * 40));

    // First 150 words exist and are substantial (20 pts)
    const words150Count = first150Words.split(/\s+/).filter(w => w.length > 0).length;
    if (words150Count >= 150) score += 20;
    else if (words150Count >= 100) score += 15;
    else if (words150Count >= 50) score += 10;
    else score += 5;

    // Title/H1 coherence with content (20 pts)
    if (hasDirectAnswer) score += 20;
    else if (matchedKeywords.length >= 1) score += 10;

    // Content starts with a clear statement (not just navigation/breadcrumbs) (20 pts)
    const firstWords = first150Lower.split(/\s+/).slice(0, 10).join(' ');
    const hasNavigationStart = /^(accueil|home|menu|navigation|skip|aller au)/i.test(firstWords);
    if (!hasNavigationStart && words150Count >= 50) score += 20;
    else if (!hasNavigationStart) score += 10;

    // ── Build issues & strengths ──
    const issues: string[] = [];
    const strengths: string[] = [];

    if (hasDirectAnswer) {
      strengths.push(`Les 150 premiers mots contiennent ${matchedKeywords.length}/${keywords.length} mots-clés de l'intention`);
    } else {
      issues.push(`Seulement ${matchedKeywords.length}/${keywords.length} mots-clés détectés dans les 150 premiers mots`);
    }

    if (words150Count < 100) {
      issues.push(`Contenu trop court avant les 150 mots (${words150Count} mots visibles)`);
    }

    if (hasNavigationStart) {
      issues.push('Le contenu commence par des éléments de navigation au lieu d\'une réponse directe');
    }

    if (keywordDensity >= 60) {
      strengths.push(`Densité de mots-clés élevée dans l'introduction (${keywordDensity}%)`);
    }

    return new Response(JSON.stringify({
      success: true,
      score,
      details: {
        first150Words: first150Words.substring(0, 300) + (first150Words.length > 300 ? '...' : ''),
        words150Count,
        totalWordCount,
        titleText: titleText.substring(0, 100),
        h1Text: h1Text.substring(0, 100),
        keywords,
        matchedKeywords,
        keywordDensity,
        hasDirectAnswer,
      },
      issues,
      strengths,
    }), { headers: HEADERS });

  } catch (err) {
    console.error('[check-direct-answer]', err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      score: 0,
    }), { status: 500, headers: HEADERS });
  }
}));