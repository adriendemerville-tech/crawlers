import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts';
import { trackTokenUsage } from '../_shared/tokenTracker.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * process-script-queue — Sequential worker for AI-generated multi-page script payloads
 * 
 * Picks up site_script_rules with generation_status='pending', generates AI content
 * for each rule sequentially (to avoid rate limiting), and updates the payload_data.
 * 
 * Supports self-reinvocation for large batches.
 */

const BATCH_SIZE = 5;
const WATCHDOG_MS = 240_000; // 4 minutes safety margin

Deno.serve(handleRequest(async (req) => {
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const supabase = getServiceClient();
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const domainFilter = body.domain_id || null;

    // Pick up pending rules, oldest first
    let query = supabase
      .from('site_script_rules')
      .select('id, domain_id, user_id, url_pattern, payload_type, payload_data, generation_status')
      .eq('generation_status', 'pending')
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (domainFilter) {
      query = query.eq('domain_id', domainFilter);
    }

    const { data: pendingRules, error: fetchErr } = await query;

    if (fetchErr) {
      console.error('[process-script-queue] Fetch error:', fetchErr);
      return new Response(JSON.stringify({ success: false, error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingRules || pendingRules.length === 0) {
      return jsonOk({ success: true, processed: 0, message: 'Queue empty' });
    }

    console.log(`[process-script-queue] Processing ${pendingRules.length} pending rules`);

    let processed = 0;
    let errors = 0;

    for (const rule of pendingRules) {
      // Watchdog: stop before timeout
      if (Date.now() - startTime > WATCHDOG_MS) {
        console.log(`[process-script-queue] Watchdog triggered after ${processed} rules — self-reinvoking`);
        break;
      }

      // Mark as processing
      await supabase
        .from('site_script_rules')
        .update({ generation_status: 'processing' } as any)
        .eq('id', rule.id);

      try {
        const generatedPayload = await generatePayloadForRule(rule, supabase, LOVABLE_API_KEY);

        if (generatedPayload) {
          await supabase
            .from('site_script_rules')
            .update({
              payload_data: generatedPayload,
              generation_status: 'done',
              generated_at: new Date().toISOString(),
              generation_error: null,
            } as any)
            .eq('id', rule.id);
          processed++;
        } else {
          // No AI needed or payload already complete
          await supabase
            .from('site_script_rules')
            .update({
              generation_status: 'ready',
              generated_at: new Date().toISOString(),
            } as any)
            .eq('id', rule.id);
          processed++;
        }
      } catch (err) {
        console.error(`[process-script-queue] Error processing rule ${rule.id}:`, err);
        await supabase
          .from('site_script_rules')
          .update({
            generation_status: 'error',
            generation_error: err instanceof Error ? err.message : 'Unknown error',
          } as any)
          .eq('id', rule.id);
        errors++;
      }

      // Rate limiting pause between AI calls (1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Check if more pending rules exist → self-reinvoke
    const { count: remaining } = await supabase
      .from('site_script_rules')
      .select('id', { count: 'exact', head: true })
      .eq('generation_status', 'pending');

    if (remaining && remaining > 0) {
      console.log(`[process-script-queue] ${remaining} rules remaining — self-reinvoking`);
      fetch(`${supabaseUrl}/functions/v1/process-script-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain_id: domainFilter }),
      }).catch(() => {});
    }

    return jsonOk({
      success: true,
      processed,
      errors,
      remaining: remaining || 0,
    });

  } catch (error) {
    console.error('[process-script-queue] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ══════════════════════════════════════════════════════════════
// AI PAYLOAD GENERATION PER RULE TYPE
// ══════════════════════════════════════════════════════════════

// ── Intent-aware prompt strategies ──
const INTENT_STRATEGIES: Record<string, { focus: string; schemaHint: string; tone: string }> = {
  transactional: {
    focus: 'conversion, appels à l\'action, prix, offres, garanties, avis clients',
    schemaHint: 'Product, Offer, AggregateRating',
    tone: 'persuasif et orienté action',
  },
  commercial: {
    focus: 'comparaison, avantages concurrentiels, témoignages, études de cas, ROI',
    schemaHint: 'Product, Review, AggregateRating',
    tone: 'expert et rassurant',
  },
  informational: {
    focus: 'éducation, expertise E-E-A-T, définitions, guides, données factuelles',
    schemaHint: 'Article, HowTo, FAQPage',
    tone: 'pédagogique et autoritaire',
  },
  navigational: {
    focus: 'identité de marque, coordonnées, structure du site, maillage interne',
    schemaHint: 'Organization, WebSite, BreadcrumbList',
    tone: 'clair et structuré',
  },
};

function getIntentStrategy(intent: string) {
  return INTENT_STRATEGIES[intent] || INTENT_STRATEGIES.informational;
}

async function generatePayloadForRule(
  rule: {
    id: string;
    domain_id: string;
    url_pattern: string;
    payload_type: string;
    payload_data: Record<string, any>;
  },
  supabase: ReturnType<typeof createClient>,
  lovableApiKey: string | undefined
): Promise<Record<string, any> | null> {
  const payloadType = rule.payload_type;
  const existingData = rule.payload_data || {};
  const pageIntent = (existingData._intent as string) || 'informational';

  // Static payload types don't need AI generation
  const STATIC_TYPES = ['BreadcrumbList', 'GLOBAL_FIXES'];
  if (STATIC_TYPES.includes(payloadType)) return null;

  // If payload_data already has substantial content, skip
  if (existingData['@type'] && Object.keys(existingData).length > 3) return null;

  // Get domain context
  const { data: site } = await supabase
    .from('tracked_sites')
    .select('domain, current_config')
    .eq('id', rule.domain_id)
    .single();

  if (!site) {
    throw new Error(`Site not found for domain_id ${rule.domain_id}`);
  }

  const domain = site.domain;
  const siteConfig = (site.current_config as Record<string, any>) || {};
  const siteName = siteConfig.site_name || domain;
  const strategy = getIntentStrategy(pageIntent);

  // Generate payload based on type + intent
  switch (payloadType) {
    case 'FAQPage':
      return await generateFAQPayload(domain, siteName, rule.url_pattern, lovableApiKey, strategy, pageIntent);
    case 'Organization':
      return generateOrganizationPayload(domain, siteName, existingData);
    case 'LocalBusiness':
      return generateLocalBusinessPayload(domain, siteName, existingData);
    case 'Article':
      return generateArticlePayload(domain, siteName, rule.url_pattern);
    case 'Product':
      return generateProductPayload(domain, siteName, existingData);
    case 'HTML_INJECTION':
      return await generateHTMLPayload(domain, siteName, rule.url_pattern, existingData, lovableApiKey, strategy, pageIntent);
    default:
      return null;
  }
}

// ── FAQ Generation (AI) ──
async function generateFAQPayload(
  domain: string,
  siteName: string,
  urlPattern: string,
  apiKey: string | undefined,
  strategy: { focus: string; schemaHint: string; tone: string },
  intent: string
): Promise<Record<string, any>> {
  if (!apiKey) {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `Qu'est-ce que ${siteName} ?`,
          acceptedAnswer: { '@type': 'Answer', text: `${siteName} est un service disponible sur ${domain}.` },
        },
      ],
    };
  }

  try {
    const section = urlPattern.replace('/*', '').replace('GLOBAL', '/');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Tu génères des FAQ SEO Schema.org pour des sites web. L'intent de cette page est "${intent}". Adapte le ton (${strategy.tone}) et les sujets abordés (${strategy.focus}). Réponds UNIQUEMENT en JSON valide, sans markdown.`,
          },
          {
            role: 'user',
            content: `Génère une FAQPage JSON-LD avec 3-5 questions pertinentes pour la section "${section}" du site "${siteName}" (${domain}). Intent: ${intent} → les questions doivent être orientées ${strategy.focus}. Format: {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"...","acceptedAnswer":{"@type":"Answer","text":"..."}}]}`,
          },
        ],
        temperature: 0.6,
      }),
    });

    if (!response.ok) throw new Error(`AI API error: ${response.status}`);
    const data = await response.json();
    trackTokenUsage('process-script-queue', 'google/gemini-2.5-flash', data.usage);

    let content = data.choices?.[0]?.message?.content || '';
    if (content.includes('```')) {
      content = content.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
    }
    content = content.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    return JSON.parse(content);
  } catch (err) {
    console.error('[process-script-queue] FAQ AI error:', err);
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `Qu'est-ce que ${siteName} ?`,
          acceptedAnswer: { '@type': 'Answer', text: `${siteName} est un service professionnel disponible sur ${domain}.` },
        },
      ],
    };
  }
}

