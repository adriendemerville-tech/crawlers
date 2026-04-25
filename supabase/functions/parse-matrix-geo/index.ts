import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage } from '../_shared/tokenTracker.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/* ================================================================== */
/*  GEO Matrice Audit — standard mode + benchmark mode                 */
/* ================================================================== */

interface GeoItem {
  id: string; prompt: string; poids: number; axe: string
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
  llm_name?: string
}

interface BenchmarkItem {
  id: string; prompt: string; theme: string; engine: string
  poids: number; axe: string
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
  llm_name?: string
}

interface GeoResult {
  id: string; prompt: string; axe: string; poids: number
  detected_type: string
  crawlers_score: number
  parsed_score: number
  raw_data: Record<string, any>
  parsed_raw?: Record<string, any>
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
}

interface BenchmarkResult extends GeoResult {
  theme: string; engine: string
  citation_found: boolean
  citation_rank: number | null
  citation_context: string
}

/* ── Engine-specific system prompts ──────────────────────────────── */

const DEFAULT_ENGINE_PROMPTS: Record<string, string> = {
  chatgpt: `Tu simules ChatGPT. Réponds à la question de l'utilisateur comme le ferait ChatGPT. Sois factuel, cite des sources si pertinent.`,
  gemini: `Tu simules Google Gemini. Réponds comme Gemini le ferait : synthétique, avec des données vérifiables.`,
  perplexity: `Tu simules Perplexity AI. Réponds avec des citations de sources, des liens, une synthèse structurée.`,
  copilot: `Tu simules Microsoft Copilot. Réponds de manière concise et pratique, avec des suggestions actionnables.`,
  claude: `Tu simules Claude (Anthropic). Réponds de manière nuancée, analytique, avec des citations de sources quand pertinent.`,
};

interface EngineNoteInput {
  engine: string;
  howToAskCitations: string;
  whyItMatters: string;
  sourceUrl: string;
}

interface ScoringFieldInput {
  field: string;
  whatToCode: string;
  allowedValues: string;
  meaning: string;
}

function getEngineSystemPrompt(engine: string, engineNotes?: EngineNoteInput[]): string {
  const lower = engine.toLowerCase();
  
  // Try matching from imported engine notes first (higher fidelity)
  if (engineNotes?.length) {
    const note = engineNotes.find(n => lower.includes(n.engine.toLowerCase()));
    if (note) {
      return `Tu simules ${note.engine}. ${note.howToAskCitations}

Contexte important : ${note.whyItMatters}`;
    }
  }
  
  // Fallback to defaults
  for (const [key, prompt] of Object.entries(DEFAULT_ENGINE_PROMPTS)) {
    if (lower.includes(key)) return prompt;
  }
  return `Tu es un moteur de recherche IA. Réponds de manière factuelle et structurée.`;
}

/** Build scoring rubric instructions from imported Scoring Guide — dynamic field extraction */
function buildScoringRubric(scoringGuide?: ScoringFieldInput[]): string {
  if (!scoringGuide?.length) return '';
  const rubricLines = scoringGuide.map(f => 
    `- **${f.field}** : ${f.whatToCode} (Valeurs: ${f.allowedValues}) → ${f.meaning}`
  ).join('\n');
  return `\n\nGRILLE D'ÉVALUATION À APPLIQUER — code CHAQUE champ :\n${rubricLines}`;
}

