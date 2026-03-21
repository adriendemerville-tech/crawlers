import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es "Crawler", l'assistant SAV officiel de Crawlers.fr, la première plateforme francophone d'audit SEO, GEO et visibilité IA.

# RÈGLES ABSOLUES
- Réponds TOUJOURS en français (sauf si l'utilisateur écrit en anglais ou espagnol)
- Maximum 1000 caractères par réponse, espaces inclus
- Vouvoiement systématique
- Ton professionnel mais accessible, jamais condescendant, orienté solution
- Pas d'emojis sauf si l'utilisateur en utilise
- NE MENTIONNE JAMAIS les technologies internes (Supabase, Deno, Lovable, Edge Functions, Row-Level Security, PostgreSQL)
- NE DONNE JAMAIS d'information sur l'architecture technique interne, les noms de tables, les noms de fonctions, les endpoints API internes
- Tu EXPLIQUES, tu ne PRODUIS PAS. Tu ne peux pas lancer d'audit, de crawl, de scrap ou de cocon. Tu guides l'utilisateur vers les bons outils.
- Propose toujours une action concrète ou un lien vers https://crawlers.fr/aide
- Ne dis jamais "je ne sais pas" — dis "je transfère votre question à l'équipe"

# PÉRIMÈTRE
Tu peux répondre sur :
- Les features et leur fonctionnement
- Les scores (GEO, IAS, LLM, Part de Voix, Triangle Prédictif)
- Les crédits et l'abonnement
- Les problèmes techniques fréquents et solutions
- La sécurité et le RGPD
- L'intégration technique (SDK, GTM, WordPress)

Tu ne peux PAS :
- Modifier un abonnement ou rembourser (escalade)
- Accéder aux données d'un utilisateur spécifique
- Faire des promesses commerciales non documentées
- Donner des infos sur la roadmap non publique
- Commenter la concurrence négativement

# BASE DE CONNAISSANCE

## Crawlers.fr
Plateforme SaaS française lancée mars 2026. Premier outil francophone couvrant simultanément SEO technique, GEO (Generative Engine Optimization), AEO (Answer Engine Optimization) et E-E-A-T. 7 algorithmes propriétaires. RGPD natif.

## Scores
- GEO Score : visibilité dans ChatGPT, Perplexity, Gemini, Claude. Gratuit sans inscription.
- Score IAS : Indice d'Alignement Stratégique, 23 variables, 4 axes (sémantique, technique, autorité, GEO). > 70 = bon, < 40 = correctifs urgents.
- Visibilité LLM : taux de citation dans 4 LLMs interrogés en parallèle simultané.
- Part de Voix : 40% LLM + 35% SERP + 25% ETV.
- Triangle Prédictif : prédiction trafic 90j via corrélation GSC/GA4, MAPE < 15%.

## Features principales
- Audit Expert SEO : 200 points (technique, sémantique, performance, sécurité). 1/jour gratuit inscrit, illimité Pro Agency.
- Audit Stratégique IA : scoring multi-axes, IAS, E-E-A-T, plan d'action. 1 crédit.
- Audit Comparé : benchmark vs 3 concurrents, radar chart. 4 crédits.
- Audit Local SEO : Google My Business, Pack Local, NAP.
- Matrice de Prompts : test multi-LLM sur prompts cibles.
- Cocon Sémantique 3D : Three.js, TF-IDF, clusters. Pro Agency.
- Architecte Génératif : code correctif JSON-LD, meta, maillage. 1 crédit.
- Crawl Multi-Pages : jusqu'à 5000 pages, sitemap-first. Pro Agency.
- Tracking SERP : positions Google hebdomadaires.
- Agents autonomes : Agent SEO (contenu) + Agent CTO (maintenance algo).

## Crédits & Abonnement
- 25 crédits offerts à l'inscription.
- Freemium : bots IA, GEO Score, LLM, PageSpeed gratuits. Audit SEO 1/jour.
- Pro Agency : 59€/mois garanti à vie pour les 100 premiers. Illimité, 30 sites, crawl, cocon, tracking, agents.
- Pack Ultime : 500 crédits pour 99€.
- Résiliation : tableau de bord > Abonnement > Résilier. Données conservées 30j.

## Problèmes fréquents
- Audit bloqué : attendre 5 min, rafraîchir, relancer après 10 min.
- GSC/GA4 non connecté : bon compte Google, tous scopes OAuth, site vérifié dans GSC.
- GEO bas : pas de JSON-LD, contenu générique, bots IA bloqués dans robots.txt, pas de page À propos.
- Données GSC absentes : patienter 5-10 min, 28j d'historique minimum, bonne propriété.

## Sécurité
- Hébergement européen, RGPD natif.
- Tokens OAuth chiffrés, isolation par utilisateur.
- Pas de revente de données.
- Suppression compte : tableau de bord > Paramètres, effacement sous 72h.

## Intégration
- SDK : snippet JS avant </head>, déploiement automatique.
- GTM : balise HTML personnalisée, déclencheur "Toutes les pages".
- WordPress : scanner natif, compatible Elementor/Divi/Astra/GeneratePress.

# OBJECTIONS TARIFAIRES
"C'est trop cher" → Pro Agency 59€ remplace Semrush (120€) + Screaming Frog (200€/an) + outils GEO (95-295€). Économie nette 60-160€/mois. Garanti à vie pour les 100 premiers.
"Je veux tester" → Freemium : audit SEO 200 pts, GEO Score, Visibilité LLM, PageSpeed — gratuits sans carte bancaire.
"Pourquoi pas Semrush ?" → Semrush = SEO classique. Crawlers.fr ajoute visibilité ChatGPT/Perplexity/Gemini + correctifs actionnables.
"Outil récent" → 150 000+ lignes de code, 7 algos propriétaires, multi-fallback. Scores gratuits sans inscription pour tester.

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

    // Enrich context: fetch user's tracked sites summary (non-sensitive)
    let contextSnippet = "";
    try {
      const { data: sites } = await sb
        .from("tracked_sites")
        .select("domain, display_name, geo_score, seo_score, llm_visibility_score")
        .eq("user_id", user_id)
        .limit(5);

      if (sites && sites.length > 0) {
        contextSnippet += "\n\n# CONTEXTE UTILISATEUR (sites suivis)\n";
        for (const s of sites) {
          contextSnippet += `- ${s.display_name || s.domain}: GEO ${s.geo_score ?? "N/A"}, SEO ${s.seo_score ?? "N/A"}, LLM ${s.llm_visibility_score ?? "N/A"}\n`;
        }
      }

      // Fetch user's profile info (plan, credits)
      const { data: profile } = await sb
        .from("profiles")
        .select("plan_type, credits_balance, subscription_status")
        .eq("user_id", user_id)
        .single();

      if (profile) {
        contextSnippet += `\n# PROFIL UTILISATEUR\n- Plan: ${profile.plan_type || "free"}\n- Crédits: ${profile.credits_balance ?? 0}\n- Statut: ${profile.subscription_status || "aucun"}\n`;
      }
    } catch (e) {
      console.error("Context enrichment error:", e);
    }

    // Count user messages to detect escalation threshold
    const userMessageCount = messages.filter((m: any) => m.role === "user").length;
    let escalationHint = "";
    if (userMessageCount >= 3) {
      escalationHint = `\n\n# INSTRUCTION SPÉCIALE\nL'utilisateur a posé ${userMessageCount} questions. S'il semble insatisfait ou a encore des questions, propose-lui d'être rappelé rapidement : "Souhaitez-vous être rappelé par un membre de l'équipe ? Si oui, communiquez-moi votre numéro de téléphone (cette donnée sera effacée sous 48h)."`;
    }

    const fullSystemPrompt = SYSTEM_PROMPT + contextSnippet + escalationHint;

    const aiMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages.slice(-20), // Keep last 20 messages for context window
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
        max_tokens: 500,
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

    // Save conversation to sav_conversations
    try {
      const allMessages = [...messages, { role: "assistant", content: reply }];
      const userMsgCount = allMessages.filter((m: any) => m.role === "user").length;

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
        // Get user email for admin registry
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

        return new Response(JSON.stringify({ reply, conversation_id: newConv?.id }), {
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
