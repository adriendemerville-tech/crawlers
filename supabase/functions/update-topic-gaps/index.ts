/**
 * update-topic-gaps — Sprint 2 du Pipeline Update
 *
 * Skill atomique #3 : compare la couverture sémantique (H1/H2/H3) de notre page
 * `extracted` à celle d'un ou plusieurs concurrents. Réutilise `audit-competitor-url`
 * pour récupérer la structure SEO/GEO du concurrent, puis calcule les gaps thématiques.
 *
 * Inputs : { slug, competitor_urls: string[] }   // slug d'un artefact `extracted`
 * Output : { artifact_id, gaps: [...], coverage_score }
 */
import { authAndGate, getExtractedArtifact, upsertArtifact, corsHeaders, jsonResp } from '../_shared/updatePipelineGuards.ts';

const STOPWORDS = new Set([
  'le','la','les','un','une','des','de','du','et','ou','à','au','aux','en','dans','sur','pour','par','avec','sans','ce','cette','ces','son','sa','ses','est','sont','être','avoir','que','qui','quoi','dont','où','the','a','an','of','to','and','or','in','on','for','with','is','are','be','have','has','what','how','why','when','where',
]);

function tokenize(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/** ngrams 1-2 sur une liste de headings */
function topicSet(headings: string[]): { unigrams: Set<string>; bigrams: Set<string> } {
  const uni = new Set<string>();
  const bi = new Set<string>();
  for (const h of headings) {
    const toks = tokenize(h);
    for (const t of toks) uni.add(t);
    for (let i = 0; i < toks.length - 1; i++) bi.add(`${toks[i]} ${toks[i + 1]}`);
  }
  return { unigrams: uni, bigrams: bi };
}

interface CompetitorTopics {
  url: string;
  hostname: string;
  ok: boolean;
  error?: string;
  headings: string[];
  word_count: number;
}

async function fetchCompetitor(url: string, authHeader: string, supabaseUrl: string): Promise<CompetitorTopics> {
  // Réutilise audit-competitor-url (déjà branché DataForSEO + analyse HTML)
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/audit-competitor-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ url, dryRun: true }),
    });
    if (!res.ok) {
      // fallback: scrape minimal direct
      return await directScrape(url);
    }
    const data = await res.json();
    const headings = [
      ...(data?.h1List || data?.audit?.h1 || []),
      ...(data?.h2List || data?.audit?.h2 || []),
      ...(data?.h3List || data?.audit?.h3 || []),
    ].filter(Boolean);
    if (headings.length === 0) return await directScrape(url);
    return {
      url,
      hostname: new URL(url).hostname,
      ok: true,
      headings,
      word_count: data?.wordCount || data?.audit?.wordCount || 0,
    };
  } catch (e) {
    return await directScrape(url).catch(() => ({
      url,
      hostname: (() => { try { return new URL(url).hostname; } catch { return url; } })(),
      ok: false,
      error: (e as Error).message,
      headings: [],
      word_count: 0,
    }));
  }
}

