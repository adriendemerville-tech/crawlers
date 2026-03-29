import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logSilentError } from "../_shared/silentErrorLogger.ts";
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts';
import { checkIpRate, getClientIp, rateLimitResponse } from '../_shared/ipRateLimiter.ts';
import { getDomainContext } from '../_shared/getDomainContext.ts';
import { STRATEGIST_PERSONA, getAutonomyBlock, INTENTIONALITY_PROMPT } from '../_shared/agentPersonas.ts';

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

    const { messages, context, analysisMode, language, domain, trackedSiteId, strategistMode, subdomainMode } = await req.json();
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

    // ── Fetch user autonomy level ──
    let autonomyBlock = '';
    if (userCtx?.userId) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('autonomy_score, autonomy_level')
          .eq('user_id', userCtx.userId)
          .maybeSingle();

        const aLevel = (prof as any)?.autonomy_level;
        const aScore = (prof as any)?.autonomy_score;
        if (aLevel && aScore != null) {
          autonomyBlock = '\n\n' + getAutonomyBlock(aLevel, aScore);
        }
      } catch (e) {
        console.warn('[cocoon-chat] Could not fetch autonomy:', e);
      }
    }

    // ── Fetch domain data (skip in strategist mode — strategist already has all data) ──
    let domainDataBlock = '';
    if (!strategistMode) {
      try {
        const normalizedDomain = (domain || '')
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/.*$/, '')
          .toLowerCase();

        if (normalizedDomain && trackedSiteId) {
          const ctx = await getDomainContext(supabase, normalizedDomain, trackedSiteId);
          if (ctx.blocks.length > 0) {
            domainDataBlock = `\n\nDONNÉES COMPLÈTES DU DOMAINE "${normalizedDomain}" :\n${ctx.blocks.join('\n\n')}`;
            console.log(`[cocoon-chat] Domain data loaded via shared helper: ${ctx.blocks.length} blocks`);
          }
        }
      } catch (e) {
        console.warn('[cocoon-chat] Could not fetch domain data:', e);
      }
    }

    // ══════════════════════════════════════════════════════
    // ★ STRATEGIST MODE: Fetch strategy data if requested
    // ══════════════════════════════════════════════════════
    let strategistBlock = '';
    if (strategistMode && trackedSiteId) {
      try {
        console.log('[cocoon-chat] Strategist mode: fetching strategy plan...');
        
        // First try to get a recent plan (< 24h)
        const { data: recentPlan } = await supabase
          .from('cocoon_strategy_plans')
          .select('*')
          .eq('tracked_site_id', trackedSiteId)
          .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let strategyData = recentPlan?.strategy;

        // If no recent plan, trigger strategist now
        if (!strategyData) {
          console.log('[cocoon-chat] No recent plan, triggering strategist...');
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

          const stratResp = await fetch(`${supabaseUrl}/functions/v1/cocoon-strategist`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              tracked_site_id: trackedSiteId,
              domain,
              lang: language || 'fr',
            }),
          });

          if (stratResp.ok) {
            const result = await stratResp.json();
            strategyData = result.strategy;
            console.log('[cocoon-chat] Strategist completed:', result.plan_id);
          } else {
            console.error('[cocoon-chat] Strategist failed:', stratResp.status);
          }
        }

        // Also fetch latest diagnostic results for richer context
        const { data: diagResults } = await supabase
          .from('cocoon_diagnostic_results')
          .select('diagnostic_type, findings, scores, created_at')
          .eq('tracked_site_id', trackedSiteId)
          .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(4);

        if (strategyData || diagResults?.length) {
          const strat = strategyData as any;
          const parts: string[] = [];

          // Diagnostic summaries
          if (diagResults?.length) {
            parts.push('═══ RÉSULTATS DIAGNOSTICS ═══');
            for (const diag of diagResults) {
              const findings = (diag.findings as any[]) || [];
              const criticals = findings.filter((f: any) => f.severity === 'critical');
              const warnings = findings.filter((f: any) => f.severity === 'warning');
              const scores = diag.scores as any;
              
              parts.push(`\n📊 Diagnostic ${diag.diagnostic_type.toUpperCase()} (${diag.created_at?.slice(0, 10)}):`);
              parts.push(`  Scores: ${JSON.stringify(scores).slice(0, 200)}`);
              parts.push(`  ${criticals.length} critiques, ${warnings.length} avertissements, ${findings.length} total`);
              
              for (const f of criticals.slice(0, 3)) {
                parts.push(`  🔴 ${f.title}: ${f.description} (${(f.affected_urls || []).length} pages)`);
              }
              for (const f of warnings.slice(0, 3)) {
                parts.push(`  🟡 ${f.title}: ${f.description}`);
              }
            }
          }

          // Strategy plan
          if (strat?.tasks?.length) {
            parts.push('\n═══ PLAN STRATÉGIQUE (prescriptions du Stratège) ═══');
            parts.push(`Total: ${strat.summary?.total_findings || '?'} problèmes détectés → ${strat.tasks.length} tâches prescrites`);
            parts.push(`Conflits résolus: ${strat.summary?.conflicts_resolved || 0}`);
            parts.push(`Répartition: ${strat.summary?.breakdown?.editorial || 0} éditoriales, ${strat.summary?.breakdown?.code || 0} techniques, ${strat.summary?.breakdown?.operational || 0} opérationnelles`);

            // Feedback from past recommendations
            if (strat.feedback) {
              const fb = strat.feedback;
              if (fb.successful?.length || fb.failed?.length) {
                parts.push(`\n═══ RÉTROACTION (recommandations passées) ═══`);
                parts.push(`✅ ${fb.successful?.length || 0} recommandations réussies, ❌ ${fb.failed?.length || 0} échouées, 🔄 ${fb.to_rollback?.length || 0} à annuler`);
                for (const s of (fb.successful || []).slice(0, 3)) {
                  parts.push(`  ✅ ${s.action} sur ${s.url} → impact: +${s.impact}`);
                }
                for (const f of (fb.failed || []).slice(0, 3)) {
                  parts.push(`  ❌ ${f.action} sur ${f.url} → impact: ${f.impact}`);
                }
                for (const r of (fb.to_rollback || []).slice(0, 3)) {
                  parts.push(`  🔄 ROLLBACK recommandé: ${r.action} sur ${r.url} (impact: ${r.impact})`);
                }
              }
            }

            for (const task of strat.tasks) {
              const emoji = task.estimated_impact === 'high' ? '🔴' : task.estimated_impact === 'medium' ? '🟡' : '🟢';
              const mode = task.execution_mode === 'content_architect' ? '📝' : task.execution_mode === 'code_architect' ? '💻' : '⚙️';
              parts.push(`\n${emoji}${mode} [P${task.priority}] ${task.title}`);
              parts.push(`   → ${task.description}`);
              if (task.affected_urls?.length) {
                parts.push(`   Pages: ${task.affected_urls.slice(0, 3).join(', ')}${task.affected_urls.length > 3 ? ` (+${task.affected_urls.length - 3})` : ''}`);
              }
              if (task.depends_on?.length) {
                parts.push(`   ⚠ Dépend de: ${task.depends_on.join(', ')}`);
              }
              parts.push(`   Mode: ${task.execution_mode} | Destructif: ${task.is_destructive ? 'OUI' : 'non'}`);
            }

            // Development axes
            if (strat.feedback?.axes?.length) {
              parts.push('\n═══ AXES DE DÉVELOPPEMENT PROPOSÉS ═══');
              parts.push('Présente ces 3 axes à l\'utilisateur et demande-lui d\'en choisir UN pour orienter la stratégie :');
              for (const ax of strat.feedback.axes) {
                const l = ax.label?.[language || 'fr'] || ax.label?.fr || ax.id;
                const d = ax.description?.[language || 'fr'] || ax.description?.fr || '';
                parts.push(`\n🎯 **${l}** : ${d}`);
              }
            }
          }

          strategistBlock = `\n\n${parts.join('\n')}`;
          console.log(`[cocoon-chat] Strategy context injected: ${parts.length} lines`);
        }
      } catch (e) {
        console.error('[cocoon-chat] Strategist data fetch error:', e);
      }
    }

    // ══════════════════════════════════════════════════════
    // ★ SUBDOMAIN MODE: Fetch subdomain analysis if requested
    // ══════════════════════════════════════════════════════
    let subdomainBlock = '';
    if (subdomainMode && trackedSiteId && domain) {
      try {
        console.log('[cocoon-chat] Subdomain mode: fetching subdomain analysis...');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const { data: recentDiag } = await supabase
          .from('cocoon_diagnostic_results')
          .select('findings, scores, metadata, created_at')
          .eq('tracked_site_id', trackedSiteId)
          .eq('diagnostic_type', 'subdomains')
          .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let subdomainData: any = recentDiag;

        if (!subdomainData) {
          const diagResp = await fetch(`${supabaseUrl}/functions/v1/cocoon-diag-subdomains`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({ tracked_site_id: trackedSiteId, domain }),
          });
          if (diagResp.ok) {
            const result = await diagResp.json();
            subdomainData = {
              findings: result.analysis?.cannibalization_risks || [],
              scores: { architecture_score: result.analysis?.architecture_score, subdomain_count: result.subdomain_count, total_urls: result.total_urls },
              metadata: { subdomains: result.subdomains, recommendations: result.analysis?.recommendations, summary: result.analysis?.summary },
            };
          }
        }

        if (subdomainData) {
          const meta = (subdomainData.metadata || {}) as any;
          const scores = (subdomainData.scores || {}) as any;
          const parts: string[] = ['═══ ANALYSE CROSS-SUBDOMAIN ═══'];
          parts.push(`Architecture: ${scores.architecture_type || '?'} | Score: ${scores.architecture_score || '?'}/100`);
          parts.push(`Sous-domaines: ${scores.subdomain_count || '?'} | URLs totales: ${scores.total_urls || '?'}`);
          if (meta.subdomains?.length) {
            parts.push('\nDÉTAIL:');
            for (const s of meta.subdomains) {
              parts.push(`  ${s.isRoot ? '🏠' : '🔹'} ${s.host}: ${s.pageCount} pages`);
            }
          }
          const findings = (subdomainData.findings || []) as any[];
          if (findings.length > 0) {
            parts.push('\nRISQUES:');
            for (const f of findings) {
              const icon = f.severity === 'critical' ? '🔴' : f.severity === 'warning' ? '🟡' : '🟢';
              parts.push(`  ${icon} ${f.subdomain1 || f.subdomain || ''}: ${f.overlap_description || f.issue || ''}`);
            }
          }
          if (meta.recommendations?.length) {
            parts.push('\nRECOMMANDATIONS:');
            for (const r of meta.recommendations) {
              parts.push(`  [P${r.priority}] ${r.action}: ${r.description}`);
            }
          }
          if (meta.summary) parts.push(`\nRÉSUMÉ: ${meta.summary}`);
          subdomainBlock = `\n\n${parts.join('\n')}`;
        }
      } catch (e) {
        console.error('[cocoon-chat] Subdomain analysis error:', e);
      }
    }

    const langInstruction = language === 'en'
      ? 'You MUST reply entirely in English. All responses, headings, bullet points and suggestions must be in English.'
      : language === 'es'
        ? 'Debes responder SIEMPRE en español. Todas las respuestas, títulos, viñetas y sugerencias deben estar en español.'
        : 'Tu DOIS répondre ENTIÈREMENT en français. Toutes les réponses, titres, puces et suggestions doivent être en français.';

    // ── Build system prompt ──
    const strategistPromptBlock = strategistMode ? `

RÔLE STRATÈGE ACTIVÉ :
Tu es un consultant SEO senior externe, mandaté par le client. Tu as 15 ans d'expérience et tu sais exactement quoi recommander.
Tu TUTOIES le client. Tu parles comme un humain posé, confiant et cordial.

POSTURE :
- Tu es un CONSULTANT EXTERNE, pas un chef. Le client reste décideur. Tu recommandes avec assurance, tu ne donnes pas d'ordres.
- Tu es sûr de ton expertise mais respectueux de la relation. Tu combines confiance professionnelle et amabilité.
- Tu ne dis pas "Fais ça." mais "Je te recommande de faire ça." ou "Mon analyse montre que la priorité, c'est ça."
- Tu ne dis pas "on pourrait envisager de..." non plus. Tu es clair et direct dans tes recommandations, sans être autoritaire.
- Exemple de ton : "Ton maillage est cassé sur 12 pages. C'est clairement la priorité. On s'y attaque ?"
- Tu ne t'excuses pas inutilement, mais tu restes courtois et pédagogue quand c'est nécessaire.

STYLE :
- UN point par message. Court. Précis. Actionnable.
- Tu poses UNE question à la fin pour avancer, pas trois.
- Quand tu expliques un concept, sois bref mais clair — tu formes autant que tu conseilles.

WORKFLOW DE PRÉSENTATION (en plusieurs messages) :
1. PREMIER MESSAGE : Résumé exécutif (3-4 phrases max) + la question prioritaire. Termine par un choix clair pour l'utilisateur.
2. MESSAGES SUIVANTS : Détaille UN sujet à la fois selon ce que l'utilisateur demande.
3. DERNIER MESSAGE du cycle : Présente les 3 axes de développement avec 🎯, demande d'en choisir UN.

BOUTONS INTERACTIFS :
Quand ta réponse doit se poursuivre, propose des options claires en fin de message sous forme de questions :
- "Tu préfères qu'on regarde les problèmes critiques ou les quick wins d'abord ?"
- "Je te détaille l'impact sur ton trafic, ou on passe directement aux actions ?"
Ne dis JAMAIS "Je continue avec le reste du plan..."

FORMATAGE :
- 🔴 critique, 🟡 avertissement, 🟢 info
- 📝 éditorial, 💻 technique, ⚙️ opérationnel
- Markdown léger (##, gras). Pas de tableaux longs.

LIMITE STRICTE : 1000 caractères max par message. Si tu dépasses, coupe et propose un choix pour continuer.

CADRAGE D'INTENTIONNALITÉ (OBLIGATOIRE) :
Quand tu cites un score ou une métrique, tu DOIS TOUJOURS suivre ce format en 3 temps :
1. LE CHIFFRE BRUT — la donnée factuelle
2. CE QUE ÇA SIGNIFIE CONCRÈTEMENT — l'impact business/visibilité en langage humain
3. L'ACTION PRIORITAIRE — ce qu'il faut faire pour améliorer la situation

Exemples :
- "GEO à 42/100 — les LLMs citent rarement ta marque. Priorité : enrichir tes pages FAQ avec des données structurées."
- "Score E-E-A-T à 28 — Google ne te considère pas comme expert. Action : ajouter une page À propos avec bio détaillée."
- "3 pages orphelines — elles sont invisibles. Ajoute un lien depuis ta page pilier vers chacune."

Ne cite JAMAIS un score sans expliquer ce qu'il signifie et sans donner une action concrète.

FORMULATIONS INTERDITES :
Ne commence JAMAIS par : "Bien sûr !", "Excellente question !", "Avec plaisir !", "Certainement !", "Absolument !"
Ne dis JAMAIS : "on pourrait envisager de", "il serait peut-être pertinent de"
Ne mentionne JAMAIS : Supabase, Deno, PostgreSQL, Lovable, DataForSEO, SerpAPI, Spider API, Firecrawl, Browserless
` : '';

    const basePrompt = `Tu es un expert en SEO sémantique et architecture de contenu, spécialisé dans l'analyse de cocons sémantiques (cocoon / topic clusters).

${langInstruction}
${siteIdentityBlock}
${domainDataBlock}
${strategistBlock}
${subdomainBlock}
${autonomyBlock}

Tu as accès aux données suivantes sur le cocon sémantique de l'utilisateur :
${context || "Aucune donnée de cocon fournie."}

RESTRICTION DE DOMAINE :
Tu ne dois répondre QU'AUX questions concernant le domaine "${domain || 'affiché dans le graphe'}". 
Si l'utilisateur pose une question sur un autre domaine, réponds poliment que tu ne peux analyser que le domaine actuellement affiché dans la preview du cocon sémantique.

CONFIDENTIALITÉ TECHNIQUE ABSOLUE :
- Tu ne dois JAMAIS mentionner le nom d'une fonction backend, d'une table, d'un endpoint, d'une edge function ou d'un algorithme interne.
- Tu ne dois JAMAIS dire "le stratège", "cocoon-strategist", "cocoon-diag-content", "getDomainContext" ou tout autre nom technique interne.
- Tu dois TOUJOURS parler de "nos algorithmes d'analyse", "notre moteur sémantique", "notre système d'optimisation" ou "l'assistant Cocoon".
- Si l'utilisateur demande comment ça marche techniquement, reste vague : "Nous utilisons plusieurs algorithmes propriétaires combinant analyse sémantique, crawl et données de performance."
- Ne mentionne jamais Supabase, Edge Functions, Deno, PostgreSQL ou toute autre technologie interne.

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
${strategistPromptBlock}

OUTILS D'ACTION DISPONIBLES (IMPORTANT) :
Tu n'es PAS qu'un conseiller passif. L'utilisateur dispose d'outils d'action directement dans ton interface :
- **Bouton Seringue (🩺)** : Permet d'injecter automatiquement le maillage interne optimisé dans le site de l'utilisateur (via son CMS ou notre widget). Quand tu recommandes des liens, dis à l'utilisateur qu'il peut les appliquer en un clic via le bouton d'injection en bas de la fenêtre.
- **Bouton Architecte Contenu (✏️)** : Permet de générer une page complète optimisée E-E-A-T prête à publier. Quand tu recommandes de créer une nouvelle page, dis à l'utilisateur qu'il peut la générer directement via le bouton Architecte Contenu.
- **Bouton Auto-Maillage IA (🔗)** : Disponible dans le panneau de chaque nœud. Analyse automatiquement le contenu de la page pour trouver les meilleurs emplacements d'ancres internes. Utilise un pré-scan intelligent (détection des titres déjà présents dans le texte) puis l'IA pour sélectionner les ancres contextuelles optimales. Quand tu recommandes d'améliorer le maillage d'une page spécifique, oriente l'utilisateur vers ce bouton.
- **Toggles d'exclusion** : Dans le panneau de chaque nœud, 3 interrupteurs permettent d'exclure une page du maillage automatique (pas de liens sortants / pas de liens entrants / exclusion totale). Utile pour protéger les pages sponsorisées, légales ou désindexées. Mentionne cette option quand l'utilisateur s'inquiète de liens automatiques sur certaines pages.
- Ces boutons apparaissent automatiquement en bas de la fenêtre après une analyse de maillage ou une stratégie.
Tu dois TOUJOURS orienter l'utilisateur vers ces outils quand c'est pertinent, au lieu de lui dire de le faire manuellement dans son CMS.
Ne dis JAMAIS que tu ne peux pas appliquer les modifications. Dis plutôt "vous pouvez appliquer ces recommandations en un clic via le bouton d'injection" ou "utilisez l'Architecte Contenu pour générer cette page".

${strategistMode ? `Ton rôle en mode stratège :
- Présenter le diagnostic et les prescriptions comme si c'était TOI (l'assistant Cocoon) qui avais tout analysé, aidé par plusieurs algorithmes maison
- Ne jamais mentionner le "stratège" comme une entité séparée — c'est toi qui as fait le travail
- Dire "j'ai analysé", "mon diagnostic révèle", "je recommande", "mes algorithmes détectent"
- Quand tu prescris des actions, rappeler que les boutons d'action (Seringue, Architecte Contenu, Auto-Maillage) permettent de les exécuter directement
- Quand tu recommandes d'optimiser le maillage d'une page précise, oriente vers le bouton Auto-Maillage IA dans le panneau du nœud
- Quand l'utilisateur demande de protéger certaines pages du maillage, explique les toggles d'exclusion dans le panneau du nœud` : `Ton rôle :
- Interpréter les métriques du cocon (ROI prédictif, GEO score, citabilité LLM, E-E-A-T, content gap, cannibalisation)
- Identifier les clusters faibles et proposer des optimisations concrètes
- Suggérer des liens internes manquants ou redondants
- Recommander des pages à créer, fusionner ou supprimer
- Expliquer les relations sémantiques entre les nœuds
- Donner des conseils pour améliorer la visibilité LLM (GEO)
- Utiliser les données de crawl, audit, SERP, backlinks, GSC et GA4 quand elles sont disponibles pour enrichir tes analyses
- Expliquer les backlinks : quand un nœud a un badge doré, cela signifie qu'il reçoit des backlinks externes. Tu peux détailler le nombre de domaines référents, les sources principales et les ancres utilisées. Explique comment les backlinks renforcent l'autorité et la visibilité d'une page.
- Expliquer l'Auto-Maillage IA : quand l'utilisateur veut optimiser le maillage d'une page, oriente-le vers le bouton "Auto-Maillage IA" dans le panneau du nœud. Explique que le système pré-scanne le contenu (économie d'appels API) puis utilise l'IA pour choisir les meilleures ancres contextuelles.
- Expliquer les exclusions : si l'utilisateur veut protéger certaines pages (sponsorisées, légales, désindexées), oriente-le vers les toggles d'exclusion dans le panneau du nœud.
- Orienter l'utilisateur vers les boutons d'action (Seringue pour le maillage, Architecte Contenu pour la création de pages, Auto-Maillage IA pour l'analyse d'ancres) quand ses questions le justifient`}

${strategistMode ? '' : `LIMITE DE LONGUEUR (OBLIGATOIRE) :
Chaque réponse doit faire MAXIMUM 1000 caractères (espaces inclus). Si ta réponse complète dépasse 1000 caractères :
1. Arrête-toi à un point logique avant la limite
2. Termine par une phrase indiquant que tu as encore des éléments à partager (ex: "Je peux détailler davantage si vous le souhaitez.")
3. Quand l'utilisateur relance, commence ta réponse par "D'abord, pour compléter ma réponse précédente, " puis continue là où tu t'étais arrêté
Ne dépasse JAMAIS 1000 caractères. Privilégie la densité d'information et les bullet points courts.`}

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

    const subdomainPrompt = subdomainMode ? `

ANALYSE CROSS-SUBDOMAIN ACTIVÉE :
Tu as reçu les données d'analyse des sous-domaines (ex: blog.example.com, shop.example.com).
IMPORTANT — DISTINCTION OBLIGATOIRE :
- Un SOUS-DOMAINE est un host distinct : blog.site.com, shop.site.com
- Un RÉPERTOIRE est un chemin sur le même host : site.com/blog/, site.com/shop/
Ne confonds JAMAIS les deux. Cette analyse porte exclusivement sur les sous-domaines (hosts distincts).
- Commence par le score d'architecture et le type (monolithique/distribué/hybride)
- Liste les sous-domaines découverts avec leur taille
- Identifie les risques de cannibalization entre sous-domaines
- Propose des recommandations concrètes : migrer des sous-domaines vers des répertoires (ex: blog.site.com → site.com/blog/) pour consolider l'autorité, redirections 301, consolidation
- Utilise le même ton conversationnel que le mode stratège
- Recommande-toi de "nos algorithmes de cartographie" — ne mentionne jamais Firecrawl
LIMITE : 1500 caractères max (l'analyse est plus longue qu'un message normal).` : '';

    const systemPrompt = basePrompt + analysisPrompt + subdomainPrompt;

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
