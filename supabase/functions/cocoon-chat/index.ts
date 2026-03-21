import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logSilentError } from "../_shared/silentErrorLogger.ts";
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts';
import { checkIpRate, getClientIp, rateLimitResponse } from '../_shared/ipRateLimiter.ts';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── IP rate limit ──
  const ip = getClientIp(req);
  const ipCheck = checkIpRate(ip, "cocoon-chat", 20, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  try {
    // ── Fair use check ──
    const userCtx = await getUserContext(req);
    if (userCtx) {
      const fairUse = await checkFairUse(userCtx.userId, 'cocoon_chat', userCtx.planType);
      if (!fairUse.allowed) {
        return new Response(JSON.stringify({ error: fairUse.reason }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { messages, context, analysisMode, language, domain, trackedSiteId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = getServiceClient();

    // ── Fetch site identity card ──
    let siteIdentityBlock = '';
    try {
      if (domain || trackedSiteId) {
        const ctx = await getSiteContext(supabase, trackedSiteId ? { trackedSiteId } : { domain });
        if (ctx) {
          const parts: string[] = [];
          if (ctx.market_sector) parts.push(`Secteur: ${ctx.market_sector}`);
          if (ctx.products_services) parts.push(`Produits/Services: ${ctx.products_services}`);
          if (ctx.target_audience) parts.push(`Cible: ${ctx.target_audience}`);
          if (ctx.commercial_area) parts.push(`Zone commerciale: ${ctx.commercial_area}`);
          if (parts.length > 0) siteIdentityBlock = `\n\nCarte d'identité du site (fiabilité: ${ctx.identity_confidence || 0}/100) :\n${parts.join('\n')}`;
          console.log(`[cocoon-chat] Site context loaded (confidence: ${ctx.identity_confidence || 0})`);
        }
      }
    } catch (e) {
      console.warn('[cocoon-chat] Could not fetch site context:', e);
    }

    // ── Fetch all domain-related data ──
    let domainDataBlock = '';
    try {
      const normalizedDomain = (domain || '')
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '')
        .toLowerCase();

      if (normalizedDomain && trackedSiteId) {
        // Parallel fetch all relevant data
        const [
          crawlRes,
          crawlPagesRes,
          auditRes,
          serpRes,
          backlinkRes,
          gscRes,
          ga4Res,
          indexHistoryRes,
        ] = await Promise.all([
          // Latest crawl
          supabase
            .from('site_crawls')
            .select('id, domain, status, total_pages, crawled_pages, avg_score, ai_summary, created_at, completed_at')
            .eq('domain', normalizedDomain)
            .order('created_at', { ascending: false })
            .limit(3),
          // Crawl pages from latest crawl (summary only)
          supabase
            .from('site_crawls')
            .select('id')
            .eq('domain', normalizedDomain)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .then(async ({ data }) => {
              if (!data?.[0]?.id) return { data: null };
              const { data: pages } = await supabase
                .from('crawl_pages')
                .select('url, title, seo_score, word_count, internal_links, external_links, h1, has_noindex, is_indexable, crawl_depth, page_type_override, issues')
                .eq('crawl_id', data[0].id)
                .order('seo_score', { ascending: true })
                .limit(50);
              return { data: pages };
            }),
          // Audit raw data (latest)
          supabase
            .from('audit_raw_data')
            .select('audit_type, created_at')
            .eq('domain', normalizedDomain)
            .order('created_at', { ascending: false })
            .limit(5),
          // SERP KPIs (latest snapshot)
          supabase
            .from('domain_data_cache')
            .select('data_type, result_data, created_at')
            .eq('domain', normalizedDomain)
            .in('data_type', ['serp_kpis', 'keyword_rankings'])
            .order('created_at', { ascending: false })
            .limit(2),
          // Backlink snapshot (latest)
          supabase
            .from('backlink_snapshots')
            .select('referring_domains, backlinks_total, domain_rank, referring_domains_new, referring_domains_lost, measured_at')
            .eq('tracked_site_id', trackedSiteId)
            .order('measured_at', { ascending: false })
            .limit(1),
          // GSC history (latest)
          supabase
            .from('gsc_history_log')
            .select('clicks, impressions, ctr, avg_position, top_queries, week_start_date')
            .eq('tracked_site_id', trackedSiteId)
            .order('week_start_date', { ascending: false })
            .limit(4),
          // GA4 history (latest)
          supabase
            .from('ga4_history_log')
            .select('total_users, sessions, pageviews, bounce_rate, engagement_rate, week_start_date')
            .eq('tracked_site_id', trackedSiteId)
            .order('week_start_date', { ascending: false })
            .limit(4),
          // Crawl index history
          supabase
            .from('crawl_index_history')
            .select('total_pages, indexed_count, noindex_count, gsc_indexed_count, week_start_date')
            .eq('tracked_site_id', trackedSiteId)
            .order('week_start_date', { ascending: false })
            .limit(4),
        ]);

        const blocks: string[] = [];

        // Crawl summary
        if (crawlRes.data?.length) {
          const latest = crawlRes.data[0];
          blocks.push(`CRAWL MULTI-PAGES (dernier: ${latest.created_at?.slice(0, 10)}):
- Statut: ${latest.status}, Pages: ${latest.crawled_pages}/${latest.total_pages}, Score moyen: ${latest.avg_score || '—'}/200
- Résumé IA: ${latest.ai_summary?.slice(0, 500) || 'Non disponible'}`);
        }

        // Crawl pages (worst pages)
        if (crawlPagesRes.data?.length) {
          const worstPages = crawlPagesRes.data.slice(0, 15).map((p: any) =>
            `  - ${p.url} | Score: ${p.seo_score}/200 | Mots: ${p.word_count || '?'} | Liens int: ${p.internal_links || 0} | Profondeur: ${p.crawl_depth || '?'} | Noindex: ${p.has_noindex ? 'oui' : 'non'} | Issues: ${(p.issues || []).join(', ') || 'aucune'}`
          ).join('\n');
          blocks.push(`PAGES LES PLUS FAIBLES (top 15 par score):\n${worstPages}`);
        }

        // Audit history
        if (auditRes.data?.length) {
          blocks.push(`AUDITS RÉALISÉS:\n${auditRes.data.map((a: any) => `  - ${a.audit_type} le ${a.created_at?.slice(0, 10)}`).join('\n')}`);
        }

        // SERP KPIs
        if (serpRes.data?.length) {
          for (const entry of serpRes.data) {
            if (entry.data_type === 'serp_kpis' && entry.result_data) {
              const d = entry.result_data as any;
              blocks.push(`SERP KPIs (${entry.created_at?.slice(0, 10)}):
- Mots-clés organiques: ${d.organic_keywords || '?'}, Trafic estimé: ${d.organic_traffic || '?'}
- Domaine rank: ${d.domain_rank || '?'}, Autorité sémantique: ${d.semantic_authority || '?'}`);
            }
          }
        }

        // Backlinks
        if (backlinkRes.data?.length) {
          const bl = backlinkRes.data[0];
          blocks.push(`BACKLINKS (${bl.measured_at?.slice(0, 10)}):
- Domaines référents: ${bl.referring_domains || '?'}, Total backlinks: ${bl.backlinks_total || '?'}
- Rang domaine: ${bl.domain_rank || '?'}, Nouveaux: +${bl.referring_domains_new || 0}, Perdus: -${bl.referring_domains_lost || 0}`);
        }

        // GSC
        if (gscRes.data?.length) {
          const latest = gscRes.data[0];
          blocks.push(`GOOGLE SEARCH CONSOLE (semaine ${latest.week_start_date}):
- Clics: ${latest.clicks}, Impressions: ${latest.impressions}, CTR: ${(latest.ctr * 100).toFixed(1)}%, Position moy: ${latest.avg_position?.toFixed(1) || '?'}
- Top requêtes: ${JSON.stringify(latest.top_queries)?.slice(0, 300) || 'N/A'}`);
        }

        // GA4
        if (ga4Res.data?.length) {
          const latest = ga4Res.data[0];
          blocks.push(`GOOGLE ANALYTICS (semaine ${latest.week_start_date}):
- Utilisateurs: ${latest.total_users}, Sessions: ${latest.sessions}, Pages vues: ${latest.pageviews}
- Taux rebond: ${(latest.bounce_rate * 100).toFixed(1)}%, Engagement: ${(latest.engagement_rate * 100).toFixed(1)}%`);
        }

        // Index history
        if (indexHistoryRes.data?.length) {
          const latest = indexHistoryRes.data[0];
          blocks.push(`INDEXATION (semaine ${latest.week_start_date}):
- Total pages: ${latest.total_pages}, Indexées: ${latest.indexed_count}, Noindex: ${latest.noindex_count}
- GSC indexées: ${latest.gsc_indexed_count || 'N/A'}`);
        }

        if (blocks.length > 0) {
          domainDataBlock = `\n\nDONNÉES COMPLÈTES DU DOMAINE "${normalizedDomain}" :\n${blocks.join('\n\n')}`;
          console.log(`[cocoon-chat] Domain data loaded: ${blocks.length} data blocks`);
        }
      }
    } catch (e) {
      console.warn('[cocoon-chat] Could not fetch domain data:', e);
    }

    const langInstruction = language === 'en'
      ? 'You MUST reply entirely in English.'
      : language === 'es'
        ? 'Debes responder SIEMPRE en español.'
        : `DÉTECTION DE LANGUE : Détecte la langue du premier message de l'utilisateur. Si l'utilisateur écrit en anglais, réponds ENTIÈREMENT en anglais. Si en espagnol, réponds ENTIÈREMENT en espagnol. Sinon, réponds en français. Conserve cette langue pour TOUTE la conversation.`;

    const basePrompt = `Tu es un expert en SEO sémantique et architecture de contenu, spécialisé dans l'analyse de cocons sémantiques (cocoon / topic clusters).

${langInstruction}
${siteIdentityBlock}
${domainDataBlock}

Tu as accès aux données suivantes sur le cocon sémantique de l'utilisateur :
${context || "Aucune donnée de cocon fournie."}

RESTRICTION DE DOMAINE :
Tu ne dois répondre QU'AUX questions concernant le domaine "${domain || 'affiché dans le graphe'}". 
Si l'utilisateur pose une question sur un autre domaine, réponds poliment que tu ne peux analyser que le domaine actuellement affiché dans la preview du cocon sémantique.

IMPORTANT — VÉRIFICATION DE COHÉRENCE :
Avant de répondre à chaque question, analyse si la question de l'utilisateur est cohérente avec les données du graphe que tu as reçues. 
Si tu détectes que le problème pourrait venir d'un paramétrage d'affichage (filtres, curseurs, zoom, mode 2D/3D, plein écran), alors :
1. Commence ta réponse par le préfixe exact "[DISPLAY_HINT]"
2. Explique poliment que le problème semble lié à l'affichage ou au filtrage
3. Suggère les actions concrètes : modifier les curseurs (Contraste, Halo, Chaleur, Épaisseur), activer/désactiver les filtres de type de page ou de flux de particules, ouvrir la preview en plein écran, ou basculer entre 2D et 3D
4. Ne log pas d'erreur dans ce cas

Si la question est cohérente avec les données mais révèle un vrai problème (données manquantes, incohérence, pages absentes du graphe alors qu'elles devraient y être, etc.) :
1. Commence ta réponse par le préfixe exact "[COCOON_ERROR]" suivi d'une description courte du problème sur la première ligne
2. Puis réponds normalement à l'utilisateur

Si la question est une question normale (analyse, conseil, optimisation), réponds normalement sans préfixe.

STYLE DE RÉPONSE :
- Prends le temps de bien analyser les données avant de répondre
- Ne montre jamais de message d'erreur technique ou de processus de réflexion interne
- Réponds toujours de manière structurée et professionnelle, même si les données sont incomplètes
- Si tu ne disposes pas de certaines données, dis simplement que cette information n'est pas encore disponible pour ce domaine

Ton rôle :
- Interpréter les métriques du cocon (ROI prédictif, GEO score, citabilité LLM, E-E-A-T, content gap, cannibalisation)
- Identifier les clusters faibles et proposer des optimisations concrètes
- Suggérer des liens internes manquants ou redondants
- Recommander des pages à créer, fusionner ou supprimer
- Expliquer les relations sémantiques entre les nœuds
- Donner des conseils pour améliorer la visibilité LLM (GEO)
- Utiliser les données de crawl, audit, SERP, backlinks, GSC et GA4 quand elles sont disponibles pour enrichir tes analyses

LIMITE DE LONGUEUR (OBLIGATOIRE) :
Chaque réponse doit faire MAXIMUM 1000 caractères (espaces inclus). Si ta réponse complète dépasse 1000 caractères :
1. Arrête-toi à un point logique avant la limite
2. Termine par une phrase indiquant que tu as encore des éléments à partager (ex: "Je peux détailler davantage si vous le souhaitez.")
3. Quand l'utilisateur relance, commence ta réponse par "D'abord, pour compléter ma réponse précédente, " puis continue là où tu t'étais arrêté
Ne dépasse JAMAIS 1000 caractères. Privilégie la densité d'information et les bullet points courts.

Réponds de façon concise, structurée et actionnable. Utilise des bullets points et du markdown.`;

    const analysisPrompt = analysisMode ? `

IMPORTANT: L'utilisateur a sélectionné plusieurs pages pour une analyse comparative. Tu dois:
1. Décrire la relation contextuelle et sémantique entre ces pages
2. Analyser la hiérarchie et le flux de "juice" (link equity) entre elles
3. Utiliser ce format de couleurs dans ta réponse:
   - 🟢 **Forces** : ce qui fonctionne bien (liens forts, complémentarité sémantique)
   - 🔵 **Faiblesses** : points à améliorer (orphelines, faible autorité)
   - 🔴 **Gaps** : liens manquants, opportunités ratées
   - ✨ **Quick Wins** : actions rapides à fort impact
4. Conclure avec des recommandations concrètes de maillage interne` : '';

    const systemPrompt = basePrompt + analysisPrompt;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cocoon-chat error:", e);
    await logSilentError("cocoon-chat", "chat-completion", e, { severity: "high", impact: "none" });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
