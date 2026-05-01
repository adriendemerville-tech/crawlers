// ============================================================================
// SHARED EDITORIAL PIPELINE — 4 STAGES
// ----------------------------------------------------------------------------
// Stage 0 : Briefing packet aggregator (workbench + breathing spiral + KW universe + seasonal)
// Stage 1 : Strategist LLM (selects angle, structure, intent — high reasoning)
// Stage 2 : Writer LLM (produces the actual content — type-aware)
// Stage 3 : Tonalizer LLM (optional — adjusts to voice DNA)
//
// Used by: parmenion-orchestrator, content-architecture-advisor, generate-social-content
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { toFrenchSentenceCase, normalizeHtmlHeadings } from "./sentenceCase.ts";
import { isDictadeviDomain } from "./domainUtils.ts";
import {
  fetchDictadeviContext,
  renderDictadeviContextBlock,
  extractDictadeviSources,
  type DictadeviContext,
} from "./dictadeviContext.ts";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
export type ContentType =
  | "blog_article"
  | "seo_page"
  | "social_post"
  | "email"
  | "landing_page"
  | "guide"
  | "faq";

export interface PipelineInput {
  user_id: string;
  domain: string;
  tracked_site_id?: string;
  content_type: ContentType;
  target_url?: string;
  user_brief?: string;
  override_models?: {
    strategist?: string;
    writer?: string;
    tonalizer?: string;
  };
}

export interface BriefingPacket {
  id?: string;
  domain: string;
  content_type: ContentType;
  target_url?: string;
  briefing_data: {
    angle_hints: string[];
    keywords: string[];
    competitor_gaps: string[];
    seasonal_context: string | null;
    spiral_phase: string | null;
    workbench_findings: Array<{ title: string; severity: string; description?: string }>;
    business_context: Record<string, unknown>;
  };
  source_signals: Record<string, unknown>;
  workbench_item_ids: string[];
  spiral_phase: string | null;
}

export interface PipelineResult {
  pipeline_run_id: string;
  briefing: BriefingPacket;
  strategy: {
    angle: string;
    outline: string[];
    intent: string;
    target_length: number;
    model_used: string;
  };
  draft: {
    title: string;
    content: string;
    excerpt?: string;
    model_used: string;
  };
  final: {
    title: string;
    content: string;
    excerpt?: string;
    voice_adjusted: boolean;
    model_used: string | null;
  };
  total_cost_usd: number;
  total_latency_ms: number;
}

// ----------------------------------------------------------------------------
// COMPLEXITY MATRIX (site × content_type → default model tier)
// ----------------------------------------------------------------------------
type ModelTier = "fast" | "balanced" | "premium";

const CONTENT_TYPE_BASE_TIER: Record<ContentType, ModelTier> = {
  social_post: "fast",
  faq: "fast",
  email: "balanced",
  blog_article: "balanced",
  seo_page: "balanced",
  guide: "premium",
  landing_page: "premium",
};

const TIER_TO_MODEL: Record<"strategist" | "writer" | "tonalizer", Record<ModelTier, string>> = {
  strategist: {
    fast: "google/gemini-2.5-flash",
    balanced: "openai/gpt-5-mini",
    premium: "openai/gpt-5",
  },
  writer: {
    fast: "google/gemini-2.5-flash-lite",
    balanced: "google/gemini-2.5-flash",
    premium: "openai/gpt-5-mini",
  },
  tonalizer: {
    fast: "google/gemini-2.5-flash-lite",
    balanced: "google/gemini-2.5-flash-lite",
    premium: "google/gemini-2.5-flash",
  },
};

function bumpTier(tier: ModelTier, by: number): ModelTier {
  const order: ModelTier[] = ["fast", "balanced", "premium"];
  const idx = Math.max(0, Math.min(order.length - 1, order.indexOf(tier) + by));
  return order[idx];
}