/** Build the dynamic JSON schema for LLM scoring response based on Scoring Guide */
function buildScoringJsonSchema(scoringGuide?: ScoringFieldInput[]): string {
  // Base fields always present (citation analysis)
  const baseFields: Record<string, string> = {
    cited: '<bool>',
    rank: '<number|null>',
    context: '<phrase où la marque apparaît>',
  };

  // Add all Scoring Guide fields dynamically
  if (scoringGuide?.length) {
    for (const f of scoringGuide) {
      // Map Scoring Guide field names to JSON keys (snake_case)
      const key = f.field
        .replace(/([A-Z])/g, '_$1').toLowerCase()
        .replace(/^_/, '')
        .replace(/__+/g, '_');
      baseFields[key] = `<${f.allowedValues}>`;
    }
  }

  return JSON.stringify(
    Object.fromEntries(Object.entries(baseFields).map(([k, v]) => [k, v])),
    null, 0
  ).replace(/"/g, '');
}

/** Convert a coded Scoring Guide field value to a 0-100 numeric score */
function rubricFieldToNumeric(field: ScoringFieldInput, value: string): number {
  const v = (value || '').trim().toLowerCase();
  const allowed = field.allowedValues || '';

  // Boolean (Oui/Non)
  if (/^oui\s*,\s*non$/i.test(allowed)) return /^oui|^yes|^true/i.test(v) ? 100 : 0;

  // Rank (0 = absent, 1, 2, 3, 4, 5, 6+)
  if (/\b0\s*=\s*(absent|absente)/i.test(allowed)) {
    const rank = parseInt(v);
    if (isNaN(rank) || rank === 0) return 0;
    return Math.max(10, 100 - (rank - 1) * 20);
  }

  // Percentage ranges
  if (/\d+\s*%/.test(allowed)) {
    const pctMatch = v.match(/(\d+)/);
    if (pctMatch) return Math.min(100, parseInt(pctMatch[1]));
    if (/100\s*%/.test(v)) return 100;
    if (/75-99/.test(v)) return 87;
    if (/51-74/.test(v)) return 62;
    if (/^50\s*%/.test(v)) return 50;
    if (/25-49/.test(v)) return 37;
    if (/1-24/.test(v)) return 12;
    return 0;
  }

  // Count (0, 1, 2, 3+)
  if (/^0\s*,\s*1\s*,\s*2/.test(allowed)) {
    const count = parseInt(v);
    if (isNaN(count) || count === 0) return 0;
    if (count === 1) return 33;
    if (count === 2) return 66;
    return 100;
  }

  // Direction (Positive/Neutre/Négative)
  if (/positive.*neutre.*n[ée]gative/i.test(allowed)) {
    if (/positive/i.test(v)) return 100;
    if (/neutre/i.test(v)) return 50;
    if (/n[ée]gative/i.test(v)) return 0;
    return 0;
  }

  // Accuracy (Exacte/Partiellement/Inexacte)
  if (/exacte.*partiellement/i.test(allowed)) {
    if (/^exacte/i.test(v)) return 100;
    if (/partiellement/i.test(v)) return 50;
    if (/inexacte/i.test(v)) return 0;
    return 25;
  }

  // Source type
  if (/propri[ée]taire.*tierce/i.test(allowed)) {
    if (/propri[ée]taire/i.test(v)) return 100;
    if (/mixte/i.test(v)) return 75;
    if (/tierce/i.test(v)) return 50;
    return 0;
  }

  const num = parseFloat(v);
  if (!isNaN(num)) return Math.min(100, Math.max(0, num));
  return 50;
}

/* ── LLM GEO evaluation (standard mode) ─────────────────────────── */

async function evaluateGeo(
  prompt: string, url: string, _llmName: string, retryCount = 0
): Promise<{ score: number; raw: Record<string, any> }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) return { score: 50, raw: { error: 'No API key' } }

  // ── Gemini Pro for GEO evaluation (high quality) ──
  const GEO_MODEL = 'google/gemini-2.5-pro'
  const MAX_RETRIES = 2
  const RETRY_DELAYS = [2000, 5000]

  try {
    const systemPrompt = `Tu es un expert en GEO (Generative Engine Optimization) et en visibilité IA.
On te donne une URL de site web et un critère GEO à évaluer.

Tu dois évaluer ce critère en vérifiant la CITABILITÉ du site par les moteurs IA (ChatGPT, Gemini, Perplexity, Copilot).

Critères d'évaluation GEO :
- Le site est-il mentionné par les moteurs IA pour ce type de requête ?
- Le contenu est-il structuré pour être cité (FAQ, données structurées, E-E-A-T) ?
- Le site a-t-il des signaux de confiance (HTTPS, vitesse, structured data) ?
- Le contenu est-il suffisamment unique et autoritaire pour être recommandé ?

Réponds UNIQUEMENT avec un JSON: {"score": <0-100>, "justification": "<string courte>", "signals": {"mentioned": <bool>, "structured": <bool>, "authoritative": <bool>}}`

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEO_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `URL: ${url}\n\nCRITÈRE GEO À ÉVALUER:\n${prompt}\n\nScore de 0 à 100:` },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!resp.ok) {
      const status = resp.status
      await resp.text()
      if ((status === 429 || status >= 500) && retryCount < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount] || 5000))
        return evaluateGeo(prompt, url, _llmName, retryCount + 1)
      }
      return { score: 50, raw: { error: `API error ${status}` } }
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    trackTokenUsage('parse-matrix-geo', GEO_MODEL, data.usage, url)

    return parseScoreResponse(content)
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount] || 5000))
      return evaluateGeo(prompt, url, _llmName, retryCount + 1)
    }
    return { score: 50, raw: { error: e instanceof Error ? e.message : 'Unknown' } }
  }
}

