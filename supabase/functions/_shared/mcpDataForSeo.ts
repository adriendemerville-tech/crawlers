/**
 * Appels DataForSEO des outils MCP. Parsers et plafonds : mcpDataForSeoCore.ts.
 */
import { trackPaidApiCall } from './tokenTracker.ts';
import {
  DataForSeoError,
  MCP_DATA_LIMITS,
  applyBulkDifficulty,
  bareDomain,
  clampInt,
  domainPosition,
  estimateBacklinkUsd,
  estimateKeywordResearchUsd,
  estimateSerpUsd,
  normalizeLanguage,
  normalizeSeeds,
  parseAnchors,
  parseBacklinkSummary,
  parseKeywordIdeas,
  parseOrganicSerp,
  parseReferringDomains,
  resolveLocation,
} from './mcpDataForSeoCore.ts';

export { DataForSeoError, LOCATION_CODES, MCP_DATA_LIMITS } from './mcpDataForSeoCore.ts';

async function dfsPost(path: string, task: Record<string, unknown>, label: string): Promise<unknown> {
  const login = Deno.env.get('DATAFORSEO_LOGIN');
  const password = Deno.env.get('DATAFORSEO_PASSWORD');
  if (!login || !password) throw new DataForSeoError('DataForSEO non configuré.');
  const resp = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${login}:${password}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([task]),
    signal: AbortSignal.timeout(25_000),
  });
  const text = await resp.text();
  if (!resp.ok) throw new DataForSeoError(`DataForSEO ${path} → HTTP ${resp.status}`);
  let json: { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string }> };
  try { json = JSON.parse(text); } catch { throw new DataForSeoError(`DataForSEO ${path} : réponse illisible.`); }
  const taskCode = json.tasks?.[0]?.status_code ?? json.status_code;
  if (taskCode && taskCode !== 20000) {
    const msg = json.tasks?.[0]?.status_message ?? json.status_message ?? 'erreur';
    throw new DataForSeoError(`DataForSEO ${path} : ${msg}`);
  }
  await trackPaidApiCall('mcp-server', 'dataforseo', label).catch(() => {});
  return json;
}

export async function researchKeywords(input: {
  keyword?: unknown;
  keywords?: unknown;
  language_code?: unknown;
  country?: unknown;
  location_code?: unknown;
  limit?: unknown;
}): Promise<Record<string, unknown>> {
  const seeds = normalizeSeeds(input);
  const language_code = normalizeLanguage(input.language_code);
  const location = resolveLocation(input.country, input.location_code);
  const limit = clampInt(input.limit, MCP_DATA_LIMITS.keywordResultsDefault, 1, MCP_DATA_LIMITS.keywordResultsMax);

  const ideasPayload = await dfsPost('dataforseo_labs/google/keyword_ideas/live', {
    keywords: seeds,
    location_code: location.location_code,
    language_code,
    limit,
    include_serp_info: false,
  }, 'labs/keyword_ideas');

  let ideas = parseKeywordIdeas(ideasPayload, limit);
  let bulkCalls = 0;
  const missing = ideas.filter((k) => k.keyword_difficulty === null).map((k) => k.keyword);
  if (missing.length > 0) {
    const bulkPayload = await dfsPost('dataforseo_labs/google/bulk_keyword_difficulty/live', {
      keywords: missing.slice(0, MCP_DATA_LIMITS.keywordResultsMax),
      location_code: location.location_code,
      language_code,
    }, 'labs/bulk_keyword_difficulty');
    ideas = applyBulkDifficulty(ideas, bulkPayload);
    bulkCalls = 1;
  }

  return {
    seeds,
    language_code,
    country: location.country,
    location_code: location.location_code,
    keywords: ideas,
    count: ideas.length,
    estimated_cost_usd: estimateKeywordResearchUsd(ideas.length, bulkCalls),
    cost_note: 'Estimation DataForSEO Labs (keyword_ideas, et bulk_keyword_difficulty seulement si la difficulté manque). Voir la description de l\'outil.',
  };
}

export async function rankSerp(input: {
  keyword?: unknown;
  domain?: unknown;
  language_code?: unknown;
  country?: unknown;
  location_code?: unknown;
  depth?: unknown;
}): Promise<Record<string, unknown>> {
  const keyword = String(input.keyword ?? '').trim().replace(/\s+/g, ' ');
  if (keyword.length < 2 || keyword.length > 200) throw new DataForSeoError('keyword est requis (2 à 200 caractères).');
  const language_code = normalizeLanguage(input.language_code);
  const location = resolveLocation(input.country, input.location_code);
  const depth = clampInt(input.depth, MCP_DATA_LIMITS.serpDepthDefault, 10, MCP_DATA_LIMITS.serpDepthMax);
  if (depth % 10 !== 0) throw new DataForSeoError('depth doit valoir 10 ou 20.');
  const domain = input.domain === undefined || input.domain === null || input.domain === ''
    ? null
    : bareDomain(input.domain);

  const payload = await dfsPost('serp/google/organic/live/regular', {
    keyword,
    location_code: location.location_code,
    language_code,
    device: 'desktop',
    depth,
  }, 'serp/google/organic/live/regular');

  const organic = parseOrganicSerp(payload, depth);
  return {
    keyword,
    language_code,
    country: location.country,
    location_code: location.location_code,
    depth,
    device: 'desktop',
    organic,
    domain: domain,
    domain_position: domainPosition(organic, domain),
    estimated_cost_usd: estimateSerpUsd(depth),
    cost_note: 'Estimation SERP Google organic live/regular, 0,002 $ par tranche de 10 résultats.',
  };
}

export async function snapshotBacklinks(input: {
  domain?: unknown;
  referring_limit?: unknown;
  anchor_limit?: unknown;
}): Promise<Record<string, unknown>> {
  const domain = bareDomain(input.domain);
  const referringLimit = clampInt(input.referring_limit, MCP_DATA_LIMITS.backlinkRowsDefault, 1, MCP_DATA_LIMITS.backlinkRowsMax);
  const anchorLimit = clampInt(input.anchor_limit, MCP_DATA_LIMITS.backlinkRowsDefault, 1, MCP_DATA_LIMITS.backlinkRowsMax);

  const [summaryPayload, refPayload, anchorPayload] = await Promise.all([
    dfsPost('backlinks/summary/live', {
      target: domain,
      include_subdomains: true,
      internal_list_limit: 0,
    }, 'backlinks/summary/live'),
    dfsPost('backlinks/referring_domains/live', {
      target: domain,
      limit: referringLimit,
      order_by: ['rank,desc'],
      internal_list_limit: 0,
    }, 'backlinks/referring_domains/live'),
    dfsPost('backlinks/anchors/live', {
      target: domain,
      limit: anchorLimit,
      order_by: ['backlinks,desc'],
      internal_list_limit: 0,
    }, 'backlinks/anchors/live'),
  ]);

  const summary = parseBacklinkSummary(summaryPayload);
  if (!summary) throw new DataForSeoError('DataForSEO backlinks/summary : réponse vide.');
  const referring = parseReferringDomains(refPayload, referringLimit);
  const anchors = parseAnchors(anchorPayload, anchorLimit);

  return {
    domain,
    include_subdomains: true,
    ...summary,
    referring_domains_sample: referring,
    anchors,
    estimated_cost_usd: estimateBacklinkUsd(referring.length, anchors.length),
    cost_note: 'Estimation : 3 tâches live (summary, referring_domains, anchors) à 0,024 $ + 0,000036 $ par ligne.',
  };
}