// ── Organization (template) ──
function generateOrganizationPayload(domain: string, siteName: string, existing: Record<string, any>): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: existing.name || siteName,
    url: `https://${domain}`,
    logo: existing.logo || `https://${domain}/logo.png`,
    description: existing.description || `${siteName} - Site officiel`,
    sameAs: existing.sameAs || [],
  };
}

// ── LocalBusiness (template) ──
function generateLocalBusinessPayload(domain: string, siteName: string, existing: Record<string, any>): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: existing.name || siteName,
    url: `https://${domain}`,
    address: existing.address || { '@type': 'PostalAddress', addressCountry: 'FR' },
    telephone: existing.telephone || '',
    openingHours: existing.openingHours || 'Mo-Fr 09:00-18:00',
  };
}

// ── Article (template) ──
function generateArticlePayload(domain: string, siteName: string, urlPattern: string): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: `https://${domain}`,
    },
    author: { '@type': 'Organization', name: siteName },
    datePublished: new Date().toISOString().split('T')[0],
    dateModified: new Date().toISOString().split('T')[0],
  };
}

// ── Product (template) ──
function generateProductPayload(domain: string, siteName: string, existing: Record<string, any>): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: existing.name || `Produit ${siteName}`,
    brand: { '@type': 'Brand', name: siteName },
    url: `https://${domain}`,
    offers: existing.offers || { '@type': 'Offer', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
  };
}