async function directScrape(url: string): Promise<CompetitorTopics> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9_000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CrawlersUpdatePipeline/1.0 (+https://crawlers.fr)' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      return { url, hostname: new URL(url).hostname, ok: false, error: `HTTP ${res.status}`, headings: [], word_count: 0 };
    }
    const html = await res.text();
    const grab = (tag: string) => {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      const out: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const t = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (t) out.push(t);
      }
      return out;
    };
    const headings = [...grab('h1'), ...grab('h2'), ...grab('h3')];
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      url,
      hostname: new URL(url).hostname,
      ok: true,
      headings,
      word_count: text ? text.split(/\s+/).length : 0,
    };
  } catch (e) {
    return { url, hostname: (() => { try { return new URL(url).hostname; } catch { return url; } })(), ok: false, error: (e as Error).message, headings: [], word_count: 0 };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const guard = await authAndGate(req);
    if (!guard.ok) return jsonResp(guard.body, guard.status);

    const body = await req.json().catch(() => ({}));
    const { slug, competitor_urls } = body as { slug?: string; competitor_urls?: string[] };
    if (!slug) return jsonResp({ error: 'slug is required' }, 400);
    if (!Array.isArray(competitor_urls) || competitor_urls.length === 0) {
      return jsonResp({ error: 'competitor_urls is required (1-3 urls)' }, 400);
    }
    const competitors = competitor_urls.slice(0, 3);

    const extracted = await getExtractedArtifact(guard.admin, guard.userId, slug);
    if (!extracted) {
      return jsonResp({ error: 'extracted_artifact_missing', message: "Lance update-extract-content avant." }, 404);
    }

    const ourHeadings = [
      ...((extracted.payload as any)?.h1 || []),
      ...((extracted.payload as any)?.h2 || []),
      ...((extracted.payload as any)?.h3 || []),
    ];
    const ourTopics = topicSet(ourHeadings);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('Authorization')!;
    const compResults = await Promise.all(
      competitors.map((u) => fetchCompetitor(u, authHeader, supabaseUrl)),
    );

    // Topics présents chez ≥1 concurrent et absents chez nous
    const competitorTopics = compResults.map((c) => ({
      ...c,
      topics: topicSet(c.headings),
    }));

    const allCompUni = new Set<string>();
    const allCompBi = new Set<string>();
    for (const c of competitorTopics) {
      for (const u of c.topics.unigrams) allCompUni.add(u);
      for (const b of c.topics.bigrams) allCompBi.add(b);
    }

    const missingUnigrams = Array.from(allCompUni).filter((u) => !ourTopics.unigrams.has(u));
    const missingBigrams = Array.from(allCompBi).filter((b) => !ourTopics.bigrams.has(b));

    // Scoring : pour chaque topic manquant, fréquence chez les concurrents
    const scoreTopic = (topic: string, isBigram: boolean) => {
      const present = competitorTopics.filter((c) =>
        (isBigram ? c.topics.bigrams : c.topics.unigrams).has(topic),
      );
      return {
        topic,
        kind: isBigram ? 'bigram' : 'unigram' as 'bigram' | 'unigram',
        present_in: present.length,
        examples: present.slice(0, 2).map((c) => {
          const headingMatch = c.headings.find((h) => tokenize(h).join(' ').includes(topic));
          return { hostname: c.hostname, heading: headingMatch?.slice(0, 120) || '' };
        }),
      };
    };

    const gaps = [
      ...missingBigrams.map((b) => scoreTopic(b, true)),
      ...missingUnigrams.map((u) => scoreTopic(u, false)),
    ]
      .filter((g) => g.present_in >= Math.min(2, competitors.length)) // gap = présent chez ≥2 concurrents (ou tous si ≤2)
      .sort((a, b) => b.present_in - a.present_in || (b.kind === 'bigram' ? 1 : -1))
      .slice(0, 30);

    // Coverage score : ratio topics couverts vs union concurrents
    const unionSize = allCompUni.size + allCompBi.size;
    const coveredSize = (Array.from(allCompUni).filter((u) => ourTopics.unigrams.has(u)).length)
      + (Array.from(allCompBi).filter((b) => ourTopics.bigrams.has(b)).length);
    const coverage_score = unionSize ? Math.round((coveredSize / unionSize) * 100) : 0;

    const payload = {
      coverage_score,
      our_word_count: (extracted.payload as any)?.word_count || 0,
      avg_competitor_word_count: Math.round(
        compResults.reduce((s, c) => s + c.word_count, 0) / Math.max(1, compResults.length),
      ),
      competitors: compResults.map((c) => ({
        url: c.url, hostname: c.hostname, ok: c.ok, error: c.error || null,
        headings_count: c.headings.length, word_count: c.word_count,
      })),
      gaps,
      analyzed_at: new Date().toISOString(),
    };

    const { data: artifact, error } = await upsertArtifact(guard.admin, {
      userId: guard.userId,
      tracked_site_id: extracted.tracked_site_id,
      slug,
      url: extracted.url,
      stage: 'topic_gaps',
      payload,
    });
    if (error) {
      console.error('[update-topic-gaps] persist error', error);
      return jsonResp({ error: 'persist_failed', detail: error.message }, 500);
    }

    return jsonResp({
      success: true,
      artifact_id: artifact.id,
      slug,
      coverage_score,
      gaps_count: gaps.length,
      gaps,
    });
  } catch (e) {
    console.error('[update-topic-gaps] fatal', e);
    return jsonResp({ error: 'internal', message: (e as Error).message }, 500);
  }
});