// ----------------------------------------------------------------------------
// MAIN ENTRY POINT
// ----------------------------------------------------------------------------
export async function runEditorialPipeline(
  supabase: SupabaseClient,
  input: PipelineInput,
): Promise<PipelineResult> {
  const pipeline_run_id = crypto.randomUUID();
  const t0 = Date.now();

  // ---- Stage 0: Briefing
  const briefing = await stage0_briefing(supabase, input, pipeline_run_id);

  // ---- Resolve models
  const models = await resolveModels(supabase, input, briefing);

  // ---- Stage 1: Strategist
  const strategy = await stage1_strategist(supabase, input, briefing, models.strategist, pipeline_run_id);

  // ---- Stage 2: Writer
  const draft = await stage2_writer(supabase, input, briefing, strategy, models.writer, pipeline_run_id);

  // ---- Stage 3: Tonalizer (optional)
  const final = models.tonalizer
    ? await stage3_tonalizer(supabase, input, draft, models.tonalizer, pipeline_run_id)
    : { ...draft, voice_adjusted: false, model_used: null };

  return {
    pipeline_run_id,
    briefing,
    strategy,
    draft,
    final,
    total_cost_usd: 0, // TODO: aggregate from logs
    total_latency_ms: Date.now() - t0,
  };
}

// ----------------------------------------------------------------------------
// MODEL RESOLUTION (override → DB routing → default matrix)
// ----------------------------------------------------------------------------
async function resolveModels(
  supabase: SupabaseClient,
  input: PipelineInput,
  briefing: BriefingPacket,
): Promise<{ strategist: string; writer: string; tonalizer: string | null }> {
  // 1. Manual override wins
  if (input.override_models?.strategist && input.override_models?.writer) {
    return {
      strategist: input.override_models.strategist,
      writer: input.override_models.writer,
      tonalizer: input.override_models.tonalizer ?? null,
    };
  }

  // 2. DB routing rule (per domain × content_type)
  const { data: rule } = await supabase
    .from("editorial_llm_routing")
    .select("strategist_model, writer_model, tonalizer_model")
    .eq("user_id", input.user_id)
    .eq("domain", input.domain)
    .eq("content_type", input.content_type)
    .maybeSingle();

  // 3. Compute defaults via complexity matrix
  const baseTier = CONTENT_TYPE_BASE_TIER[input.content_type] ?? "balanced";
  const siteComplexity = await estimateSiteComplexity(supabase, input.tracked_site_id);
  const finalTier = bumpTier(baseTier, siteComplexity); // -1, 0, +1

  const defaultStrategist = TIER_TO_MODEL.strategist[finalTier];
  const defaultWriter = TIER_TO_MODEL.writer[finalTier];

  // Tonalizer: only if voice DNA is strong
  const voiceStrength = (briefing.briefing_data.business_context as { voice_dna_strength?: number })
    ?.voice_dna_strength ?? 0;
  const defaultTonalizer = voiceStrength > 0.6 ? TIER_TO_MODEL.tonalizer[finalTier] : null;

  return {
    strategist: rule?.strategist_model || input.override_models?.strategist || defaultStrategist,
    writer: rule?.writer_model || input.override_models?.writer || defaultWriter,
    tonalizer: rule?.tonalizer_model || input.override_models?.tonalizer || defaultTonalizer,
  };
}

async function estimateSiteComplexity(supabase: SupabaseClient, tracked_site_id?: string): Promise<number> {
  if (!tracked_site_id) return 0;
  const { data } = await supabase
    .from("tracked_sites")
    .select("crawl_pages_count, business_profile")
    .eq("id", tracked_site_id)
    .maybeSingle();
  if (!data) return 0;
  const pages = (data.crawl_pages_count as number) || 0;
  if (pages > 5000) return 1; // bump up to premium
  if (pages < 50) return -1; // bump down to fast
  return 0;
}

// Extract `angle_gaps` from saturation snapshot clusters (Saturation Intelligence v1).
// Returns up to 8 distinct gap labels, ordered by appearance in priority clusters.
function extractAngleGaps(
  intel: Record<string, unknown> | null,
): string[] {
  if (!intel) return [];
  const clusters = (intel.clusters as Array<Record<string, unknown>>) || [];
  const gaps: string[] = [];
  for (const c of clusters) {
    const list = (c.angle_gaps as string[]) || [];
    for (const g of list) {
      if (g && !gaps.includes(g)) gaps.push(g);
      if (gaps.length >= 8) break;
    }
    if (gaps.length >= 8) break;
  }
  return gaps;
}

