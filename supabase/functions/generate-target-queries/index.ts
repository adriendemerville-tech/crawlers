import { trackTokenUsage } from '../_shared/tokenTracker.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
interface StrategicContext {
  coreBusiness?: string;
  marketLeader?: string;
  sector?: string;
  brandName?: string;
  competitors?: string[];
  keywordThemes?: string[];
  brandIdentity?: string;
  targetAudience?: string;
}

function buildStrategicContext(strategicAnalysis: any): StrategicContext {
  const ctx: StrategicContext = {};

  // Extract from brand_authority
  if (strategicAnalysis?.brand_authority) {
    ctx.brandIdentity = strategicAnalysis.brand_authority.dna_analysis;
  }

  // Extract from competitive_landscape
  if (strategicAnalysis?.competitive_landscape) {
    const cl = strategicAnalysis.competitive_landscape;
    ctx.competitors = [
      cl.leader?.name,
      cl.direct_competitor?.name,
      cl.challenger?.name,
    ].filter(Boolean);
    if (cl.leader?.name) ctx.marketLeader = cl.leader.name;
  }

  // Extract from market_intelligence
  if (strategicAnalysis?.market_intelligence) {
    ctx.sector = strategicAnalysis.market_intelligence.positioning_verdict;
    if (strategicAnalysis.market_intelligence.semantic_gap?.priority_themes) {
      ctx.keywordThemes = strategicAnalysis.market_intelligence.semantic_gap.priority_themes;
    }
  }

  // Extract from keyword_positioning
  if (strategicAnalysis?.keyword_positioning) {
    const kp = strategicAnalysis.keyword_positioning;
    if (kp.main_keywords?.length) {
      ctx.keywordThemes = [
        ...(ctx.keywordThemes || []),
        ...kp.main_keywords.slice(0, 5).map((k: any) => k.keyword),
      ];
    }
  }

  // Extract from introduction
  if (strategicAnalysis?.introduction) {
    ctx.coreBusiness = strategicAnalysis.introduction.presentation;
    ctx.targetAudience = strategicAnalysis.introduction.strengths;
  }

  // Extract from hallucination corrections
  if (strategicAnalysis?.hallucinationCorrections) {
    const hc = strategicAnalysis.hallucinationCorrections;
    if (hc.sector) ctx.sector = hc.sector;
    if (hc.mainProducts) ctx.coreBusiness = hc.mainProducts;
    if (hc.targetAudience) ctx.targetAudience = hc.targetAudience;
  }

  return ctx;
}

/**
 * Humanise un slug de domaine en nom d'entreprise lisible.
 */
