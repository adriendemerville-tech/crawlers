import { corsHeaders } from '../_shared/cors.ts';
import { trackTokenUsage } from '../_shared/tokenTracker.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface DetectedValues {
  sector: string;
  country: string;
  valueProposition: string;
  targetAudience: string;
  businessAge: string;
  businessType: string;
  mainProducts: string;
}

interface DiagnoseRequest {
  domain: string;
  url?: string;
  coreValueSummary: string;
  action: 'extract' | 'compare';
  originalValues?: DetectedValues;
  correctedValues?: DetectedValues;
  lang: 'fr' | 'en' | 'es';
}

interface Discrepancy {
  field: string;
  original: string;
  corrected: string;
  impact: 'high' | 'medium' | 'low';
  explanation: string;
  verdict: 'misleading_data' | 'absent_data' | 'training_bias' | 'reasoning_error';
  evidence?: string;
  userExplanation?: string;
  sourcePages?: Array<{
    url: string;
    title: string;
    element: string;
    excerpt: string;
  }>;
  screenshotUrl?: string;
}

interface HallucinationRecommendation {
  id: string;
  category: 'metadata' | 'content' | 'schema' | 'authority';
  priority: 'critical' | 'important' | 'optional';
  title: string;
  description: string;
  codeSnippet?: string;
}

interface HallucinationDiagnosis {
  originalValues: DetectedValues;
  correctedValues: DetectedValues;
  discrepancies: Discrepancy[];
  confusionSources: string[];
  recommendations: HallucinationRecommendation[];
  analysisNarrative: string;
  verdictSummary: {
    misleading_data: number;
    absent_data: number;
    training_bias: number;
    reasoning_error: number;
  };
  factualContext: FactualContext;
}

// ═══ Factual Context: toutes les données chargées pour le diagnostic ═══

interface FactualContext {
  crawlData: CrawlSnapshot | null;
  auditData: AuditSnapshot | null;
  identityCard: Record<string, unknown> | null;
  rankingData: RankingSnapshot | null;
  previousCorrections: PreviousCorrection[];
}

interface CrawlSnapshot {
  source: 'site_crawl' | 'pre_crawl';
  crawledAt: string;
  pages: Array<{
    url: string;
    title: string;
    h1: string;
    metaDescription: string;
    wordCount: number;
    schemaTypes: string[];
    isIndexable: boolean;
    bodyExcerpt: string;
    canonicalUrl: string;
    hasOg: boolean;
  }>;
}

interface AuditSnapshot {
  auditType: string;
  createdAt: string;
  brandPerception?: { sector?: string; targetAudience?: string; valueProposition?: string };
  scores?: Record<string, number>;
}

interface RankingSnapshot {
  totalRankedKeywords: number;
  averagePosition: number;
  topKeywords: Array<{ keyword: string; position: number; volume: number }>;
}

interface PreviousCorrection {
  field: string;
  original: string;
  corrected: string;
  correctedAt: string;
}

// ═══ Data loaders ═══

async function loadCrawlData(supabase: any, domain: string): Promise<CrawlSnapshot | null> {
  try {
    // 1. Check site_crawls (full crawl < 30 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const { data: crawl } = await supabase
      .from('site_crawls')
      .select('id, created_at, status')
      .eq('domain', domain)
      .eq('status', 'completed')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (crawl?.id) {
      const { data: pages } = await supabase
        .from('crawl_pages')
        .select('url, title, h1, meta_description, word_count, has_schema_org, schema_org_types, is_indexable, body_text_truncated, canonical_url, has_og')
        .eq('crawl_id', crawl.id)
        .order('seo_score', { ascending: false })
        .limit(20);

      if (pages?.length) {
        return {
          source: 'site_crawl',
          crawledAt: crawl.created_at,
          pages: pages.map((p: any) => ({
            url: p.url || '',
            title: p.title || '',
            h1: p.h1 || '',
            metaDescription: p.meta_description || '',
            wordCount: p.word_count || 0,
            schemaTypes: Array.isArray(p.schema_org_types) ? p.schema_org_types : [],
            isIndexable: p.is_indexable !== false,
            bodyExcerpt: (p.body_text_truncated || '').slice(0, 300),
            canonicalUrl: p.canonical_url || '',
            hasOg: p.has_og || false,
          })),
        };
      }
    }

    return null;
  } catch (e) {
    console.warn('[diagnose] Crawl data load error:', e);
    return null;
  }
}