// ----------------------------------------------------------------------------
// STAGE 0 — BRIEFING PACKET
// ----------------------------------------------------------------------------
async function stage0_briefing(
  supabase: SupabaseClient,
  input: PipelineInput,
  pipeline_run_id: string,
): Promise<BriefingPacket> {
  const t0 = Date.now();

  // Pull workbench findings
  const { data: workbench } = await supabase
    .from("architect_workbench")
    .select("id, title, severity, description, payload")
    .eq("user_id", input.user_id)
    .eq("domain", input.domain)
    .eq("status", "open")
    .order("spiral_score", { ascending: false, nullsFirst: false })
    .limit(10);

  // Pull keyword universe (top opportunities)
  const { data: keywords } = await supabase
    .from("keyword_universe")
    .select("keyword, opportunity_score, intent")
    .eq("user_id", input.user_id)
    .eq("domain", input.domain)
    .order("opportunity_score", { ascending: false, nullsFirst: false })
    .limit(20);

  // Pull seasonal context
  const { data: seasonal } = await supabase
    .from("seasonal_context")
    .select("event_name, narrative, peak_date")
    .gte("peak_date", new Date().toISOString().slice(0, 10))
    .order("peak_date", { ascending: true })
    .limit(3);

  // Pull tracked site business profile
  let business_context: Record<string, unknown> = {};
  if (input.tracked_site_id) {
    const { data: site } = await supabase
      .from("tracked_sites")
      .select("business_profile, voice_dna, identity_card")
      .eq("id", input.tracked_site_id)
      .maybeSingle();
    if (site) {
      business_context = {
        business_profile: site.business_profile,
        voice_dna_strength: (site.voice_dna as { strength?: number })?.strength ?? 0,
        identity: site.identity_card,
      };
    }
  }

  // ── Saturation Intelligence v1 — pull latest weekly snapshot (Job 3 output)
  // Provides angle_gaps + saturation_score per priority cluster, computed once/week
  // by cron-saturation-analysis. Lets the strategist avoid topics already saturated
  // and prioritise gaps with high opportunity. Non-blocking : null-safe if absent.
  let saturation_intel: Record<string, unknown> | null = null;
  if (input.tracked_site_id) {
    const { data: snap } = await supabase
      .from("saturation_snapshots")
      .select("clusters, global_score, generated_at")
      .eq("tracked_site_id", input.tracked_site_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snap) {
      saturation_intel = {
        global_score: snap.global_score,
        clusters: snap.clusters,
        snapshot_age_days: Math.round(
          (Date.now() - new Date(snap.generated_at as string).getTime()) / 86_400_000,
        ),
      };
    }
  }

  const briefing: BriefingPacket = {
    domain: input.domain,
    content_type: input.content_type,
    target_url: input.target_url,
    briefing_data: {
      angle_hints: (workbench ?? []).map((w) => w.title),
      keywords: (keywords ?? []).map((k) => k.keyword as string),
      competitor_gaps: extractAngleGaps(saturation_intel),
      seasonal_context: (seasonal ?? []).map((s) => s.event_name as string).join(", ") || null,
      spiral_phase: null,
      workbench_findings: (workbench ?? []).map((w) => ({
        title: w.title as string,
        severity: w.severity as string,
        description: w.description as string | undefined,
      })),
      business_context: { ...business_context, saturation_intel },
    },
    source_signals: {
      workbench_count: workbench?.length ?? 0,
      keywords_count: keywords?.length ?? 0,
      seasonal_count: seasonal?.length ?? 0,
      saturation_snapshot: saturation_intel ? "present" : "absent",
    },
    workbench_item_ids: (workbench ?? []).map((w) => w.id as string),
    spiral_phase: null,
  };

  // Persist snapshot
  const { data: saved } = await supabase
    .from("editorial_briefing_packets")
    .insert({
      user_id: input.user_id,
      domain: input.domain,
      tracked_site_id: input.tracked_site_id,
      content_type: input.content_type,
      target_url: input.target_url,
      briefing_data: briefing.briefing_data,
      source_signals: briefing.source_signals,
      workbench_item_ids: briefing.workbench_item_ids,
      spiral_phase: briefing.spiral_phase,
    })
    .select("id")
    .single();

  if (saved) briefing.id = saved.id as string;

  await logStage(supabase, {
    user_id: input.user_id,
    domain: input.domain,
    pipeline_run_id,
    content_type: input.content_type,
    stage: "briefing",
    model_used: null,
    latency_ms: Date.now() - t0,
    status: "success",
    metadata: { sources: briefing.source_signals },
  });

  return briefing;
}