function humanizeBrandName(slug: string): string {
  if (!slug || slug.length < 3) return slug;
  if (slug.includes('-') || slug.includes(' ')) {
    return slug.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  const lower = slug.toLowerCase();
  const particles: [string, string][] = [
    ['lextreme', "l'Extrême"], ['lexpert', "l'Expert"], ['lexpress', "l'Express"],
    ['lentreprise', "l'Entreprise"], ['limmobilier', "l'Immobilier"], ['latelier', "l'Atelier"],
    ['lagence', "l'Agence"], ['letoile', "l'Étoile"], ['lespace', "l'Espace"], ['lequipe', "l'Équipe"],
    ['dessous', 'Dessous'], ['depuis', 'Depuis'], ['entre', 'Entre'], ['notre', 'Notre'],
    ['votre', 'Votre'], ['chez', 'Chez'], ['pour', 'Pour'], ['avec', 'Avec'], ['dans', 'Dans'],
    ['sans', 'Sans'], ['sous', 'Sous'], ['plus', 'Plus'], ['tres', 'Très'], ['tout', 'Tout'],
    ['les', 'Les'], ['des', 'des'], ['aux', 'aux'], ['sur', 'sur'], ['par', 'par'],
    ['mes', 'Mes'], ['nos', 'Nos'], ['une', 'une'], ['la', 'la'], ['le', 'le'],
    ['du', 'du'], ['de', 'de'], ['et', 'et'], ['en', 'en'], ['un', 'un'], ['au', 'au'],
  ];
  const vowels = 'aeiouyéèêëàâäùûüôîï';
  const words: string[] = [];
  let pos = 0;
  while (pos < lower.length) {
    let matched = false;
    if (lower[pos] === 'l' && pos + 1 < lower.length && vowels.includes(lower[pos + 1])) {
      for (const [pat, rep] of particles) {
        if (lower.startsWith(pat, pos) && pat.startsWith('l')) {
          words.push(rep); pos += pat.length; matched = true; break;
        }
      }
      if (!matched) {
        let endPos = lower.length;
        for (let i = pos + 2; i < lower.length; i++) {
          for (const [pat] of particles) { if (lower.startsWith(pat, i)) { endPos = i; break; } }
          if (endPos !== lower.length) break;
        }
        const word = lower.substring(pos + 1, endPos);
        if (word.length > 0) { words.push("l'" + word.charAt(0).toUpperCase() + word.slice(1)); pos = endPos; matched = true; }
      }
    }
    if (!matched) {
      for (const [pat, rep] of particles) {
        if (lower.startsWith(pat, pos)) {
          // Heuristique anti-préfixe : particule courte (≤3 chars) → vérifier
          // que le reste contient d'autres particules, sinon c'est un préfixe (dé-, re-, etc.)
          if (pat.length <= 3) {
            const remaining = lower.substring(pos + pat.length);
            const hasMoreParticles = particles.some(([p]) => {
              const idx = remaining.indexOf(p);
              return idx > 0 && idx < remaining.length;
            });
            if (!hasMoreParticles && remaining.length > 3) continue;
          }
          words.push(rep); pos += pat.length; matched = true; break;
        }
      }
    }
    if (!matched) {
      let endPos = lower.length;
      for (let i = pos + 1; i < lower.length; i++) {
        if (lower[i] === 'l' && i + 1 < lower.length && vowels.includes(lower[i + 1])) { endPos = i; break; }
        for (const [pat] of particles) { if (lower.startsWith(pat, i)) { endPos = i; break; } }
        if (endPos !== lower.length) break;
      }
      const word = lower.substring(pos, endPos);
      if (word.length > 0) words.push(word.charAt(0).toUpperCase() + word.slice(1));
      pos = endPos;
    }
  }
  if (words.length <= 1) return slug.charAt(0).toUpperCase() + slug.slice(1);
  let result = words.join(' ');
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result.replace(/\s+/g, ' ').trim();
}

function sanitizeBrandSlugInObject(obj: any, slug: string, humanName: string): any {
  if (!obj || !slug || !humanName || slug === humanName) return obj;
  const regex = new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  function walk(node: any): any {
    if (typeof node === 'string') return node.replace(regex, humanName);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(node)) { out[k] = walk(v); }
      return out;
    }
    return node;
  }
  return walk(obj);
}

/**
 * Fetch real metadata from the target site to ground the AI's understanding.
 */