/* ── Benchmark evaluation: send full prompt as-is to engine ──────── */

async function evaluateBenchmark(
  prompt: string, brandUrl: string, engine: string, llmName: string,
  engineNotes?: EngineNoteInput[], scoringRubric?: ScoringFieldInput[],
  retryCount = 0
): Promise<{ score: number; raw: Record<string, any>; citation_found: boolean; citation_rank: number | null; citation_context: string }> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!OPENROUTER_API_KEY && !LOVABLE_API_KEY) return { score: 0, raw: { error: 'No API key' }, citation_found: false, citation_rank: null, citation_context: '' }

  const MAX_RETRIES = 2
  const RETRY_DELAYS = [2000, 5000]

  // ── Map engine name to real OpenRouter model for authentic responses ──
  const ENGINE_TO_REAL_MODEL: Record<string, string> = {
    chatgpt: 'openai/gpt-4o',
    gpt: 'openai/gpt-4o',
    gemini: 'google/gemini-2.5-pro',
    perplexity: 'perplexity/sonar-pro',
    copilot: 'openai/gpt-4o',
    claude: 'anthropic/claude-3.5-sonnet',
    mistral: 'mistralai/mistral-large-latest',
  }

  const engineLower = engine.toLowerCase()
  const realModel = Object.entries(ENGINE_TO_REAL_MODEL).find(([k]) => engineLower.includes(k))?.[1] || 'openai/gpt-4o'

  try {
    // ── Step 1: Send prompt to the REAL LLM via OpenRouter ──
    const useOpenRouter = !!OPENROUTER_API_KEY
    const apiUrl = useOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://ai.gateway.lovable.dev/v1/chat/completions'
    const apiKey = useOpenRouter ? OPENROUTER_API_KEY! : LOVABLE_API_KEY!
    const model = useOpenRouter ? realModel : (llmName || 'google/gemini-2.5-flash')
    const extraHeaders: Record<string, string> = useOpenRouter
      ? { 'HTTP-Referer': 'https://crawlers.fr', 'X-Title': 'Crawlers.fr' }
      : {}

    console.log(`[parse-matrix-geo] Benchmark → ${engine} via ${useOpenRouter ? 'OpenRouter' : 'Lovable AI'} (${model})`)

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!resp.ok) {
      const status = resp.status
      await resp.text()
      if ((status === 429 || status >= 500) && retryCount < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount] || 5000))
        return evaluateBenchmark(prompt, brandUrl, engine, llmName, engineNotes, scoringRubric, retryCount + 1)
      }
      return { score: 0, raw: { error: `API error ${status}`, model, gateway: useOpenRouter ? 'openrouter' : 'lovable' }, citation_found: false, citation_rank: null, citation_context: '' }
    }

    const data = await resp.json()
    const engineResponse = data.choices?.[0]?.message?.content || ''
    trackTokenUsage('parse-matrix-geo', model, data.usage, brandUrl)

    // ── Step 2: Analyze citation & score with Gemini Pro (high quality scoring) ──
    const SCORING_MODEL = 'google/gemini-2.5-pro'
    const rubricInstructions = buildScoringRubric(scoringRubric);
    const dynamicJsonSchema = buildScoringJsonSchema(scoringRubric);

    const scoringSystemPrompt = `Tu analyses la réponse d'un moteur IA pour vérifier si une marque/site est cité et coder des champs d'évaluation.
Réponds UNIQUEMENT en JSON avec ces champs: ${dynamicJsonSchema}
- cited: true si la marque/URL est mentionnée (même partiellement, par nom de domaine ou nom de marque)
- rank: position dans la liste de recommandations (1 = premier cité, null si absent)
- context: la phrase exacte de citation (vide si non cité)${rubricInstructions}

IMPORTANT: Pour chaque champ de la grille, utilise UNIQUEMENT les valeurs autorisées listées.`;

    if (!LOVABLE_API_KEY) {
      // Can't score without Lovable AI — return raw citation detection
      const cited = engineResponse.toLowerCase().includes(brandUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0].toLowerCase())
      return { score: cited ? 50 : 0, raw: { engine_response_preview: engineResponse.substring(0, 500), model, gateway: useOpenRouter ? 'openrouter' : 'lovable', scoring_skipped: true }, citation_found: cited, citation_rank: null, citation_context: '' }
    }

    const scoringResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SCORING_MODEL,
        messages: [
          { role: 'system', content: scoringSystemPrompt },
          { role: 'user', content: `URL/Marque à chercher: ${brandUrl}\n\nRéponse du moteur IA (${engine}, modèle réel: ${model}):\n${engineResponse.substring(0, 4000)}` },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!scoringResp.ok) {
      await scoringResp.text()
      return {
        score: 0,
        raw: { engine_response: engineResponse.substring(0, 500), scoring_error: true },
        citation_found: false,
        citation_rank: null,
        citation_context: '',
      }
    }

    const scoringData = await scoringResp.json()
    const scoringContent = scoringData.choices?.[0]?.message?.content || ''
    trackTokenUsage('parse-matrix-geo', SCORING_MODEL, scoringData.usage, brandUrl)

    // Parse the citation analysis
    let citationParsed: any = {}
    try {
      let jsonStr = scoringContent
      if (jsonStr.includes('```json')) jsonStr = jsonStr.split('```json')[1].split('```')[0].trim()
      else if (jsonStr.includes('```')) jsonStr = jsonStr.split('```')[1].split('```')[0].trim()
      citationParsed = JSON.parse(jsonStr)
    } catch {
      citationParsed = { cited: false, rank: null, context: '' }
    }

    const cited = citationParsed.cited ?? false
    const rank = cited ? (citationParsed.rank ?? null) : null

    // ── Compute composite score from coded Scoring Guide fields ──
    let benchmarkScore: number
    let scoringMethod = 'rank_based'

    if (scoringRubric?.length) {
      // Dynamic composite score from rubric fields
      const codedFields = scoringRubric.map(fieldDef => {
        const key = fieldDef.field
          .replace(/([A-Z])/g, '_$1').toLowerCase()
          .replace(/^_/, '')
          .replace(/__+/g, '_');
        const rawValue = String(citationParsed[key] ?? citationParsed[fieldDef.field] ?? '')
        return {
          field: fieldDef.field,
          value: rawValue,
          numericValue: rubricFieldToNumeric(fieldDef, rawValue),
        }
      })

      // Filter out meta/filter fields (not quality indicators)
      const qualityFields = codedFields.filter(f => {
        const def = scoringRubric.find(r => r.field === f.field)
        return !(def && /filtr|permet de filtrer/i.test(def.meaning || ''))
      })

      benchmarkScore = qualityFields.length > 0
        ? Math.round(qualityFields.reduce((s, f) => s + f.numericValue, 0) / qualityFields.length)
        : (cited ? (rank ?? 99) : 0)
      scoringMethod = 'structured_rubric'

      return {
        score: benchmarkScore,
        raw: {
          engine_response_preview: engineResponse.substring(0, 300),
          real_model: model,
          real_gateway: useOpenRouter ? 'openrouter' : 'lovable',
          scoring_model: SCORING_MODEL,
          scoring: citationParsed,
          scoring_method: scoringMethod,
          coded_fields: codedFields,
          composite_score: benchmarkScore,
          engine,
        },
        citation_found: cited,
        citation_rank: rank,
        citation_context: citationParsed.context ?? '',
      }
    }

    // Fallback: rank-based scoring (no rubric)
    benchmarkScore = cited ? (rank ?? 99) : 0

    return {
      score: benchmarkScore,
      raw: {
        engine_response_preview: engineResponse.substring(0, 300),
        real_model: model,
        real_gateway: useOpenRouter ? 'openrouter' : 'lovable',
        scoring_model: SCORING_MODEL,
        scoring: citationParsed,
        scoring_method: 'rank_based',
        engine,
      },
      citation_found: cited,
      citation_rank: rank,
      citation_context: citationParsed.context ?? '',
    }
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount] || 5000))
      return evaluateBenchmark(prompt, brandUrl, engine, llmName, engineNotes, scoringRubric, retryCount + 1)
    }
    return { score: 0, raw: { error: e instanceof Error ? e.message : 'Unknown' }, citation_found: false, citation_rank: null, citation_context: '' }
  }
}