// ----------------------------------------------------------------------------
// STAGE 1 — STRATEGIST
// ----------------------------------------------------------------------------
async function stage1_strategist(
  supabase: SupabaseClient,
  input: PipelineInput,
  briefing: BriefingPacket,
  model: string,
  pipeline_run_id: string,
) {
  const t0 = Date.now();
  const prompt = `Tu es le Stratège éditorial. Analyse le briefing et propose UN angle unique, un plan structuré et l'intention de recherche cible.

DOMAIN: ${input.domain}
CONTENT TYPE: ${input.content_type}
TARGET URL: ${input.target_url ?? "(nouveau)"}
USER BRIEF: ${input.user_brief ?? "(automatique)"}

WORKBENCH FINDINGS (top 10):
${briefing.briefing_data.workbench_findings.map((w) => `- [${w.severity}] ${w.title}`).join("\n")}

KEYWORDS DISPONIBLES: ${briefing.briefing_data.keywords.slice(0, 10).join(", ")}
CONTEXTE SAISONNIER: ${briefing.briefing_data.seasonal_context ?? "(aucun)"}

Réponds en JSON strict :
{
  "angle": "string court et différenciant",
  "outline": ["H2 1", "H2 2", ...],
  "intent": "informational|commercial|transactional|navigational",
  "target_length": 800
}`;

  const response = await callLLM(model, prompt, { jsonMode: true });
  const parsed = safeJSON(response.content) ?? {
    angle: "Angle par défaut",
    outline: ["Introduction", "Développement", "Conclusion"],
    intent: "informational",
    target_length: 800,
  };

  await logStage(supabase, {
    user_id: input.user_id,
    domain: input.domain,
    pipeline_run_id,
    content_type: input.content_type,
    stage: "strategist",
    model_used: model,
    tokens_in: response.tokens_in,
    tokens_out: response.tokens_out,
    latency_ms: Date.now() - t0,
    cost_usd: response.cost_usd,
    status: "success",
  });

  return { ...parsed, model_used: model };
}