async function fetchSiteMetadata(domain: string): Promise<{ title: string; description: string; ogSiteName: string; h1: string }> {
  const fallback = { title: '', description: '', ogSiteName: '', h1: '' };
  try {
    const url = `https://${domain}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersBot/1.0)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return fallback;
    const html = await res.text();
    const slice = html.substring(0, 30000); // only need head + early body

    const titleMatch = slice.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = slice.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
      || slice.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
    const ogNameMatch = slice.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([\s\S]*?)["']/i)
      || slice.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:site_name["']/i);
    const h1Match = slice.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

    return {
      title: titleMatch?.[1]?.trim().substring(0, 200) || '',
      description: descMatch?.[1]?.trim().substring(0, 300) || '',
      ogSiteName: ogNameMatch?.[1]?.trim().substring(0, 100) || '',
      h1: h1Match?.[1]?.replace(/<[^>]+>/g, '').trim().substring(0, 200) || '',
    };
  } catch {
    return fallback;
  }
}

function buildValidationPrompt(queries: any[], strategicCtx: StrategicContext, brand: string, lang: string): string {
  const langInstructions: Record<string, string> = {
    fr: `Réponds UNIQUEMENT en français.`,
    en: `Respond ONLY in English.`,
    es: `Responde ÚNICAMENTE en español.`,
  };

  return `Tu es un expert en contrôle qualité GEO. Ton rôle est de détecter les incohérences dans des requêtes cibles générées par IA.

**Marque :** ${brand}
**Core Business vérifié :** ${strategicCtx.coreBusiness || 'Non disponible'}
**Secteur vérifié :** ${strategicCtx.sector || 'Non disponible'}
**Leader du marché vérifié :** ${strategicCtx.marketLeader || 'Non disponible'}
**Concurrents identifiés :** ${strategicCtx.competitors?.join(', ') || 'Non disponible'}
**Thèmes clés du marché :** ${strategicCtx.keywordThemes?.join(', ') || 'Non disponible'}
**Audience cible :** ${strategicCtx.targetAudience || 'Non disponible'}
**Identité de marque :** ${strategicCtx.brandIdentity || 'Non disponible'}

**Requêtes générées à vérifier :**
${JSON.stringify(queries, null, 2)}

**INSTRUCTIONS :**
1. Compare chaque requête avec le contexte stratégique vérifié ci-dessus
2. Détecte les incohérences : mauvais secteur, mauvais type de produit, concurrents inventés, requêtes hors sujet
3. Si une requête est incohérente, corrige-la pour qu'elle soit alignée avec le contexte stratégique réel
4. Le coreBusiness et marketLeader retournés doivent correspondre exactement au contexte stratégique vérifié
5. Si tout est cohérent, retourne les requêtes telles quelles

${langInstructions[lang] || langInstructions.fr}

Réponds au format JSON exact suivant :
{
  "coreBusiness": "le core business VÉRIFIÉ (aligné avec le contexte stratégique)",
  "marketLeader": "le leader du marché VÉRIFIÉ",
  "queries": [
    {
      "query": "requête corrigée ou identique si cohérente",
      "intent": "explication stratégique",
      "priority": "high" ou "medium",
      "mentionsBrand": false
    }
  ],
  "coherenceCheck": {
    "passed": true/false,
    "corrections": ["description de chaque correction effectuée"],
    "hallucinationSignals": ["description de chaque signal d'hallucination détecté"]
  }
}`;
}

Deno.serve(handleRequest(async (req) => {
try {
    const { domain, coreValueSummary, citations, lang = 'fr', strategicAnalysis } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build strategic context for validation
    const strategicCtx = strategicAnalysis ? buildStrategicContext(strategicAnalysis) : null;

    // Fetch real site metadata to ground the AI's understanding
    const siteMeta = await fetchSiteMetadata(domain);
    console.log(`📄 Site metadata for ${domain}: title="${siteMeta.title}", og:site_name="${siteMeta.ogSiteName}", h1="${siteMeta.h1}"`);

    // Build context from citations
    const citationContext = (citations || [])
      .filter((c: any) => c.cited && c.summary)
      .map((c: any) => `${c.provider?.name}: ${c.summary}`)
      .join('\n');

    const brand = domain.replace(/\.(com|fr|net|org|io|co|app|dev).*$/i, '').replace(/^www\./, '');

    const langInstructions: Record<string, string> = {
      fr: `Réponds UNIQUEMENT en français. Les requêtes doivent être formulées comme un utilisateur français les taperait.`,
      en: `Respond ONLY in English. Queries should be formulated as an English-speaking user would type them.`,
      es: `Responde ÚNICAMENTE en español. Las consultas deben formularse como las escribiría un usuario hispanohablante.`,
    };

    // Inject strategic context into the generation prompt if available
    const strategicContextBlock = strategicCtx ? `
**CONTEXTE STRATÉGIQUE VÉRIFIÉ (prioritaire — ne pas contredire) :**
- Core Business : ${strategicCtx.coreBusiness || 'Non disponible'}
- Secteur : ${strategicCtx.sector || 'Non disponible'}
- Leader du marché : ${strategicCtx.marketLeader || 'Non disponible'}
- Concurrents : ${strategicCtx.competitors?.join(', ') || 'Non disponible'}
- Thèmes clés : ${strategicCtx.keywordThemes?.join(', ') || 'Non disponible'}
- Audience cible : ${strategicCtx.targetAudience || 'Non disponible'}
` : '';

    const humanBrandName = humanizeBrandName(brand);
    console.log(`🏷️ Brand humanisé: "${brand}" → "${humanBrandName}"`);

    const brandNameInstruction = brand !== humanBrandName ? `
⚠️ NOM DE L'ENTREPRISE: Le slug du domaine est "${brand}" mais le vrai nom est "${humanBrandName}".
Utilise TOUJOURS "${humanBrandName}" dans les requêtes et textes, JAMAIS le slug "${brand}".
` : '';

    // Build real site metadata block for grounding
    const siteMetaBlock = (siteMeta.title || siteMeta.description || siteMeta.h1) ? `
**MÉTADONNÉES RÉELLES DU SITE (SOURCE DE VÉRITÉ pour le core business — PRIORITAIRE sur toute autre hypothèse) :**
${siteMeta.ogSiteName ? `- Nom du site (og:site_name) : ${siteMeta.ogSiteName}` : ''}
${siteMeta.title ? `- Title : ${siteMeta.title}` : ''}
${siteMeta.description ? `- Meta description : ${siteMeta.description}` : ''}
${siteMeta.h1 ? `- H1 principal : ${siteMeta.h1}` : ''}
` : '';

    const prompt = `Tu es un expert en GEO (Generative Engine Optimization). 

Analyse ce site web et génère 5 requêtes stratégiques à cibler pour maximiser les recommandations par les LLMs.
${brandNameInstruction}
**Site cible :** ${domain}
**Marque :** ${humanBrandName}
${siteMetaBlock}
**Synthèse des perceptions LLM :** ${coreValueSummary || 'Non disponible'}
**Détails des citations LLM :**
${citationContext || 'Aucune citation disponible'}
${strategicContextBlock}
**RÈGLES CRITIQUES :**
1. D'abord, déduis le CORE BUSINESS / produit phare / secteur de marché du site cible EN TE BASANT PRINCIPALEMENT sur les MÉTADONNÉES RÉELLES DU SITE ci-dessus (title, meta description, H1). Ces données sont factuelles et prioritaires. Ne te fie PAS aux synthèses LLM qui peuvent contenir des hallucinations.
2. Identifie le LEADER DU MARCHÉ dans ce secteur (le concurrent dominant)
3. Génère 5 requêtes qui mesurent le paramètre "recommandation" des LLMs :
   - 4 requêtes doivent interroger LE MARCHÉ sans mentionner la marque "${humanBrandName}" (ex: "quel est le meilleur outil pour [secteur]", "meilleure alternative à [leader du marché]", "comparatif [type de produit] [année]")
   - 1 seule requête peut mentionner explicitement "${humanBrandName}"
4. Les requêtes doivent être des questions qu'un prospect réel poserait à un LLM
5. Chaque requête doit avoir un "intent" expliquant POURQUOI cette requête est stratégique pour la citabilité
${strategicCtx ? '6. Les requêtes DOIVENT être cohérentes avec le CONTEXTE STRATÉGIQUE VÉRIFIÉ ci-dessus. Ne pas inventer un secteur ou des concurrents différents.' : ''}

${langInstructions[lang] || langInstructions.fr}

Réponds au format JSON exact suivant, sans texte avant ou après :
{
  "coreBusiness": "description courte du core business détecté (basée sur les métadonnées réelles du site)",
  "marketLeader": "nom du leader de marché identifié",
  "queries": [
    {
      "query": "la requête à tester",
      "intent": "explication stratégique (1 phrase)",
      "priority": "high" ou "medium",
      "mentionsBrand": false
    }
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a GEO (Generative Engine Optimization) expert. Always return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment required' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    // Track token usage
    trackTokenUsage('generate-target-queries', 'google/gemini-2.5-flash', aiData.usage, domain);

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = content.substring(firstBrace, lastBrace + 1);
      }
    }

    // Clean trailing commas
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

    let parsed = JSON.parse(jsonStr.trim());

    // Sanitize: replace domain slug with humanized brand name in all text fields
    parsed = sanitizeBrandSlugInObject(parsed, brand, humanBrandName);

    // ===== COHERENCE VALIDATION PASS =====
    // If we have strategic context, run a second AI call to cross-validate
    if (strategicCtx && parsed.queries?.length > 0) {
      const needsValidation = detectObviousInconsistencies(parsed, strategicCtx, brand);
      
      if (needsValidation) {
        console.log(`[CoherenceCheck] Inconsistencies detected for ${domain}, running validation pass...`);
        
        const validationPrompt = buildValidationPrompt(parsed.queries, strategicCtx, brand, lang);
        
        const validationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a quality control expert for GEO queries. Always return valid JSON only. Be strict about coherence.' },
              { role: 'user', content: validationPrompt },
            ],
            temperature: 0.2,
            max_tokens: 1500,
          }),
        });

        if (validationResponse.ok) {
          const validationData = await validationResponse.json();
          const validationContent = validationData.choices?.[0]?.message?.content;

          if (validationContent) {
            try {
              let valJsonStr = validationContent;
              const valMatch = validationContent.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (valMatch) {
                valJsonStr = valMatch[1];
              } else {
                const fb = validationContent.indexOf('{');
                const lb = validationContent.lastIndexOf('}');
                if (fb !== -1 && lb !== -1 && lb > fb) {
                  valJsonStr = validationContent.substring(fb, lb + 1);
                }
              }
              valJsonStr = valJsonStr.replace(/,\s*([}\]])/g, '$1');
              const validated = JSON.parse(valJsonStr.trim());

              if (validated.queries?.length > 0) {
                const coherenceCheck = validated.coherenceCheck || { passed: true, corrections: [], hallucinationSignals: [] };
                
                if (!coherenceCheck.passed) {
                  console.log(`[CoherenceCheck] Corrections applied: ${JSON.stringify(coherenceCheck.corrections)}`);
                  console.log(`[CoherenceCheck] Hallucination signals: ${JSON.stringify(coherenceCheck.hallucinationSignals)}`);
                }

                // Use the validated/corrected version
                parsed = {
                  coreBusiness: validated.coreBusiness || parsed.coreBusiness,
                  marketLeader: validated.marketLeader || parsed.marketLeader,
                  queries: validated.queries,
                  coherenceCheck,
                };
              }
            } catch (parseErr) {
              console.error('[CoherenceCheck] Failed to parse validation response, using original:', parseErr);
            }
          }
        } else {
          console.warn('[CoherenceCheck] Validation call failed, using original queries');
        }
      } else {
        console.log(`[CoherenceCheck] No obvious inconsistencies for ${domain}, skipping validation`);
        parsed.coherenceCheck = { passed: true, corrections: [], hallucinationSignals: [] };
      }
    }

    console.log(`Generated ${parsed.queries?.length || 0} target queries for ${domain}. Core: ${parsed.coreBusiness}`);

    return jsonOk({ success: true, data: parsed });
  } catch (error) {
    console.error('Error generating target queries:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate queries' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));

