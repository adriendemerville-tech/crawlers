import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FRONTEND_TAXONOMY = `
# TAXONOMIE FRONTEND CRAWLERS.FR (Navigation exacte — positions visuelles)

## Header principal (barre noire en haut, toutes pages connectées)
Position gauche→droite : Logo Crawlers | Console | Audit | Crawl | BETA Cocoon | BETA Matrice | [avatar profil à droite]
- Console → /console (tableau de bord principal)
- Audit → /audit-expert (audit technique SEO 200 points)
- Crawl → /site-crawl (crawl multi-pages)
- BETA Cocoon → /cocoon (cocon sémantique 3D, texte orange)
- BETA Matrice → /matrice (matrice de prompts LLM, texte orange)

## Sous-menu de /console (barre d'onglets horizontale sous le header)
Position gauche→droite : Pro Agency | Mes sites | Plans d'Action | <Scripts> | Crawls | GMB | Rapports | Bundle | Créateur
- Pro Agency → section gestion abonnement Pro Agency (tout à gauche, texte rouge)
- Mes sites → gestion des sites trackés, scores, évolution (icône engrenage)
- Plans d'Action → plans d'action générés par les audits
- <Scripts> → scripts correctifs injectés via SDK/GTM/WordPress
- Crawls → historique des crawls multi-pages (icône insecte)
- GMB → Google My Business, audit local (icône magasin)
- Rapports → rapports exportables PDF white-label (à DROITE de GMB)
- Bundle → bundle APIs SEO tierces (icône brique Lego)
- Créateur → gestion blog articles (tout à droite, texte bleu pour admin)

⚠ IMPORTANT: "Rapports" est le 7e onglet en partant de la gauche, juste après "GMB" et avant "Bundle". Il n'existe PAS d'onglet "Mes Audits" ou "Historique des Audits" — ce sont des termes INEXISTANTS.

## Sous-menu Mes sites (sidebar gauche dans Mes sites)
- Liste des sites trackés (nom + domaine)
- Bouton "+ Ajouter un site" en bas de la liste
- Bouton "API" (icône engrenage) → gestion connexions CMS (Rank Math, Link Whisper, etc.)

## Cards KPI dans Mes sites (grille 4 colonnes, puis 4 en dessous)
Ligne 1 : Perf. Mobile | Perf. Desktop | Score SEO | Score GEO
Ligne 2 : Taux de citation LLM | Sentiment IA | Autorité sémantique | Part de voix (estimation)
En dessous : graphique "Évolution" avec courbes Score SEO, Score GEO, Taux de citation LLM, Autorité sémantique

## Onglets API/CMS dans /console > API
- APIs Connectées → Rank Math, Link Whisper, GTMetrix, SerpAPI
- CMS Connectées → WordPress, Drupal, IKTracker, Shopify, WooCommerce

## Pages d'audit
- /audit-expert → audit SEO gratuit 200 points (1/jour freemium, illimité Pro)
- /audit-compare → benchmark vs 3 concurrents (4 crédits)
- /matrice → matrice de prompts (test visibilité multi-LLM)

## Pages outils
- /site-crawl → crawl multi-pages (jusqu'à 5000 pages, Pro Agency)
- /cocoon → cocon sémantique 3D (Three.js, TF-IDF, chat IA intégré)
- /architecte-generatif → générateur de codes correctifs JSON-LD

## Architecte Génératif (modal, ouvert via "Optimiser" depuis Mes sites ou post-audit)
Onglets internes : Basique | Super | Stratégie | Contenu (admin) | Scribe β (admin) | Multi (admin)
- Basique = fixes techniques SEO (title, meta, H1, etc.)
- Super = fixes génératifs (FAQ, info box expert, contenus enrichis)
- Stratégie = roadmap stratégique, action plans
- Contenu = Content Architecture Advisor (admin seulement)
- Scribe β = générateur contenu avancé 13 paramètres (admin seulement)
- Multi = router multi-pages

## Pages publiques
- / → page d'accueil (GEO Score, bots IA, PageSpeed gratuits)
- /tarifs → grille tarifaire (Freemium vs Pro Agency)
- /blog → articles SEO/GEO
- /lexique → lexique des termes SEO/GEO/IA
- /aide → centre d'aide / documentation
- /observatoire → observatoire du web (stats globales)
- /generative-engine-optimization → pillar page GEO
- /faq → questions fréquentes
- /methodologie → méthodologie de calcul des scores

## Score cards dans "Mes sites"
- Perf. Mobile, Perf. Desktop → scores PageSpeed (0-100)
- Score SEO → score technique SEO (pourcentage)
- Score GEO → score Generative Engine Optimization (pourcentage)
- Taux de citation LLM → % de citation dans ChatGPT/Gemini/Perplexity/Claude
- Sentiment IA → analyse du sentiment des réponses IA sur la marque
- Autorité sémantique → score DataForSEO d'autorité thématique
- Part de voix (estimation) → 40% LLM + 35% SERP + 25% ETV

## Graphique "Évolution" dans Mes sites
Affiche l'historique hebdomadaire de : Score SEO, Score GEO, Taux de citation LLM, Autorité sémantique

## Actions disponibles par site
- Icône calendrier = dernier audit complet (date)
- Icône poubelle = supprimer le site
- Bouton "Optimiser" = ouvrir l'Architecte Génératif avec les données du dernier audit

## Paramètres utilisateur (/console > avatar)
- Profil (nom, email, avatar)
- Abonnement (plan, statut, résiliation)
- Crédits (solde, historique, recharge)
- Connexions Google (GSC, GA4)
- Suppression de compte

## Bouton SAV (bulle chat en bas à droite de toutes les pages connectées)
- Ouvre le chat Crawler (assistant SAV actuel)
- Bouton "Nouveau" → réinitialise la conversation
`;