// ----------------------------------------------------------------------------
// STAGE 2 — WRITER
// ----------------------------------------------------------------------------
async function stage2_writer(
  supabase: SupabaseClient,
  input: PipelineInput,
  briefing: BriefingPacket,
  strategy: { angle: string; outline: string[]; intent: string; target_length: number },
  model: string,
  pipeline_run_id: string,
) {
  const t0 = Date.now();

  // ── Dictadevi context (domaines dictadevi.*, opt-out via current_config) ────
  let dictadeviCtx: DictadeviContext | null = null;
  let dictadeviBlock = '';
  if (isDictadeviDomain(input.domain)) {
    // Lecture du toggle on/off depuis tracked_sites.current_config (default ON)
    let contextEnabled = true;
    try {
      const { data: site } = await supabase
        .from('tracked_sites')
        .select('current_config')
        .eq('domain', input.domain)
        .maybeSingle();
      const cfg = (site?.current_config ?? {}) as Record<string, unknown>;
      if (cfg.dictadevi_context_enabled === false) contextEnabled = false;
    } catch (e) {
      console.warn('[editorial-pipeline] lecture current_config échouée — défaut ON', e);
    }

    if (!contextEnabled) {
      console.log('[editorial-pipeline] Dictadevi context DÉSACTIVÉ (toggle off)');
    } else {
      try {
        const q = (briefing.briefing_data.keywords[0] || strategy.angle || input.user_brief || '').slice(0, 200);
        if (q) {
          dictadeviCtx = await fetchDictadeviContext(q);
          dictadeviBlock = renderDictadeviContextBlock(dictadeviCtx);
          console.log(`[editorial-pipeline] Dictadevi context injecté (q="${q}", chunks=${dictadeviCtx.knowledge.chunks?.length || 0}, terms=${dictadeviCtx.lexicon.terms?.length || 0}, ranges=${dictadeviCtx.catalog.ranges?.length || 0})`);
        }
      } catch (e) {
        console.warn('[editorial-pipeline] Dictadevi context indisponible — fallback sans ancrage', e);
      }
    }
  }

  const dictadeviRules = dictadeviBlock
    ? `\n\nCONTEXTE MÉTIER ANCRÉ (sources Dictadevi) :\n${dictadeviBlock}\n\nRÈGLES STRICTES (non-négociables) :\n- Si tu cites une norme (ex: DTU 25.41), tu DOIS référencer le source_reference exact présent dans <dictadevi_context>.\n- Si tu donnes un prix, utilise UNIQUEMENT les fourchettes de catalog_ranges. JAMAIS de prix inventé.\n- Réutilise le vocabulaire EXACT des terms du lexique pour matcher la longue traîne SEO.`
    : '';

  const prompt = `Tu es le Rédacteur. Rédige le contenu en suivant strictement la stratégie fournie.

TYPE: ${input.content_type}
ANGLE: ${strategy.angle}
INTENT: ${strategy.intent}
LONGUEUR CIBLE: ${strategy.target_length} mots
PLAN:
${strategy.outline.map((h, i) => `${i + 1}. ${h}`).join("\n")}

MOTS-CLÉS À INTÉGRER NATURELLEMENT: ${briefing.briefing_data.keywords.slice(0, 5).join(", ")}${dictadeviRules}

⚠️ TYPOGRAPHIE FR — CASSE PHRASTIQUE OBLIGATOIRE :
Tous les titres (title H1, sous-titres H2/H3, excerpt) DOIVENT être en casse phrastique française : majuscule UNIQUEMENT au premier mot et aux noms propres (marques, lieux, personnes, sigles). Le "Title Case" anglo-saxon (majuscule à chaque mot) est INTERDIT en français — il dégrade le CTR et brouille la reconnaissance d'entités par les LLMs.
Correct : "Comment optimiser le budget crawl d'un site e-commerce"
INTERDIT : "Comment Optimiser Le Budget Crawl D'un Site E-Commerce"

Réponds en JSON strict :
{
  "title": "Titre H1 optimisé en casse phrastique",
  "content": "Contenu HTML complet (h2, p, ul, etc.) — tous les <h2>/<h3> en casse phrastique",
  "excerpt": "Résumé 160 caractères max"
}`;

  const response = await callLLM(model, prompt, { jsonMode: true });
  const parsed = safeJSON(response.content) ?? {
    title: strategy.angle,
    content: "<p>Contenu non généré.</p>",
    excerpt: strategy.angle,
  };

  // Safeguard typographique FR : casse phrastique stricte sur title + headings HTML
  if (typeof parsed.title === "string") parsed.title = toFrenchSentenceCase(parsed.title);
  if (typeof parsed.excerpt === "string") parsed.excerpt = toFrenchSentenceCase(parsed.excerpt);
  if (typeof parsed.content === "string") parsed.content = normalizeHtmlHeadings(parsed.content);

  // Section "Sources" en fin d'article si contexte Dictadevi présent
  if (dictadeviCtx && typeof parsed.content === "string") {
    const { references, disclaimer } = extractDictadeviSources(dictadeviCtx);
    if (references.length || disclaimer) {
      const items = references.map(r => `<li>${r}</li>`).join('');
      const discl = disclaimer ? `<p class="text-sm text-muted-foreground"><em>${disclaimer}</em></p>` : '';
      parsed.content += `\n<section class="sources"><h2>Sources</h2>${items ? `<ul>${items}</ul>` : ''}${discl}</section>`;
    }
  }

  await logStage(supabase, {
    user_id: input.user_id,
    domain: input.domain,
    pipeline_run_id,
    content_type: input.content_type,
    stage: "writer",
    model_used: model,
    tokens_in: response.tokens_in,
    tokens_out: response.tokens_out,
    latency_ms: Date.now() - t0,
    cost_usd: response.cost_usd,
    status: "success",
  });

  return { ...parsed, model_used: model };
}