/* ── Parse score from LLM response ───────────────────────────────── */

function parseScoreResponse(content: string): { score: number; raw: Record<string, any> } {
  let jsonContent = content
  if (content.includes('```json')) jsonContent = content.split('```json')[1].split('```')[0].trim()
  else if (content.includes('```')) jsonContent = content.split('```')[1].split('```')[0].trim()

  try {
    const parsed = JSON.parse(jsonContent)
    return { score: Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 50))), raw: parsed }
  } catch {
    const numMatch = content.match(/(\d{1,3})/)
    if (numMatch) return { score: Math.min(100, parseInt(numMatch[1])), raw: { llm_raw: content.substring(0, 200) } }
    return { score: 50, raw: { llm_raw: content.substring(0, 200), parse_error: true } }
  }
}

/* ── Main handler ─────────────────────────────────────────────────── */

Deno.serve(handleRequest(async (req) => {
  const clientIp = getClientIp(req)
  const ipCheck = checkIpRate(clientIp, 'parse-matrix-geo', 15, 60_000)
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs)
  if (!acquireConcurrency('parse-matrix-geo', 50)) return concurrencyResponse(corsHeaders)

  // When SSE streaming starts, the stream owns the concurrency slot
  // and releases it itself; we must not release it twice in the outer finally.
  let streamingOwnsConcurrency = false

  try {
    const body = await req.json()
    const { url, items, benchmark_items, mode, engine_notes, scoring_rubric, stream } = body as {
      url: string;
      items?: GeoItem[];
      benchmark_items?: BenchmarkItem[];
      mode?: 'standard' | 'benchmark';
      engine_notes?: EngineNoteInput[];
      scoring_rubric?: ScoringFieldInput[];
      stream?: boolean;
    }
    
    if (engine_notes?.length) console.log(`[parse-matrix-geo] Engine notes loaded: ${engine_notes.map(n => n.engine).join(', ')}`)
    if (scoring_rubric?.length) console.log(`[parse-matrix-geo] Scoring rubric loaded: ${scoring_rubric.length} fields`)

    if (!url) {
      return jsonError('url required', 400)
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`

    // ── BENCHMARK MODE ──────────────────────────────────────────────
    if (mode === 'benchmark' && benchmark_items?.length) {
      console.log(`[parse-matrix-geo] BENCHMARK mode for ${normalizedUrl} with ${benchmark_items.length} items (stream=${!!stream})`)

      // Throughput: 8 items in parallel, no inter-batch sleep.
      // 5 engines × 79 prompts = 395 items → ~50 batches × ~3s each = ~2.5 min.
      // OpenRouter handles concurrency well at this scale.
      const BATCH_SIZE = 8

      // Normalize once: lowercase + trim engine/axe to avoid duplicate columns
      // ("ChatGPT" vs "chatgpt ") and duplicate Z-layers in the cube.
      const normalize = (s: string | undefined | null) => String(s ?? '').trim()
      const normalizedItems = benchmark_items.map(it => ({
        ...it,
        engine: normalize(it.engine) || 'ChatGPT',
        axe: normalize(it.axe) || 'Général',
        theme: normalize(it.theme) || 'Général',
      }))

      // Shared core: process all batches, optionally streaming progress.
      const processAll = async (
        emit?: (event: string, payload: Record<string, any>) => Promise<void> | void
      ): Promise<BenchmarkResult[]> => {
        const results: BenchmarkResult[] = []
        const totalBatches = Math.ceil(normalizedItems.length / BATCH_SIZE)

        for (let i = 0; i < normalizedItems.length; i += BATCH_SIZE) {
          const batch = normalizedItems.slice(i, i + BATCH_SIZE)
          const batchIndex = Math.floor(i / BATCH_SIZE) + 1
          console.log(`[parse-matrix-geo] Benchmark batch ${batchIndex}/${totalBatches}`)

          const batchResults = await Promise.all(
            batch.map(async (item): Promise<BenchmarkResult> => {
              const { score, raw, citation_found, citation_rank, citation_context } = await evaluateBenchmark(
                item.prompt, normalizedUrl, item.engine, item.llm_name || 'google/gemini-2.5-flash',
                engine_notes, scoring_rubric
              )
              const result: BenchmarkResult = {
                id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
                theme: item.theme, engine: item.engine,
                detected_type: 'geo_benchmark',
                crawlers_score: score, parsed_score: score,
                raw_data: raw, parsed_raw: raw,
                citation_found, citation_rank, citation_context,
                seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
              }
              if (emit) {
                await emit('item', {
                  id: result.id, engine: result.engine, theme: result.theme,
                  axe: result.axe, score: result.crawlers_score,
                  citation_found: result.citation_found, citation_rank: result.citation_rank,
                })
              }
              return result
            })
          )
          results.push(...batchResults)

          if (emit) {
            await emit('progress', {
              done: results.length,
              total: normalizedItems.length,
              batch: batchIndex,
              total_batches: totalBatches,
            })
          }
        }
        return results
      }

      // Build heatmap helper (shared by both modes).
      const buildPayload = (results: BenchmarkResult[]) => {
        const themeOrder: string[] = []
        const engineOrder: string[] = []
        const seenT = new Set<string>()
        const seenE = new Set<string>()
        for (const r of results) {
          if (!seenT.has(r.theme)) { seenT.add(r.theme); themeOrder.push(r.theme) }
          if (!seenE.has(r.engine)) { seenE.add(r.engine); engineOrder.push(r.engine) }
        }
        const themes = themeOrder
        const engines = engineOrder
        const heatmap: Record<string, Record<string, { score: number; cited: boolean; rank: number | null; count: number; cited_count: number }>> = {}

        for (const theme of themes) {
          heatmap[theme] = {}
          for (const engine of engines) {
            const matches = results.filter(r => r.theme === theme && r.engine === engine)
            if (matches.length === 0) {
              heatmap[theme][engine] = { score: -1, cited: false, rank: null, count: 0, cited_count: 0 }
            } else {
              const citedCount = matches.filter(m => m.citation_found).length
              const bestRank = matches.filter(m => m.citation_rank !== null).sort((a, b) => (a.citation_rank ?? 99) - (b.citation_rank ?? 99))[0]?.citation_rank ?? null
              heatmap[theme][engine] = { score: bestRank ?? 0, cited: citedCount > 0, rank: bestRank, count: matches.length, cited_count: citedCount }
            }
          }
        }

        const citationRate = results.length > 0
          ? Math.round(results.filter(r => r.citation_found).length / results.length * 100)
          : 0

        const citedResults = results.filter(r => r.citation_found && r.citation_rank != null)
        const avgRank = citedResults.length > 0
          ? +(citedResults.reduce((s, r) => s + (r.citation_rank ?? 0), 0) / citedResults.length).toFixed(1)
          : 0

        return {
          success: true, url: normalizedUrl, mode: 'benchmark',
          global_score: avgRank, citation_rate: citationRate, avg_rank: avgRank,
          total_items: results.length, audit_type: 'geo_benchmark',
          themes, engines, heatmap, results,
        }
      }

      // ── SSE streaming branch ──
      if (stream) {
        const encoder = new TextEncoder()
        const sseBody = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: Record<string, any>) => {
              try {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
              } catch (_) { /* client disconnected */ }
            }
            // Heartbeat to keep proxy connections alive (every 15s).
            const heartbeat = setInterval(() => {
              try { controller.enqueue(encoder.encode(`: ping\n\n`)) } catch (_) { /* noop */ }
            }, 15_000)

            try {
              send('start', { total: normalizedItems.length, batch_size: BATCH_SIZE })
              const results = await processAll((event, payload) => send(event, payload))
              const payload = buildPayload(results)
              send('complete', payload)
            } catch (e) {
              send('error', { message: e instanceof Error ? e.message : 'Unknown' })
            } finally {
              clearInterval(heartbeat)
              releaseConcurrency('parse-matrix-geo')
              try { controller.close() } catch (_) { /* noop */ }
            }
          },
        })

        return new Response(sseBody, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        })
      }

      // ── Classic JSON branch (legacy) ──
      const results = await processAll()
      const payload = buildPayload(results)
      console.log(`[parse-matrix-geo] Benchmark complete. Avg rank: ${payload.avg_rank}, Citation rate: ${payload.citation_rate}%`)
      return jsonOk(payload)
    }

    // ── STANDARD MODE ───────────────────────────────────────────────
    if (!items?.length) {
      return jsonError('items[] required for standard mode', 400)
    }

    console.log(`[parse-matrix-geo] Starting GEO audit for ${normalizedUrl} with ${items.length} items`)

    const BATCH_SIZE = 6
    const results: GeoResult[] = []

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      console.log(`[parse-matrix-geo] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(items.length / BATCH_SIZE)} (${batch.length} items)`)

      const batchResults = await Promise.all(
        batch.map(async (item): Promise<GeoResult> => {
          const { score, raw } = await evaluateGeo(
            item.prompt, normalizedUrl, item.llm_name || 'google/gemini-2.5-flash'
          )
          return {
            id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
            detected_type: 'geo', crawlers_score: score, parsed_score: score,
            raw_data: raw, parsed_raw: raw,
            seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
          }
        })
      )
      results.push(...batchResults)
      // No inter-batch sleep — Promise.all + retry/backoff inside evaluateGeo handle 429s.
    }

    const orderedResults = items.map(item => results.find(r => r.id === item.id)!)
    const totalWeight = orderedResults.reduce((s, r) => s + r.poids, 0)
    const globalScore = totalWeight > 0
      ? Math.round(orderedResults.reduce((s, r) => s + r.crawlers_score * r.poids, 0) / totalWeight)
      : 0

    console.log(`[parse-matrix-geo] Complete. Global GEO score: ${globalScore}/100`)

    return jsonOk({
      success: true, url: normalizedUrl, global_score: globalScore,
      total_items: orderedResults.length, audit_type: 'geo', results: orderedResults,
    })

  } catch (e) {
    console.error('[parse-matrix-geo] Error:', e)
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } finally {
    releaseConcurrency('parse-matrix-geo')
  }
}))
