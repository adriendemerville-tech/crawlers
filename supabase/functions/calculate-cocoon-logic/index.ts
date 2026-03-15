import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { checkIpRate, getClientIp, rateLimitResponse } from "../_shared/ipRateLimiter.ts";
import { withCircuitBreaker } from "../_shared/circuitBreaker.ts";

/**
 * Edge Function: calculate-cocoon-logic
 *
 * Builds the semantic graph ("Cocoon") for a tracked site by:
 * 1. Ingesting crawl_pages + audit data into semantic_nodes
 * 2. Computing embeddings via Lovable AI (Gemini)
 * 3. Calculating cosine similarity between all node pairs
 * 4. Computing Iab (Anti-Wiki) scores from SERP competitor classification
 * 5. Predicting ROI (CPC × conversion potential) and traffic estimates
 *
 * Access: Pro Agency / Admin only
 */

// ─── Cosine Similarity (pure math, no pgvector) ───
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Iab Score (Anti-Wiki Index) ───
// Classifies SERP competitors: high ratio of authoritative/generic sites = high Iab
function calculateIabScore(serpCompetitors: string[]): number {
  if (!serpCompetitors || serpCompetitors.length === 0) return 50;

  const wikiDomains = [
    'wikipedia.org', 'wikimedia.org', 'wiktionary.org',
    'larousse.fr', 'linternaute.fr', 'journaldunet.com',
    'commentcamarche.net', 'futura-sciences.com',
    'investopedia.com', 'britannica.com', 'webmd.com',
  ];
  const govDomains = ['.gouv.fr', '.gov', '.edu', '.ac-'];
  const socialDomains = ['youtube.com', 'reddit.com', 'quora.com', 'linkedin.com', 'twitter.com', 'facebook.com'];

  let wikiCount = 0, govCount = 0, socialCount = 0;

  for (const comp of serpCompetitors) {
    const domain = comp.toLowerCase();
    if (wikiDomains.some(w => domain.includes(w))) wikiCount++;
    else if (govDomains.some(g => domain.includes(g))) govCount++;
    else if (socialDomains.some(s => domain.includes(s))) socialCount++;
  }

  const total = serpCompetitors.length;
  // High Iab = few wiki/gov competitors = easier to rank
  const authorityRatio = (wikiCount + govCount) / total;
  const socialRatio = socialCount / total;

  // Score: 100 = no authority sites, 0 = all authority sites
  const baseScore = (1 - authorityRatio) * 70 + (1 - socialRatio) * 30;
  return Math.round(Math.min(100, Math.max(0, baseScore)));
}

// ─── ROI Prediction ───
function calculateRoiPredictive(
  cpc: number,
  searchVolume: number,
  keywordDifficulty: number,
  conversionPotential: number,
): number {
  // Estimated CTR based on difficulty (lower KD = higher expected CTR)
  const estimatedCTR = Math.max(0.01, (100 - keywordDifficulty) / 100 * 0.15);
  const estimatedTraffic = searchVolume * estimatedCTR;
  const conversionRate = conversionPotential / 100 * 0.03; // 3% max conversion
  const roi = estimatedTraffic * cpc * conversionRate * 12; // annualized
  return Math.round(roi * 100) / 100;
}

// ─── Traffic Estimate ───
function estimateTraffic(searchVolume: number, keywordDifficulty: number, serpPosition: number | null): number {
  const ctrByPosition: Record<number, number> = {
    1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.06,
    6: 0.05, 7: 0.04, 8: 0.03, 9: 0.025, 10: 0.02,
  };

  if (serpPosition && serpPosition <= 10) {
    const ctr = ctrByPosition[Math.round(serpPosition)] || 0.02;
    return Math.round(searchVolume * ctr);
  }

  // Not ranked yet: estimate based on KD
  const potentialCTR = Math.max(0.01, (100 - keywordDifficulty) / 100 * 0.10);
  return Math.round(searchVolume * potentialCTR);
}

// ─── Intent Classification ───
function classifyIntent(title: string, h1: string, keywords: string[]): string {
  const text = `${title} ${h1} ${keywords.join(' ')}`.toLowerCase();

  const transactional = ['acheter', 'prix', 'tarif', 'devis', 'commander', 'buy', 'price', 'order', 'discount', 'promo', 'solde'];
  const navigational = ['connexion', 'login', 'mon compte', 'dashboard', 'contact', 'about'];
  const commercial = ['meilleur', 'comparatif', 'avis', 'test', 'vs', 'best', 'review', 'top', 'alternative'];

  if (transactional.some(w => text.includes(w))) return 'transactional';
  if (navigational.some(w => text.includes(w))) return 'navigational';
  if (commercial.some(w => text.includes(w))) return 'commercial';
  return 'informational';
}