// ----------------------------------------------------------------------------
// STAGE 3 — TONALIZER (optional)
// ----------------------------------------------------------------------------
async function stage3_tonalizer(
  supabase: SupabaseClient,
  input: PipelineInput,
  draft: { title: string; content: string; excerpt?: string },
  model: string,
  pipeline_run_id: string,
) {
  const t0 = Date.now();
  const { data: site } = await supabase
    .from("tracked_sites")
    .select("voice_dna")
    .eq("id", input.tracked_site_id)
    .maybeSingle();

  const voiceDna = (site?.voice_dna as { signature?: string }) ?? {};
  if (!voiceDna.signature) {
    return { ...draft, voice_adjusted: false, model_used: null };
  }

  const prompt = `Tu es le Tonalisateur. Réécris le contenu suivant en respectant strictement cette voix de marque, sans changer les faits ni la structure.

VOIX DE MARQUE: ${voiceDna.signature}

CONTENU À AJUSTER:
TITRE: ${draft.title}
CONTENU: ${draft.content}

Réponds en JSON strict avec les mêmes clés (title, content, excerpt).`;

  const response = await callLLM(model, prompt, { jsonMode: true });
  const parsed = safeJSON(response.content) ?? draft;

  await logStage(supabase, {
    user_id: input.user_id,
    domain: input.domain,
    pipeline_run_id,
    content_type: input.content_type,
    stage: "tonalizer",
    model_used: model,
    tokens_in: response.tokens_in,
    tokens_out: response.tokens_out,
    latency_ms: Date.now() - t0,
    cost_usd: response.cost_usd,
    status: "success",
  });

  return { ...parsed, voice_adjusted: true, model_used: model };
}

// ----------------------------------------------------------------------------
// LLM CALL (Lovable AI Gateway)
// ----------------------------------------------------------------------------
async function callLLM(
  model: string,
  prompt: string,
  opts: { jsonMode?: boolean } = {},
): Promise<{ content: string; tokens_in: number; tokens_out: number; cost_usd: number }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`LLM gateway error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage ?? {};

  return {
    content,
    tokens_in: usage.prompt_tokens ?? 0,
    tokens_out: usage.completion_tokens ?? 0,
    cost_usd: 0, // gateway bills via credits
  };
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------
function safeJSON<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function logStage(
  supabase: SupabaseClient,
  log: {
    user_id: string;
    domain: string;
    pipeline_run_id: string;
    content_type: string;
    stage: string;
    model_used: string | null;
    tokens_in?: number;
    tokens_out?: number;
    latency_ms: number;
    cost_usd?: number;
    status: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await supabase.from("editorial_pipeline_logs").insert(log);
  } catch (e) {
    console.warn("[editorialPipeline] Failed to log stage:", e);
  }
}

// ----------------------------------------------------------------------------
// CONSTANTS EXPORTED FOR UI
// ----------------------------------------------------------------------------
export const AVAILABLE_MODELS = [
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", tier: "fast" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "balanced" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "premium" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano", tier: "fast" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", tier: "balanced" },
  { value: "openai/gpt-5", label: "GPT-5", tier: "premium" },
  { value: "openai/gpt-5.2", label: "GPT-5.2", tier: "premium" },
  { value: "mistralai/mistral-large-latest", label: "Mistral Large", tier: "balanced" },
] as const;

export const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "blog_article", label: "Article blog" },
  { value: "seo_page", label: "Page SEO" },
  { value: "social_post", label: "Post social" },
  { value: "email", label: "Email" },
  { value: "landing_page", label: "Landing page" },
  { value: "guide", label: "Guide" },
  { value: "faq", label: "FAQ" },
];