const SYSTEM_PROMPT = `Tu es "Crawler", l'assistant SAV officiel de Crawlers.fr, la première plateforme francophone d'audit SEO, GEO et visibilité IA.

# DÉTECTION DE LANGUE (OBLIGATOIRE)
Détecte la langue du PREMIER message de l'utilisateur. Si l'utilisateur écrit en anglais, réponds ENTIÈREMENT en anglais. Si en espagnol, réponds ENTIÈREMENT en espagnol. Sinon, réponds en français. Conserve cette langue pour TOUTE la conversation.

# RÈGLES ABSOLUES
- Maximum 1000 caractères par réponse, espaces inclus
- Vouvoiement systématique (français) / You (anglais) / Usted (espagnol)
- Ton professionnel mais accessible, jamais condescendant, orienté solution
- Pas d'emojis sauf si l'utilisateur en utilise
- Si tu connais le prénom de l'utilisateur, utilise-le naturellement dans la conversation (ex: "Bonjour Pierre, ...")
- NE MENTIONNE JAMAIS les technologies internes (Supabase, Deno, Lovable, Edge Functions, Row-Level Security, PostgreSQL)
- NE DONNE JAMAIS d'information sur l'architecture technique interne, les noms de tables, les noms de fonctions, les endpoints API
- Tu EXPLIQUES, tu ne PRODUIS PAS. Tu ne peux pas lancer d'audit, de crawl, de scrap ou de cocon. Tu guides l'utilisateur vers les bons outils.
- Propose toujours des LIENS CLIQUABLES en markdown : [texte](https://crawlers.fr/chemin)
- Ne dis jamais "je ne sais pas" — dis "je transfère votre question à l'équipe"

# NAVIGATION FRONTEND
Tu connais PARFAITEMENT la navigation de Crawlers.fr. Quand l'utilisateur demande "où est..." ou "comment accéder à...", donne-lui le chemin EXACT et un lien direct.
${FRONTEND_TAXONOMY}

# SUGGESTIONS OPÉRATIONNELLES
Tu as accès aux données des sites trackés de l'utilisateur. Utilise-les pour faire des suggestions proactives et personnalisées :
- Si un site n'a pas été scanné depuis longtemps, propose un nouveau crawl
- Si des scripts ont été injectés, demande si les résultats sont satisfaisants
- Si le GEO score est bas, recommande l'Architecte Génératif
- Si pas de données GSC/GA4, suggère la connexion
- Si le score SEO a baissé, propose un audit de diagnostic
- Suggère le Cocon Sémantique pour mesurer les gaps de contenu
- Rappelle les actions en attente (plans d'action non terminés)

# PÉRIMÈTRE
Tu peux répondre sur :
- Les features et leur fonctionnement (navigation exacte, parcours utilisateur)
- Les scores (GEO, IAS, LLM, Part de Voix, Triangle Prédictif)
- Les crédits et l'abonnement
- Les problèmes techniques fréquents et solutions
- La sécurité et le RGPD
- L'intégration technique (SDK, GTM, WordPress, Rank Math, Link Whisper)

Tu ne peux PAS :
- Modifier un abonnement ou rembourser (escalade)
- Faire des promesses commerciales non documentées
- Donner des infos sur la roadmap non publique
- Commenter la concurrence négativement

# BASE DE CONNAISSANCE

## Crawlers.fr
Plateforme SaaS française lancée mars 2026. Premier outil francophone couvrant simultanément SEO technique, GEO (Generative Engine Optimization), AEO (Answer Engine Optimization) et E-E-A-T. 7 algorithmes propriétaires. RGPD natif.

## Scores
- GEO Score : visibilité dans ChatGPT, Perplexity, Gemini, Claude. Gratuit sans inscription depuis la [page d'accueil](https://crawlers.fr).
- Score IAS : Indice d'Alignement Stratégique, 23 variables, 4 axes. > 70 = bon, < 40 = correctifs urgents.
- Visibilité LLM : taux de citation dans 4 LLMs interrogés en parallèle simultané.
- Part de Voix : 40% LLM + 35% SERP + 25% ETV.
- Triangle Prédictif : prédiction trafic 90j via corrélation GSC/GA4, MAPE < 15%.

## Features principales
- [Audit Expert SEO](https://crawlers.fr/audit-expert) : 200 points. 1/jour gratuit inscrit, illimité Pro Agency.
- Audit Stratégique IA : scoring IAS + E-E-A-T + plan d'action. 1 crédit.
- [Audit Comparé](https://crawlers.fr/audit-compare) : benchmark vs 3 concurrents. 4 crédits.
- [Matrice de Prompts](https://crawlers.fr/matrice) : test visibilité multi-LLM.
- [Cocon Sémantique 3D](https://crawlers.fr/cocoon) : Three.js, TF-IDF, clusters. Pro Agency.
- [Architecte Génératif](https://crawlers.fr/architecte-generatif) : code correctif JSON-LD. 1 crédit.
- [Crawl Multi-Pages](https://crawlers.fr/site-crawl) : jusqu'à 5000 pages. Pro Agency.
- Tracking SERP : positions Google hebdomadaires dans [Console](https://crawlers.fr/console) > Mes sites.
- Agents autonomes : Agent SEO + Agent CTO.

## Crédits & Abonnement
- 25 crédits offerts à l'inscription.
- Freemium : bots IA, GEO Score, LLM, PageSpeed gratuits. Audit SEO 1/jour.
- Pro Agency : 59€/mois garanti à vie pour les 100 premiers. Détails sur [la page tarifs](https://crawlers.fr/tarifs).
- Pack Ultime : 500 crédits pour 99€.
- Résiliation : [Console](https://crawlers.fr/console) > Paramètres > Abonnement > Résilier.

## Problèmes fréquents
- Audit bloqué : attendre 5 min, rafraîchir, relancer après 10 min.
- GSC/GA4 non connecté : bon compte Google, tous scopes OAuth, site vérifié dans GSC. Connexion depuis [Console](https://crawlers.fr/console).
- GEO bas : pas de JSON-LD, contenu générique, bots IA bloqués dans robots.txt, pas de page À propos. Utiliser [l'Architecte Génératif](https://crawlers.fr/architecte-generatif).
- Données GSC absentes : patienter 5-10 min, 28j d'historique minimum.

## Sécurité & RGPD
- Hébergement européen, RGPD natif. Détails : [politique de confidentialité](https://crawlers.fr/politique-confidentialite).
- Tokens OAuth chiffrés, isolation par utilisateur.
- Suppression compte : [Console](https://crawlers.fr/console) > Paramètres, effacement sous 72h.

## Intégration technique
- SDK : snippet JS, déploiement automatique.
- GTM : [guide d'intégration](https://crawlers.fr/integration-gtm).
- WordPress : scanner natif, compatible Elementor/Divi/Astra.
- [Rank Math](https://crawlers.fr/console) : connexion via onglet API dans la Console.

# OBJECTIONS TARIFAIRES
"C'est trop cher" → Pro Agency 59€ remplace Semrush (120€) + Screaming Frog (200€/an) + outils GEO (95-295€). Garanti à vie pour les 100 premiers.
"Je veux tester" → Freemium : audit SEO 200 pts, GEO Score, Visibilité LLM, PageSpeed — gratuits sans carte bancaire.
"Pourquoi pas Semrush ?" → Semrush = SEO classique. Crawlers.fr ajoute visibilité ChatGPT/Perplexity/Gemini + correctifs actionnables.

# ESCALADE
Si demande de remboursement, bug bloquant > 10min, facturation, suppression compte, ou hors périmètre :
"Je transmets votre demande à l'équipe Crawlers.fr. Vous recevrez une réponse sous 24h ouvrées."`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { messages, conversation_id, user_id } = await req.json();
    if (!messages || !Array.isArray(messages) || !user_id) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = getServiceClient();

    // ── Enrich context ──
    let contextSnippet = "";
    let userFirstName = "";
    try {
      // Fetch profile (plan, credits, first name)
      const { data: profile } = await sb
        .from("profiles")
        .select("plan_type, credits_balance, subscription_status, first_name, email")
        .eq("user_id", user_id)
        .single();

      if (profile) {
        userFirstName = profile.first_name || "";
        contextSnippet += `\n\n# PROFIL UTILISATEUR\n- Prénom: ${profile.first_name || 'inconnu'}\n- Plan: ${profile.plan_type || "free"}\n- Crédits: ${profile.credits_balance ?? 0}\n- Statut: ${profile.subscription_status || "aucun"}\n- Email: ${profile.email || 'inconnu'}\n`;
      }

      // Fetch tracked sites with detailed scores
      const { data: sites } = await sb
        .from("tracked_sites")
        .select("id, domain, display_name, geo_score, seo_score, llm_visibility_score, created_at")
        .eq("user_id", user_id)
        .limit(10);

      if (sites && sites.length > 0) {
        contextSnippet += "\n# SITES TRACKÉS DE L'UTILISATEUR\n";
        for (const s of sites) {
          contextSnippet += `- ${s.display_name || s.domain}: GEO ${s.geo_score ?? "N/A"}, SEO ${s.seo_score ?? "N/A"}%, LLM ${s.llm_visibility_score ?? "N/A"}% (ajouté le ${s.created_at?.slice(0, 10)})\n`;
        }

        // For each site, fetch latest audit & crawl info
        for (const s of sites.slice(0, 5)) {
          // Latest audit
          const { data: audits } = await sb
            .from("audit_raw_data")
            .select("audit_type, created_at")
            .eq("domain", s.domain)
            .eq("user_id", user_id)
            .order("created_at", { ascending: false })
            .limit(3);

          if (audits?.length) {
            contextSnippet += `  Audits ${s.domain}: ${audits.map(a => `${a.audit_type} (${a.created_at?.slice(0, 10)})`).join(', ')}\n`;
          } else {
            contextSnippet += `  ⚠ ${s.domain}: aucun audit réalisé\n`;
          }

          // Latest crawl
          const { data: crawls } = await sb
            .from("site_crawls")
            .select("status, total_pages, crawled_pages, avg_score, created_at")
            .eq("domain", s.domain)
            .order("created_at", { ascending: false })
            .limit(1);

          if (crawls?.length) {
            const c = crawls[0];
            contextSnippet += `  Dernier crawl ${s.domain}: ${c.status} (${c.created_at?.slice(0, 10)}) — ${c.crawled_pages}/${c.total_pages} pages, score moy: ${c.avg_score || '?'}\n`;
          } else {
            contextSnippet += `  ⚠ ${s.domain}: aucun crawl réalisé\n`;
          }

          // Action plans
          const { data: plans } = await sb
            .from("action_plans")
            .select("title, audit_type, is_archived, created_at")
            .eq("url", s.domain)
            .eq("user_id", user_id)
            .eq("is_archived", false)
            .limit(3);

          if (plans?.length) {
            contextSnippet += `  Plans d'action actifs ${s.domain}: ${plans.map(p => p.title).join(', ')}\n`;
          }

          // Injected scripts
          const { data: scripts } = await sb
            .from("audit_recommendations_registry")
            .select("title, is_resolved, category")
            .eq("domain", s.domain)
            .eq("user_id", user_id)
            .limit(5);

          if (scripts?.length) {
            const applied = scripts.filter(sc => sc.is_resolved).length;
            contextSnippet += `  Scripts ${s.domain}: ${applied}/${scripts.length} recommandations appliquées\n`;
          }

          // GSC connection check
          const { data: gsc } = await sb
            .from("gsc_history_log")
            .select("week_start_date")
            .eq("tracked_site_id", s.id)
            .order("week_start_date", { ascending: false })
            .limit(1);

          if (!gsc?.length) {
            contextSnippet += `  ⚠ ${s.domain}: pas de données GSC connectées\n`;
          }
        }
      }
    } catch (e) {
      console.error("Context enrichment error:", e);
    }

    // Count user messages to detect escalation threshold
    const userMessageCount = messages.filter((m: any) => m.role === "user").length;
    let escalationHint = "";
    if (userMessageCount >= 3) {
      escalationHint = `\n\n# INSTRUCTION SPÉCIALE\nL'utilisateur a posé ${userMessageCount} questions. S'il semble insatisfait ou a encore des questions non résolues, propose-lui d'être rappelé rapidement : "Souhaitez-vous être rappelé par un membre de l'équipe ? Si oui, communiquez-moi votre numéro de téléphone (cette donnée sera effacée sous 48h)."`;
    }

    // Greeting hint with first name
    let greetingHint = "";
    if (userFirstName && userMessageCount <= 1) {
      greetingHint = `\n\nNote: Le prénom de l'utilisateur est "${userFirstName}". Utilise-le naturellement dans ta première réponse.`;
    }

    const fullSystemPrompt = SYSTEM_PROMPT + contextSnippet + escalationHint + greetingHint;

    const aiMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages.slice(-20),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: false,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Service temporairement surchargé, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service IA temporairement indisponible." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || "Je transmets votre question à l'équipe.";

    // Enforce 1000 char limit
    if (reply.length > 1000) {
      reply = reply.substring(0, 997) + "...";
    }

    // Save conversation + quality scoring
    let savedConvId = conversation_id;
    try {
      const allMessages = [...messages, { role: "assistant", content: reply }];
      const userMsgCount = allMessages.filter((m: any) => m.role === "user").length;

      // ── Intent detection via keywords ──
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      const intentKeywords = lastUserMsg
        .toLowerCase()
        .replace(/[^a-zà-ÿ0-9\s]/g, "")
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
        .slice(0, 10);

      // Detect repeated intent (same keywords appearing in multiple user messages)
      const allUserMsgs = messages.filter((m: any) => m.role === "user").map((m: any) => m.content.toLowerCase());
      let repeatedIntentCount = 0;
      if (allUserMsgs.length >= 2) {
        const prevKeywords = new Set(
          allUserMsgs.slice(0, -1).join(" ").replace(/[^a-zà-ÿ0-9\s]/g, "").split(/\s+/).filter((w: string) => w.length > 3)
        );
        const overlap = intentKeywords.filter((kw: string) => prevKeywords.has(kw));
        if (overlap.length >= 3) repeatedIntentCount = allUserMsgs.length - 1;
      }

      // Detect intent category
      const msgLower = lastUserMsg.toLowerCase();
      let detectedIntent = "general";
      if (msgLower.match(/où|comment accéder|trouver|cherche|onglet|bouton|menu|page/)) detectedIntent = "navigation";
      else if (msgLower.match(/score|geo|seo|llm|citation|sentiment/)) detectedIntent = "score";
      else if (msgLower.match(/crédit|abonnement|prix|tarif|payer|facturer/)) detectedIntent = "billing";
      else if (msgLower.match(/bug|erreur|marche pas|bloqué|problème/)) detectedIntent = "bug";
      else if (msgLower.match(/crawl|scan|audit|analyse/)) detectedIntent = "feature";

      // Extract suggested route from agent reply
      const routeMatch = reply.match(/https:\/\/crawlers\.fr(\/[a-z0-9\-/]*)/i);
      const suggestedRoute = routeMatch ? routeMatch[1] : null;

      const escalatedToPhone = reply.includes("numéro de téléphone") || reply.includes("rappelé");

      if (conversation_id) {
        await sb
          .from("sav_conversations")
          .update({
            messages: allMessages,
            message_count: allMessages.length,
            escalated: userMsgCount >= 3,
          })
          .eq("id", conversation_id);
      } else {
        const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();

        const { data: newConv } = await sb
          .from("sav_conversations")
          .insert({
            user_id,
            user_email: prof?.email || null,
            messages: allMessages,
            message_count: allMessages.length,
            escalated: userMsgCount >= 3,
          })
          .select("id")
          .single();

        savedConvId = newConv?.id;
      }

      // ── Upsert quality score ──
      if (savedConvId) {
        // Calculate precision score
        let precisionScore = 50;
        if (userMsgCount <= 2) precisionScore += 20;  // Short conv = likely resolved
        precisionScore -= repeatedIntentCount * 20;    // Repeated intent = bad
        if (escalatedToPhone) precisionScore -= 50;    // Phone escalation = failure
        precisionScore = Math.max(0, Math.min(100, precisionScore));

        // Upsert (update if exists, insert if not)
        const { data: existing } = await sb
          .from("sav_quality_scores")
          .select("id")
          .eq("conversation_id", savedConvId)
          .maybeSingle();

        if (existing) {
          await sb.from("sav_quality_scores").update({
            message_count: userMsgCount,
            repeated_intent_count: repeatedIntentCount,
            escalated_to_phone: escalatedToPhone,
            precision_score: precisionScore,
            detected_intent: detectedIntent,
            intent_keywords: intentKeywords,
            suggested_route: suggestedRoute,
          }).eq("id", existing.id);
        } else {
          await sb.from("sav_quality_scores").insert({
            conversation_id: savedConvId,
            user_id,
            message_count: userMsgCount,
            repeated_intent_count: repeatedIntentCount,
            escalated_to_phone: escalatedToPhone,
            precision_score: precisionScore,
            detected_intent: detectedIntent,
            intent_keywords: intentKeywords,
            suggested_route: suggestedRoute,
          });
        }
      }

      if (!conversation_id && savedConvId) {
        return new Response(JSON.stringify({ reply, conversation_id: savedConvId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error("Save conversation error:", e);
    }

    return new Response(JSON.stringify({ reply, conversation_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sav-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