async function loadAuditData(supabase: any, domain: string): Promise<AuditSnapshot | null> {
  try {
    const { data: audit } = await supabase
      .from('audit_raw_data')
      .select('audit_type, created_at, raw_payload')
      .eq('domain', domain)
      .in('audit_type', ['strategic', 'strategic_parallel'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!audit) return null;

    const payload = audit.raw_payload || {};
    return {
      auditType: audit.audit_type,
      createdAt: audit.created_at,
      brandPerception: payload.brand_perception || payload.brandPerception || undefined,
      scores: payload.scores || undefined,
    };
  } catch (e) {
    console.warn('[diagnose] Audit data load error:', e);
    return null;
  }
}

async function loadRankingData(supabase: any, domain: string): Promise<RankingSnapshot | null> {
  try {
    const { data: audit } = await supabase
      .from('audit_raw_data')
      .select('raw_payload')
      .eq('domain', domain)
      .in('audit_type', ['strategic', 'strategic_parallel'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!audit?.raw_payload?.keyword_positioning) return null;

    const kp = audit.raw_payload.keyword_positioning;
    return {
      totalRankedKeywords: kp.total_ranked_keywords || 0,
      averagePosition: kp.average_position || 0,
      topKeywords: (kp.main_keywords || []).slice(0, 10).map((k: any) => ({
        keyword: k.keyword,
        position: k.current_rank,
        volume: k.volume,
      })),
    };
  } catch (e) {
    console.warn('[diagnose] Ranking data load error:', e);
    return null;
  }
}

async function loadPreviousCorrections(supabase: any, domain: string): Promise<PreviousCorrection[]> {
  try {
    const { data } = await supabase
      .from('hallucination_corrections')
      .select('correction_data, created_at')
      .ilike('domain', `%${domain}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data?.length) return [];

    const corrections: PreviousCorrection[] = [];
    for (const row of data) {
      const cd = row.correction_data;
      if (cd?.discrepancies && Array.isArray(cd.discrepancies)) {
        for (const d of cd.discrepancies) {
          corrections.push({
            field: d.field || '',
            original: d.original || '',
            corrected: d.corrected || '',
            correctedAt: row.created_at,
          });
        }
      }
    }
    return corrections;
  } catch {
    return [];
  }
}

// ═══ Format factual context for LLM ═══

function formatFactualContextForPrompt(ctx: FactualContext): string {
  const parts: string[] = [];

  if (ctx.crawlData) {
    parts.push(`\n═══ DONNÉES CRAWLÉES (${ctx.crawlData.source}, ${ctx.crawlData.crawledAt}) ═══`);
    for (const page of ctx.crawlData.pages.slice(0, 10)) {
      parts.push(`📄 ${page.url}`);
      parts.push(`   Title: "${page.title}" | H1: "${page.h1}"`);
      parts.push(`   Meta: "${page.metaDescription?.slice(0, 120) || '(vide)'}"`);
      parts.push(`   ${page.wordCount} mots | Schema: ${page.schemaTypes.length > 0 ? page.schemaTypes.join(', ') : 'aucun'} | Indexable: ${page.isIndexable ? 'oui' : 'non'}`);
      if (page.bodyExcerpt) {
        parts.push(`   Extrait contenu: "${page.bodyExcerpt.slice(0, 200)}..."`);
      }
      if (page.canonicalUrl) parts.push(`   Canonical: ${page.canonicalUrl}`);
    }
  } else {
    parts.push('\n⚠️ AUCUNE DONNÉE DE CRAWL DISPONIBLE — le LLM n\'avait pas de données factuelles sur la structure du site.');
  }

  if (ctx.identityCard) {
    parts.push(`\n═══ CARTE D'IDENTITÉ DU SITE ═══`);
    const ic = ctx.identityCard;
    if (ic.market_sector) parts.push(`Secteur: ${ic.market_sector}`);
    if (ic.products_services) parts.push(`Produits: ${ic.products_services}`);
    if (ic.target_audience) parts.push(`Cible: ${ic.target_audience}`);
    if (ic.commercial_area) parts.push(`Zone: ${ic.commercial_area}`);
    if (ic.identity_confidence) parts.push(`Confiance: ${ic.identity_confidence}`);
  }

  if (ctx.rankingData) {
    parts.push(`\n═══ DONNÉES DE POSITIONNEMENT ═══`);
    parts.push(`Total mots-clés positionnés: ${ctx.rankingData.totalRankedKeywords}`);
    parts.push(`Position moyenne: ${ctx.rankingData.averagePosition}`);
    if (ctx.rankingData.topKeywords.length > 0) {
      parts.push(`Top mots-clés: ${ctx.rankingData.topKeywords.map(k => `"${k.keyword}" (pos ${k.position})`).join(', ')}`);
    }
  }

  if (ctx.previousCorrections.length > 0) {
    parts.push(`\n═══ CORRECTIONS PRÉCÉDENTES PAR L'UTILISATEUR ═══`);
    for (const c of ctx.previousCorrections) {
      parts.push(`  • ${c.field}: "${c.original}" → "${c.corrected}" (${c.correctedAt.split('T')[0]})`);
    }
  }

  if (ctx.auditData?.brandPerception) {
    parts.push(`\n═══ PERCEPTION DE MARQUE (audit ${ctx.auditData.auditType}) ═══`);
    const bp = ctx.auditData.brandPerception;
    if (bp.sector) parts.push(`Secteur détecté: ${bp.sector}`);
    if (bp.targetAudience) parts.push(`Audience détectée: ${bp.targetAudience}`);
    if (bp.valueProposition) parts.push(`Proposition de valeur détectée: ${bp.valueProposition}`);
  }

  return parts.join('\n');
}

// ═══ Translations ═══

const translations = {
  fr: {
    extractSystemPrompt: `Tu es un expert en analyse de contenu web. Extrais les informations clés suivantes à partir du résumé d'un site web.

Tu dois retourner un JSON avec ces champs:
- sector: Le secteur d'activité (ex: "E-commerce", "SaaS", "Restauration")
- country: Le pays ou la zone géographique (ex: "France", "Europe")
- valueProposition: La proposition de valeur principale en 1-2 phrases
- targetAudience: L'audience cible (ex: "Particuliers 25-45 ans", "PME")
- businessAge: L'ancienneté estimée (ex: "Startup", "10+ ans")
- businessType: Le type d'entreprise (ex: "TPE", "PME", "Grande entreprise")
- mainProducts: Les produits/services principaux

Réponds UNIQUEMENT en JSON valide, sans markdown.`,

    extractUserPrompt: (domain: string, summary: string) =>
      `Analyse le site "${domain}".

Résumé disponible:
"${summary}"

Extrais les informations structurées en JSON.`,

    compareSystemPrompt: `Tu es un expert en GEO (Generative Engine Optimization) et diagnosticien d'hallucinations LLM.

Ta mission : Comparer les informations détectées par l'IA avec les corrections de l'utilisateur, EN UTILISANT les données factuelles fournies (crawl, rankings, carte d'identité) pour identifier la CAUSE RACINE de chaque hallucination.

Pour chaque incohérence, tu dois attribuer un VERDICT parmi :

🔴 misleading_data — Le site CONTIENT une donnée, mais elle est ambiguë, contradictoire ou mal structurée, induisant le LLM en erreur.
   Exemple : Title dit "Restaurant" mais le site vend des logiciels.
   Evidence requise : cite le champ exact du crawl qui a induit l'erreur.

🟡 absent_data — Le site NE FOURNIT PAS l'information. Le LLM a comblé le vide par déduction probabiliste.
   Exemple : Pas de Schema.org → le LLM invente le type d'activité.
   Evidence requise : note que le champ est vide/absent dans le crawl.

🟠 training_bias — Le site fournit des données CLAIRES que le LLM ignore, substituant une information de ses données d'entraînement.
   Exemple : Confusion avec un homonyme, ancienne activité du domaine.
   Evidence requise : montre que le crawl est clair mais le LLM dit autre chose.

🔵 reasoning_error — Le LLM a les bonnes données mais tire une CONCLUSION LOGIQUE FAUSSE.
   Exemple : "15 liens internes = excellent maillage" alors que tous pointent vers la même page.
   Evidence requise : explique la faille de raisonnement.

Tu dois retourner un JSON structuré avec:
- discrepancies: Array de {field, original, corrected, impact: "high"|"medium"|"low", explanation, verdict: "misleading_data"|"absent_data"|"training_bias"|"reasoning_error", evidence: string, userExplanation: string, sourcePages: [{url, title, element, excerpt}]}
  - userExplanation : un texte PÉDAGOGIQUE destiné à l'utilisateur final (non technique) qui explique en langage simple POURQUOI l'IA s'est trompée. 
    - Si absent_data : explique que le site ne fournit pas assez d'informations sur ce point, donc l'IA a dû deviner. Propose ce que l'utilisateur peut ajouter concrètement.
    - Si training_bias : explique que l'IA possède un historique ou des connaissances antérieures sur ce domaine qui contredisent la réalité actuelle du site. Précise que c'est une limitation connue des LLM et que renforcer les signaux du site corrigera ça.
    - Si misleading_data : explique quel élément du site a induit l'IA en erreur et comment le corriger.
    - Si reasoning_error : explique la faille de logique de l'IA de façon accessible.
- confusionSources: Array de strings décrivant les causes de confusion
- recommendations: Array de {id, category: "metadata"|"content"|"schema"|"authority", priority: "critical"|"important"|"optional", title, description, codeSnippet?}
- analysisNarrative: Un paragraphe de diagnostic
- verdictSummary: {misleading_data: N, absent_data: N, training_bias: N, reasoning_error: N}

RÈGLE CRITIQUE : Pour chaque discrepancy, identifie la/les PAGE(S) EXACTE(S) du crawl où se situe le problème et l'ÉLÉMENT HTML précis (title, h1, meta_description, schema_org, body_content, canonical, og_tags).
Cite l'extrait de texte exact qui induit en erreur ou qui est absent.
Base-toi TOUJOURS sur les données factuelles ci-dessous, jamais sur des suppositions.

Réponds UNIQUEMENT en JSON valide.`,

    compareUserPrompt: (domain: string, original: DetectedValues, corrected: DetectedValues, factualContext: string) =>
      `Diagnostic d'hallucination pour "${domain}".

VALEURS DÉTECTÉES PAR L'IA:
${JSON.stringify(original, null, 2)}

VALEURS CORRIGÉES PAR L'UTILISATEUR:
${JSON.stringify(corrected, null, 2)}

${factualContext}

Pour chaque écart entre les valeurs IA et les corrections utilisateur :
1. Cherche dans les DONNÉES CRAWLÉES si le site contient une info trompeuse (misleading_data)
2. Sinon, vérifie si l'info est tout simplement absente du site (absent_data)
3. Si l'info crawlée est claire ET contredit la valeur IA → le LLM a ignoré les faits (training_bias)
4. Si l'info est présente et correcte mais mal interprétée → erreur de raisonnement (reasoning_error)

Fournis un JSON complet avec les verdicts.`,
  },
  en: {
    extractSystemPrompt: `You are a web content analysis expert. Extract key information from a website summary.

Return a JSON with these fields:
- sector: Industry sector (e.g., "E-commerce", "SaaS", "Restaurant")
- country: Country or geographic area (e.g., "France", "Europe")
- valueProposition: Main value proposition in 1-2 sentences
- targetAudience: Target audience (e.g., "Adults 25-45", "SMBs")
- businessAge: Estimated age (e.g., "Startup", "10+ years")
- businessType: Business type (e.g., "Small business", "Enterprise")
- mainProducts: Main products/services

Respond ONLY with valid JSON, no markdown.`,

    extractUserPrompt: (domain: string, summary: string) =>
      `Analyze the site "${domain}".

Available summary:
"${summary}"

Extract structured information as JSON.`,

    compareSystemPrompt: `You are a GEO (Generative Engine Optimization) expert and LLM hallucination diagnostician.

Your mission: Compare AI-detected information with user corrections, USING the factual data provided (crawl, rankings, identity card) to identify the ROOT CAUSE of each hallucination.

For each discrepancy, assign a VERDICT:

🔴 misleading_data — The site CONTAINS data, but it's ambiguous, contradictory or poorly structured, misleading the LLM.
🟡 absent_data — The site DOES NOT provide the information. The LLM filled the gap by probabilistic deduction.
🟠 training_bias — The site provides CLEAR data that the LLM ignores, substituting information from its training data.
🔵 reasoning_error — The LLM has correct data but draws a WRONG LOGICAL CONCLUSION.

Return structured JSON with:
- discrepancies: Array of {field, original, corrected, impact, explanation, verdict, evidence, sourcePages: [{url, title, element: "title"|"h1"|"meta_description"|"schema_org"|"body_content"|"canonical"|"og_tags", excerpt: "exact problematic text"}]}
- confusionSources: Array of strings
- recommendations: Array of {id, category, priority, title, description, codeSnippet?}
- analysisNarrative: Diagnosis paragraph
- verdictSummary: {misleading_data: N, absent_data: N, training_bias: N, reasoning_error: N}

CRITICAL: For each discrepancy, identify the EXACT PAGE(S) from crawl data and the precise HTML ELEMENT causing the issue. Quote the exact text excerpt.
Always base analysis on factual data below, never assumptions.

Respond ONLY with valid JSON.`,

    compareUserPrompt: (domain: string, original: DetectedValues, corrected: DetectedValues, factualContext: string) =>
      `Hallucination diagnosis for "${domain}".

AI-DETECTED VALUES:
${JSON.stringify(original, null, 2)}

USER-CORRECTED VALUES:
${JSON.stringify(corrected, null, 2)}

${factualContext}

For each gap between AI values and user corrections:
1. Check CRAWL DATA for misleading info (misleading_data)
2. Check if info is simply absent (absent_data)
3. If crawl data is clear AND contradicts AI → training_bias
4. If info is present and correct but misinterpreted → reasoning_error

Provide complete JSON with verdicts.`,
  },
  es: {
    extractSystemPrompt: `Eres un experto en análisis de contenido web. Extrae información clave de un resumen de sitio web.

Devuelve un JSON con estos campos:
- sector: Sector de actividad
- country: País o zona geográfica
- valueProposition: Propuesta de valor principal en 1-2 frases
- targetAudience: Audiencia objetivo
- businessAge: Antigüedad estimada
- businessType: Tipo de empresa
- mainProducts: Productos/servicios principales

Responde ÚNICAMENTE con JSON válido, sin markdown.`,

    extractUserPrompt: (domain: string, summary: string) =>
      `Analiza el sitio "${domain}".

Resumen disponible:
"${summary}"

Extrae la información estructurada en JSON.`,

    compareSystemPrompt: `Eres un experto en GEO y diagnosticador de alucinaciones LLM.

Tu misión: Comparar información detectada por IA con correcciones del usuario, USANDO los datos factuales proporcionados para identificar la CAUSA RAÍZ de cada alucinación.

Veredictos posibles:
🔴 misleading_data — El sitio CONTIENE datos ambiguos que confunden al LLM.
🟡 absent_data — El sitio NO proporciona la información. El LLM la dedujo probabilísticamente.
🟠 training_bias — El sitio tiene datos CLAROS que el LLM ignora.
🔵 reasoning_error — El LLM tiene datos correctos pero saca una CONCLUSIÓN LÓGICA ERRÓNEA.

Devuelve JSON estructurado con:
- discrepancies: Array de {field, original, corrected, impact, explanation, verdict, evidence, sourcePages: [{url, title, element, excerpt}]}
- confusionSources, recommendations, analysisNarrative, verdictSummary

CRÍTICO: Para cada discrepancia, identifica la(s) PÁGINA(S) EXACTA(S) y el ELEMENTO HTML preciso. Cita el extracto de texto exacto.

Responde ÚNICAMENTE con JSON válido.`,

    compareUserPrompt: (domain: string, original: DetectedValues, corrected: DetectedValues, factualContext: string) =>
      `Diagnóstico de alucinación para "${domain}".

VALORES DETECTADOS POR IA:
${JSON.stringify(original, null, 2)}

VALORES CORREGIDOS POR EL USUARIO:
${JSON.stringify(corrected, null, 2)}

${factualContext}

Proporciona JSON completo con veredictos.`,
  }
};

// ═══ Utilities ═══

function sanitizeJsonResponse(content: string): string {
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  return jsonStr.trim();
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 5000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI gateway error:', response.status, errorText);
    if (response.status === 429) throw new Error('RATE_LIMIT');
    if (response.status === 402) throw new Error('CREDITS_EXHAUSTED');
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  trackTokenUsage('diagnose-hallucination', 'google/gemini-2.5-flash', data.usage);
  return data.choices?.[0]?.message?.content || '';
}

// ═══ Main handler ═══

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DiagnoseRequest = await req.json();
    const { domain, coreValueSummary, action, originalValues, correctedValues, lang = 'fr' } = body;

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const t = translations[lang] || translations.fr;
    const supabase = getServiceClient();
    const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();

    // ── Fetch site identity card ──
    let identityCard: Record<string, unknown> | null = null;
    let identityHint = '';
    try {
      const ctx = await getSiteContext(supabase, { domain: normalizedDomain });
      if (ctx) {
        identityCard = ctx;
        const parts: string[] = [];
        if (ctx.market_sector) parts.push(`Sector: ${ctx.market_sector}`);
        if (ctx.products_services) parts.push(`Products/Services: ${ctx.products_services}`);
        if (ctx.target_audience) parts.push(`Target: ${ctx.target_audience}`);
        if (ctx.commercial_area) parts.push(`Area: ${ctx.commercial_area}`);
        if (parts.length > 0) identityHint = `\n\nVerified site identity:\n${parts.join('\n')}`;
        console.log(`[diagnose] Site context loaded (confidence: ${ctx.identity_confidence || 0})`);
      }
    } catch (e) {
      console.warn('[diagnose] Could not fetch site context:', e);
    }

    // === ACTION: EXTRACT ===
    if (action === 'extract') {
      console.log(`[diagnose] Extracting values for: ${domain}`);

      const content = await callAI(
        t.extractSystemPrompt,
        t.extractUserPrompt(domain, coreValueSummary + identityHint)
      );

      let extractedValues: DetectedValues;
      try {
        const jsonStr = sanitizeJsonResponse(content);
        extractedValues = JSON.parse(jsonStr);
      } catch {
        console.error('Failed to parse extract response:', content);
        extractedValues = {
          sector: '', country: '',
          valueProposition: coreValueSummary?.substring(0, 200) || '',
          targetAudience: '', businessAge: '', businessType: '', mainProducts: '',
        };
      }

      return new Response(
        JSON.stringify({ success: true, extractedValues }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === ACTION: COMPARE (enriched with factual data) ===
    if (action === 'compare') {
      if (!originalValues || !correctedValues) {
        return new Response(
          JSON.stringify({ success: false, error: 'Original and corrected values are required for comparison' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[diagnose] Loading factual context for: ${normalizedDomain}`);

      // ── Load ALL available data in parallel ──
      const [crawlData, auditData, rankingData, previousCorrections] = await Promise.all([
        loadCrawlData(supabase, normalizedDomain),
        loadAuditData(supabase, normalizedDomain),
        loadRankingData(supabase, normalizedDomain),
        loadPreviousCorrections(supabase, normalizedDomain),
      ]);

      const factualContext: FactualContext = {
        crawlData,
        auditData,
        identityCard,
        rankingData,
        previousCorrections,
      };

      console.log(`[diagnose] Context loaded — crawl: ${crawlData ? crawlData.pages.length + ' pages' : 'none'}, audit: ${auditData ? 'yes' : 'none'}, rankings: ${rankingData ? rankingData.totalRankedKeywords + ' kw' : 'none'}, prev corrections: ${previousCorrections.length}`);

      // ── Format factual context for LLM prompt ──
      const factualContextStr = formatFactualContextForPrompt(factualContext);

      // ── Call LLM with enriched context ──
      const content = await callAI(
        t.compareSystemPrompt,
        t.compareUserPrompt(domain, originalValues, correctedValues, factualContextStr)
      );

      let diagnosis: HallucinationDiagnosis;
      try {
        const jsonStr = sanitizeJsonResponse(content);
        const parsed = JSON.parse(jsonStr);

        diagnosis = {
          originalValues,
          correctedValues,
          discrepancies: (parsed.discrepancies || []).map((d: any) => {
            const disc: Discrepancy = {
              ...d,
              verdict: d.verdict || 'absent_data',
              evidence: d.evidence || '',
              sourcePages: Array.isArray(d.sourcePages) ? d.sourcePages : [],
            };
            // Add screenshot URL for the first source page if available
            if (disc.sourcePages && disc.sourcePages.length > 0) {
              const pageUrl = disc.sourcePages[0].url;
              if (pageUrl) {
                disc.screenshotUrl = `https://image.thum.io/get/width/600/crop/800/${encodeURIComponent(pageUrl)}`;
              }
            }
            return disc;
          }),
          confusionSources: parsed.confusionSources || [],
          recommendations: parsed.recommendations || [],
          analysisNarrative: parsed.analysisNarrative || '',
          verdictSummary: parsed.verdictSummary || computeVerdictSummary(parsed.discrepancies || []),
          factualContext,
        };
      } catch {
        console.error('Failed to parse compare response:', content);

        // Fallback: generate diagnosis from raw field diffs
        const discrepancies: Discrepancy[] = [];
        const fields: (keyof DetectedValues)[] = ['sector', 'country', 'valueProposition', 'targetAudience', 'businessAge', 'businessType', 'mainProducts'];

        for (const field of fields) {
          if (originalValues[field] !== correctedValues[field] && correctedValues[field]) {
            // Determine verdict based on crawl data
            const verdict = determineVerdictFromCrawl(field, originalValues[field], correctedValues[field], crawlData);
            // Find source pages for this field in crawl data
            const sourcePages = findSourcePagesForField(field, originalValues[field], crawlData);
            const disc: Discrepancy = {
              field,
              original: originalValues[field] || '(non détecté)',
              corrected: correctedValues[field],
              impact: field === 'valueProposition' || field === 'sector' ? 'high' : 'medium',
              explanation: `L'IA avait détecté "${originalValues[field] || 'aucune valeur'}" mais la réalité est "${correctedValues[field]}".`,
              verdict,
              evidence: verdict === 'absent_data' ? 'Donnée non trouvée dans le crawl' : 'Basé sur analyse du crawl',
              sourcePages,
            };
            if (sourcePages.length > 0) {
              disc.screenshotUrl = `https://image.thum.io/get/width/600/crop/800/${encodeURIComponent(sourcePages[0].url)}`;
            }
            discrepancies.push(disc);
          }
        }

        diagnosis = {
          originalValues,
          correctedValues,
          discrepancies,
          confusionSources: discrepancies.length > 0
            ? ['Contenu de page insuffisant', 'Métadonnées imprécises', 'Manque de données structurées']
            : [],
          recommendations: discrepancies.length > 0
            ? [{ id: 'add-schema', category: 'schema', priority: 'critical', title: 'Ajouter des données structurées', description: 'Injectez du JSON-LD avec les informations correctes pour guider les LLM.' }]
            : [],
          analysisNarrative: discrepancies.length > 0
            ? `L'IA a commis ${discrepancies.length} erreur(s) d'interprétation. Diagnostic basé sur ${crawlData ? crawlData.pages.length + ' pages crawlées' : 'aucun crawl disponible'}.`
            : 'Aucune incohérence majeure détectée.',
          verdictSummary: computeVerdictSummary(discrepancies),
          factualContext,
        };
      }

      console.log(`[diagnose] Complete — ${diagnosis.discrepancies.length} discrepancies, verdicts: ${JSON.stringify(diagnosis.verdictSummary)}`);

      return new Response(
        JSON.stringify({ success: true, diagnosis }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Legacy action
    const content = await callAI(
      t.extractSystemPrompt,
      t.extractUserPrompt(domain, coreValueSummary)
    );

    let result;
    try {
      const jsonStr = sanitizeJsonResponse(content);
      result = JSON.parse(jsonStr);
    } catch {
      result = {
        trueValue: `Unable to determine the exact value proposition for ${domain}.`,
        hallucinationAnalysis: 'Analysis parsing failed.',
        confusionSources: ['Insufficient structured data'],
        recommendations: ['Add comprehensive Schema.org markup'],
      };
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error diagnosing hallucination:', err);

    if (err.message === 'RATE_LIMIT') {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (err.message === 'CREDITS_EXHAUSTED') {
      return new Response(
        JSON.stringify({ success: false, error: 'AI credits exhausted.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Diagnosis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ═══ Helpers ═══

function computeVerdictSummary(discrepancies: Discrepancy[]) {
  return {
    misleading_data: discrepancies.filter(d => d.verdict === 'misleading_data').length,
    absent_data: discrepancies.filter(d => d.verdict === 'absent_data').length,
    training_bias: discrepancies.filter(d => d.verdict === 'training_bias').length,
    reasoning_error: discrepancies.filter(d => d.verdict === 'reasoning_error').length,
  };
}

function determineVerdictFromCrawl(
  field: string,
  originalValue: string,
  _correctedValue: string,
  crawlData: CrawlSnapshot | null
): Discrepancy['verdict'] {
  if (!crawlData || crawlData.pages.length === 0) {
    return 'absent_data';
  }

  // Check if the field's content can be found in crawl data
  const allText = crawlData.pages.map(p =>
    `${p.title} ${p.h1} ${p.metaDescription}`
  ).join(' ').toLowerCase();

  const originalLower = (originalValue || '').toLowerCase();

  if (!originalLower) return 'absent_data';

  // If the original AI value appears in the crawl → the site said something misleading
  const originalWords = originalLower.split(/\s+/).filter(w => w.length > 3);
  const matchCount = originalWords.filter(w => allText.includes(w)).length;
  const matchRatio = originalWords.length > 0 ? matchCount / originalWords.length : 0;

  if (matchRatio > 0.5) {
    // The crawl contains words similar to what the AI detected → misleading data
    return 'misleading_data';
  }

  // If the corrected value IS in the crawl but AI missed it → training bias
  // If neither is present → absent data
  return 'training_bias';
}

function findSourcePagesForField(
  field: string,
  originalValue: string,
  crawlData: CrawlSnapshot | null
): Array<{ url: string; title: string; element: string; excerpt: string }> {
  if (!crawlData || !originalValue) return [];

  const searchTerms = originalValue.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (searchTerms.length === 0) return [];

  const results: Array<{ url: string; title: string; element: string; excerpt: string }> = [];

  for (const page of crawlData.pages) {
    // Check each element for matches
    const elements: Array<{ name: string; text: string }> = [
      { name: 'title', text: page.title },
      { name: 'h1', text: page.h1 },
      { name: 'meta_description', text: page.metaDescription },
      { name: 'body_content', text: page.bodyExcerpt || '' },
      { name: 'schema_org', text: page.schemaTypes.join(', ') },
    ];

    for (const el of elements) {
      if (!el.text) continue;
      const elLower = el.text.toLowerCase();
      const matchCount = searchTerms.filter(t => elLower.includes(t)).length;
      if (matchCount > 0 && matchCount / searchTerms.length > 0.3) {
        results.push({
          url: page.url,
          title: page.title,
          element: el.name,
          excerpt: el.text.slice(0, 200),
        });
        break; // One match per page is enough
      }
    }

    if (results.length >= 3) break; // Cap at 3 source pages
  }

  return results;
}