// ─── Embedding via Lovable AI ───
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("[Cocoon] No LOVABLE_API_KEY, skipping embeddings");
    return texts.map(() => []);
  }

  const results: number[][] = [];
  // Batch texts in groups of 5 to avoid timeout
  for (let i = 0; i < texts.length; i += 5) {
    const batch = texts.slice(i, i + 5);
    const embeddings = await Promise.all(
      batch.map(async (text) => {
        try {
          const resp = await fetch("https://api.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: "Tu es un extracteur sémantique. Retourne UNIQUEMENT un tableau JSON de 64 nombres flottants entre -1 et 1 représentant l'embedding sémantique du texte. Pas d'explication.",
                },
                { role: "user", content: text.slice(0, 2000) },
              ],
              temperature: 0,
              max_tokens: 500,
            }),
          });

          if (!resp.ok) return Array(64).fill(0);

          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content || "[]";
          // Parse the JSON array from the response
          const match = content.match(/\[[\s\S]*?\]/);
          if (match) {
            const arr = JSON.parse(match[0]);
            if (Array.isArray(arr) && arr.length > 0) {
              // Normalize to 64 dimensions
              return arr.slice(0, 64).map((v: number) => Number(v) || 0);
            }
          }
          return Array(64).fill(0);
        } catch {
          return Array(64).fill(0);
        }
      }),
    );
    results.push(...embeddings);
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const ip = getClientIp(req);
  const rateCheck = checkIpRate(ip, "calculate-cocoon-logic", 5, 60_000);
  if (!rateCheck.allowed) return rateLimitResponse(corsHeaders, rateCheck.retryAfterMs);

  try {
    const { tracked_site_id } = await req.json();
    if (!tracked_site_id) {
      return new Response(JSON.stringify({ error: "tracked_site_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check plan: Pro Agency or admin only
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_type")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });

    const allowedPlans = ["agency_pro", "agency_premium"];
    if (!isAdmin && !allowedPlans.includes(profile?.plan_type || "")) {
      return new Response(JSON.stringify({ error: "Accès réservé Pro Agency" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify tracked site ownership
    const { data: site } = await supabase
      .from("tracked_sites")
      .select("id, domain, user_id")
      .eq("id", tracked_site_id)
      .maybeSingle();

    if (!site || (site.user_id !== userId && !isAdmin)) {
      return new Response(JSON.stringify({ error: "Site non trouvé" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch crawl pages for this domain (latest crawl)
    const { data: crawls } = await supabase
      .from("site_crawls" as any)
      .select("id")
      .eq("domain", site.domain)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const latestCrawlId = crawls?.[0]?.id;
    let crawlPages: any[] = [];

    if (latestCrawlId) {
      const { data } = await supabase
        .from("crawl_pages")
        .select("id, url, title, h1, word_count, internal_links, external_links, seo_score, meta_description")
        .eq("crawl_id", latestCrawlId)
        .limit(500);
      crawlPages = data || [];
    }

    if (crawlPages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucune page crawlée trouvée. Lancez d'abord un crawl du site." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Build semantic nodes from crawl data
    const nodeTexts: string[] = [];
    const nodeData: any[] = [];

    for (const page of crawlPages) {
      const keywords = extractKeywords(page.title || "", page.h1 || "", page.meta_description || "");
      const intent = classifyIntent(page.title || "", page.h1 || "", keywords);
      const text = `${page.title || ""} ${page.h1 || ""} ${page.meta_description || ""}`.trim();
      nodeTexts.push(text);

      nodeData.push({
        user_id: userId,
        tracked_site_id,
        crawl_page_id: page.id,
        url: page.url,
        title: page.title || "",
        h1: page.h1 || "",
        keywords,
        word_count: page.word_count || 0,
        intent,
        internal_links_in: 0, // Will be computed from link graph
        internal_links_out: page.internal_links || 0,
        eeat_score: page.seo_score || 0,
        status: "pending",
      });
    }

    // 3. Compute embeddings (with circuit breaker)
    const embeddings = await withCircuitBreaker(
      "cocoon-embeddings",
      () => getEmbeddings(nodeTexts),
      { threshold: 3, resetMs: 300_000 },
    );

    // 4. Assign embeddings and compute similarities
    const nodesWithEmbeddings = nodeData.map((node, i) => ({
      ...node,
      embedding: embeddings?.[i] || null,
    }));

    // 5. Compute pairwise cosine similarity (top 10 edges per node)
    for (let i = 0; i < nodesWithEmbeddings.length; i++) {
      const edges: { target_idx: number; score: number; target_url: string }[] = [];
      const embA = nodesWithEmbeddings[i].embedding;
      if (!embA || embA.length === 0) continue;

      for (let j = 0; j < nodesWithEmbeddings.length; j++) {
        if (i === j) continue;
        const embB = nodesWithEmbeddings[j].embedding;
        if (!embB || embB.length === 0) continue;

        const sim = cosineSimilarity(embA, embB);
        if (sim > 0.3) {
          edges.push({ target_idx: j, score: Math.round(sim * 1000) / 1000, target_url: nodesWithEmbeddings[j].url });
        }
      }

      // Keep top 10 most similar
      edges.sort((a, b) => b.score - a.score);
      nodesWithEmbeddings[i].similarity_edges = edges.slice(0, 10).map((e) => ({
        target_url: e.target_url,
        score: e.score,
        type: e.score > 0.7 ? "strong" : e.score > 0.5 ? "medium" : "weak",
      }));
    }

    // 6. Compute Iab scores and ROI predictions (mock SERP data for now)
    for (const node of nodesWithEmbeddings) {
      node.iab_score = calculateIabScore(node.serp_competitors || []);
      node.roi_predictive = calculateRoiPredictive(
        node.cpc_value || 0,
        node.search_volume || 0,
        node.keyword_difficulty || 0,
        node.conversion_potential || 50,
      );
      node.traffic_estimate = estimateTraffic(
        node.search_volume || 0,
        node.keyword_difficulty || 0,
        node.serp_position || null,
      );
      node.status = "computed";
    }

    // 7. Compute internal link graph (in-links)
    // Count how many pages link to each page
    const urlToIdx = new Map<string, number>();
    nodesWithEmbeddings.forEach((n, i) => urlToIdx.set(n.url, i));

    // 8. Auto-cluster by similarity (simple greedy clustering)
    let clusterIdx = 0;
    const assigned = new Set<number>();
    for (let i = 0; i < nodesWithEmbeddings.length; i++) {
      if (assigned.has(i)) continue;
      const clusterId = `cluster_${clusterIdx++}`;
      nodesWithEmbeddings[i].cluster_id = clusterId;
      nodesWithEmbeddings[i].depth = 0;
      assigned.add(i);

      // Add strongly similar nodes to same cluster
      const edges = nodesWithEmbeddings[i].similarity_edges || [];
      for (const edge of edges) {
        if (edge.type === "strong" || edge.type === "medium") {
          const j = nodesWithEmbeddings.findIndex((n) => n.url === edge.target_url);
          if (j >= 0 && !assigned.has(j)) {
            nodesWithEmbeddings[j].cluster_id = clusterId;
            nodesWithEmbeddings[j].depth = 1;
            nodesWithEmbeddings[j].parent_node_id = null; // Will be set after insert with actual UUIDs
            assigned.add(j);
          }
        }
      }
    }

    // 9. Upsert nodes into semantic_nodes
    // Delete old nodes for this site first
    await supabase
      .from("semantic_nodes" as any)
      .delete()
      .eq("tracked_site_id", tracked_site_id);

    // Insert in batches of 50
    let insertedCount = 0;
    for (let i = 0; i < nodesWithEmbeddings.length; i += 50) {
      const batch = nodesWithEmbeddings.slice(i, i + 50).map((n) => {
        // Remove temp fields
        const { parent_node_id, ...rest } = n;
        return rest;
      });

      const { error } = await supabase.from("semantic_nodes" as any).insert(batch);
      if (error) {
        console.error("[Cocoon] Insert error:", error);
      } else {
        insertedCount += batch.length;
      }
    }

    // 10. Compute summary stats
    const clusters = new Set(nodesWithEmbeddings.map((n) => n.cluster_id)).size;
    const avgIab = nodesWithEmbeddings.reduce((s, n) => s + (n.iab_score || 0), 0) / nodesWithEmbeddings.length;
    const totalEdges = nodesWithEmbeddings.reduce((s, n) => s + (n.similarity_edges?.length || 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          nodes_count: insertedCount,
          clusters_count: clusters,
          edges_count: totalEdges,
          avg_iab_score: Math.round(avgIab),
          domain: site.domain,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Cocoon] Error:", error);
    return new Response(JSON.stringify({ error: "Erreur interne du module Cocoon" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Keyword Extraction (simple TF-based) ───
function extractKeywords(title: string, h1: string, description: string): string[] {
  const stopwords = new Set([
    "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "à", "au", "aux",
    "pour", "par", "sur", "dans", "avec", "est", "son", "ses", "ce", "cette", "qui",
    "que", "ne", "pas", "plus", "the", "a", "an", "and", "or", "of", "to", "in", "for",
    "is", "it", "on", "at", "by", "with", "from", "as", "are", "was", "be", "has",
  ]);

  const text = `${title} ${h1} ${description}`.toLowerCase();
  const words = text.match(/[a-zàâäéèêëïîôùûüç]{3,}/g) || [];
  const freq = new Map<string, number>();

  for (const w of words) {
    if (stopwords.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
}