// ── HTML Injection (AI) ──
async function generateHTMLPayload(
  domain: string,
  siteName: string,
  urlPattern: string,
  existing: Record<string, any>,
  apiKey: string | undefined,
  strategy: { focus: string; schemaHint: string; tone: string },
  intent: string
): Promise<Record<string, any>> {
  // If HTML is already provided, keep it
  if (existing.html && existing.html.length > 50) return existing;

  if (!apiKey) {
    return {
      html: `<section data-crawlers="injected"><h2>${siteName}</h2><p>Contenu optimisé pour ${domain}</p></section>`,
      targetSelector: existing.targetSelector || 'footer',
      insertPosition: existing.insertPosition || 'before',
    };
  }

  try {
    const section = urlPattern.replace('/*', '').replace('GLOBAL', '/');

    // Intent-specific HTML generation instructions
    const intentInstructions: Record<string, string> = {
      transactional: `Génère un bloc HTML orienté CONVERSION : avantages produit/service, CTA clair, éléments de réassurance (garantie, livraison, avis). Inclus des micro-données ${strategy.schemaHint} si pertinent.`,
      commercial: `Génère un bloc HTML orienté DÉCISION : comparatif, bénéfices clés, témoignages clients, chiffres clés. Ton ${strategy.tone}.`,
      informational: `Génère un bloc HTML orienté EXPERTISE : contenu éducatif, définitions, données factuelles, citations de sources. Renforce l'E-E-A-T et la citabilité LLM.`,
      navigational: `Génère un bloc HTML orienté NAVIGATION : présentation claire de l'entité, coordonnées, liens structurels, identité de marque.`,
    };

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Tu génères des blocs HTML SEO-optimisés pour injection dans des pages web. L'intent de cette page est "${intent}". Adapte le contenu en conséquence : ${strategy.focus}. Code HTML sémantique uniquement, pas de JS ni CSS inline complexe. Réponds UNIQUEMENT avec le HTML brut.`,
          },
          {
            role: 'user',
            content: `${intentInstructions[intent] || intentInstructions.informational} Section "${section}" du site "${siteName}" (${domain}). ~100-200 mots, h2 + 2-3 paragraphes. Pas de markdown, juste du HTML.`,
          },
        ],
        temperature: 0.6,
      }),
    }));

    if (!response.ok) throw new Error(`AI API error: ${response.status}`);
    const data = await response.json();
    trackTokenUsage('process-script-queue', 'google/gemini-2.5-flash', data.usage);

    let html = data.choices?.[0]?.message?.content || '';
    if (html.includes('```')) {
      html = html.replace(/```(?:html)?\n?/g, '').replace(/```/g, '').trim();
    }

    return {
      html,
      targetSelector: existing.targetSelector || 'footer',
      insertPosition: existing.insertPosition || 'before',
      _intent: intent,
    };
  } catch (err) {
    console.error('[process-script-queue] HTML AI error:', err);
    return {
      html: `<section data-crawlers="injected"><h2>${siteName}</h2><p>Contenu optimisé pour ${domain}</p></section>`,
      targetSelector: existing.targetSelector || 'footer',
      insertPosition: existing.insertPosition || 'before',
    };
  }
}