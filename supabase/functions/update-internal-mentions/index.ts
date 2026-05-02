/**
 * update-internal-mentions — Sprint 3
 *
 * Scanne les pages connues du site (via cocoon_pages / crawl) pour suggérer
 * des ancres internes pertinentes vers la page en cours de refonte.
 *
 * Heuristique simple :
 *  - extrait les mots-clés du title + H1-H3 de l'artefact `extracted`
 *  - cherche dans cocoon_pages (mêmes user_id + tracked_site_id) celles qui
 *    contiennent ces mots-clés dans title/h1, en excluant la page elle-même
 *  - propose pour chacune une ancre + une raison
 *
 * Persiste stage=`mentions` dans update_artifacts.
 */
import { authAndGate, getExtractedArtifact, upsertArtifact, corsHeaders, jsonResp } from '../_shared/updatePipelineGuards.ts';

const STOPWORDS = new Set([
  'le','la','les','un','une','des','de','du','et','ou','à','au','aux','en','pour','par','sur','dans','avec','sans','mais','donc','car','ni','que','qui','quoi','dont','où','ce','cet','cette','ces','mon','ma','mes','ton','ta','tes','son','sa','ses','notre','votre','leur','leurs','est','sont','était','étaient','sera','seront','être','avoir','plus','moins','très','trop','peu','pas','non','oui','si','comme','aussi','alors','quand','tout','tous','toute','toutes',
  'the','a','an','of','and','or','to','in','on','at','for','with','from','by','is','are','was','were','be','been','being','this','that','these','those','it','its','as','but','not','no','yes','if','than','then','so','also',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

function extractKeywords(extracted: any, max = 12): string[] {
  const text = [
    extracted?.title || '',
    ...(extracted?.h1 || []),
    ...(extracted?.h2 || []),
    ...(extracted?.h3 || []),
  ].join(' ');
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const guard = await authAndGate(req);
  if (!guard.ok) return jsonResp(guard.body, guard.status);
  const { admin, userId } = guard;

  let body: any;
  try { body = await req.json(); } catch { return jsonResp({ error: 'invalid_json' }, 400); }
  const slug: string = body?.slug;
  if (!slug) return jsonResp({ error: 'missing_slug' }, 400);

  const extractedArt = await getExtractedArtifact(admin, userId, slug);
  if (!extractedArt) return jsonResp({ error: 'no_extracted_artifact', message: 'Lance d\'abord update-extract-content.' }, 404);

  const ext = extractedArt.payload as any;
  const keywords = extractKeywords(ext);
  const targetUrl = (extractedArt.url || '').toLowerCase();

  // Cherche dans cocoon_pages (best-effort — schéma générique title/url/h1)
  let candidates: Array<{ url: string; title: string; h1?: string }> = [];
  try {
    let q = admin.from('cocoon_pages').select('url, title, h1').eq('user_id', userId).limit(500);
    if (extractedArt.tracked_site_id) q = q.eq('tracked_site_id', extractedArt.tracked_site_id);
    const { data } = await q;
    candidates = (data as any[]) || [];
  } catch { /* table can vary; degrade silently */ }

  const suggestions: Array<{ source_url: string; source_title: string; anchor: string; matched_keywords: string[]; score: number }> = [];

  for (const c of candidates) {
    if (!c?.url || c.url.toLowerCase() === targetUrl) continue;
    const haystack = `${c.title || ''} ${c.h1 || ''}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matched = keywords.filter((k) => haystack.includes(k));
    if (matched.length === 0) continue;
    // Ancre = sous-chaîne du title contenant le mot-clé top
    const top = matched[0];
    const anchorBase = c.title || c.h1 || top;
    suggestions.push({
      source_url: c.url,
      source_title: c.title || c.h1 || c.url,
      anchor: anchorBase.length > 60 ? anchorBase.slice(0, 60) + '…' : anchorBase,
      matched_keywords: matched.slice(0, 5),
      score: matched.length,
    });
  }

  suggestions.sort((a, b) => b.score - a.score);
  const top = suggestions.slice(0, 15);

  const payload = {
    keywords_used: keywords,
    candidates_scanned: candidates.length,
    suggestions: top,
    generated_at: new Date().toISOString(),
  };

  const { error } = await upsertArtifact(admin, {
    userId,
    tracked_site_id: extractedArt.tracked_site_id,
    slug,
    url: extractedArt.url,
    stage: 'mentions',
    payload,
    source: body?.source || 'manual',
  });
  if (error) return jsonResp({ error: 'persist_failed', message: error.message }, 500);

  return jsonResp({ success: true, slug, mentions: top.length, payload });
});