/**
 * Quick heuristic check: does the generated output seem inconsistent with strategic context?
 */
function detectObviousInconsistencies(generated: any, ctx: StrategicContext, brand: string): boolean {
  // If we have a verified core business and the generated one is very different
  if (ctx.coreBusiness && generated.coreBusiness) {
    const ctxWords = new Set(ctx.coreBusiness.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
    const genWords = new Set(generated.coreBusiness.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
    const overlap = [...ctxWords].filter(w => genWords.has(w)).length;
    const maxSize = Math.max(ctxWords.size, genWords.size);
    if (maxSize > 0 && overlap / maxSize < 0.15) {
      console.log(`[CoherenceCheck] Core business mismatch: ctx="${ctx.coreBusiness}" vs gen="${generated.coreBusiness}"`);
      return true;
    }
  }

  // If market leader is known and generated is completely different
  if (ctx.marketLeader && generated.marketLeader) {
    const ctxLeader = ctx.marketLeader.toLowerCase().trim();
    const genLeader = generated.marketLeader.toLowerCase().trim();
    if (ctxLeader !== genLeader && !ctxLeader.includes(genLeader) && !genLeader.includes(ctxLeader)) {
      console.log(`[CoherenceCheck] Market leader mismatch: ctx="${ctx.marketLeader}" vs gen="${generated.marketLeader}"`);
      return true;
    }
  }

  // Check if queries reference competitors not in the known list
  if (ctx.competitors?.length) {
    const knownCompetitors = ctx.competitors.map(c => c.toLowerCase());
    for (const q of generated.queries || []) {
      const queryLower = q.query.toLowerCase();
      // Check if query mentions a specific brand that isn't the brand or a known competitor
      for (const word of queryLower.split(/\s+/)) {
        if (word.length > 4 && word !== brand.toLowerCase() && 
            !knownCompetitors.some(c => c.includes(word) || word.includes(c))) {
          // This could be a hallucinated competitor — flag for review but don't auto-trigger
        }
      }
    }
  }

  // If keyword themes exist, check at least some queries relate to them
  if (ctx.keywordThemes?.length && generated.queries?.length) {
    const themes = ctx.keywordThemes.map(t => t.toLowerCase());
    const queriesText = generated.queries.map((q: any) => q.query.toLowerCase()).join(' ');
    const themeMatches = themes.filter(t => {
      const words = t.split(/\s+/).filter((w: string) => w.length > 3);
      return words.some(w => queriesText.includes(w));
    }));
    if (themeMatches.length === 0 && themes.length >= 3) {
      console.log(`[CoherenceCheck] No keyword theme match found in queries`);
      return true;
    }
  }

  return false;
}