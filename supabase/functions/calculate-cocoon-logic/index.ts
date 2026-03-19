import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { checkIpRate, getClientIp, rateLimitResponse } from "../_shared/ipRateLimiter.ts";
import { trackEdgeFunctionError } from "../_shared/tokenTracker.ts";
import { logSilentError } from "../_shared/silentErrorLogger.ts";

/**
 * Edge Function: calculate-cocoon-logic
 *
 * Builds the semantic graph ("Cocoon") for a tracked site:
 * 1. Ingests crawl_pages data into semantic_nodes
 * 2. Computes TF-IDF vectors (deterministic, no LLM)
 * 3. Calculates cosine similarity between node pairs
 * 4. Enriches with audit data (CPC, search volume, KD)
 * 5. Computes Iab (Anti-Wiki) scores, ROI predictions, traffic estimates
 * 6. Clusters via connected components with similarity threshold
 *
 * Access: Pro Agency / Admin only
 */

// ─── TF-IDF Vectorization ───

const STOPWORDS = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "à", "au", "aux",
  "pour", "par", "sur", "dans", "avec", "est", "son", "ses", "ce", "cette", "qui",
  "que", "ne", "pas", "plus", "the", "a", "an", "and", "or", "of", "to", "in", "for",
  "is", "it", "on", "at", "by", "with", "from", "as", "are", "was", "be", "has",
  "nous", "vous", "ils", "elles", "leur", "leurs", "tout", "tous", "très", "bien",
  "aussi", "mais", "donc", "car", "alors", "comme", "this", "that", "these", "those",
  "not", "but", "can", "will", "our", "your", "they", "have", "been", "had", "were",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-zàâäéèêëïîôùûüç]{3,}/g) || [])
    .filter((w) => !STOPWORDS.has(w));
}

/** Build TF-IDF vectors for a corpus of documents */
function buildTfIdfVectors(docs: string[][]): Map<string, number>[] {
  const n = docs.length;
  if (n === 0) return [];

  // Document frequency: how many docs contain each term
  const df = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set(doc);
    for (const term of seen) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  // Build TF-IDF vector per document
  return docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const term of doc) {
      tf.set(term, (tf.get(term) || 0) + 1);
    }

    const tfidf = new Map<string, number>();
    for (const [term, count] of tf) {
      const termDf = df.get(term) || 1;
      // TF = log(1 + count), IDF = log(N / df)
      const score = Math.log(1 + count) * Math.log(n / termDf);
      if (score > 0) tfidf.set(term, score);
    }
    return tfidf;
  });
}

/** Cosine similarity between two sparse TF-IDF vectors */
function cosineSimilaritySparse(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  // Iterate over smaller map for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [term, valA] of smaller) {
    const valB = larger.get(term);
    if (valB !== undefined) dot += valA * valB;
  }

  for (const v of a.values()) magA += v * v;
  for (const v of b.values()) magB += v * v;

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Iab Score (Anti-Wiki Index) ───
function calculateIabScore(serpCompetitors: string[]): number {
  if (!serpCompetitors || serpCompetitors.length === 0) return 50;

  const wikiDomains = [
    "wikipedia.org", "wikimedia.org", "wiktionary.org",
    "larousse.fr", "linternaute.fr", "journaldunet.com",
    "commentcamarche.net", "futura-sciences.com",
    "investopedia.com", "britannica.com", "webmd.com",
  ];
  const govDomains = [".gouv.fr", ".gov", ".edu", ".ac-"];
  const socialDomains = ["youtube.com", "reddit.com", "quora.com", "linkedin.com", "twitter.com", "facebook.com"];

  let wikiCount = 0, govCount = 0, socialCount = 0;
  for (const comp of serpCompetitors) {
    const domain = comp.toLowerCase();
    if (wikiDomains.some((w) => domain.includes(w))) wikiCount++;
    else if (govDomains.some((g) => domain.includes(g))) govCount++;
    else if (socialDomains.some((s) => domain.includes(s))) socialCount++;
  }

  const total = serpCompetitors.length;
  const authorityRatio = (wikiCount + govCount) / total;
  const socialRatio = socialCount / total;
  const baseScore = (1 - authorityRatio) * 70 + (1 - socialRatio) * 30;
  return Math.round(Math.min(100, Math.max(0, baseScore)));
}

// ─── ROI Prediction ───
function calculateRoiPredictive(cpc: number, volume: number, kd: number, convPotential: number): number {
  const estimatedCTR = Math.max(0.01, (100 - kd) / 100 * 0.15);
  const traffic = volume * estimatedCTR;
  const convRate = convPotential / 100 * 0.03;
  return Math.round(traffic * cpc * convRate * 12 * 100) / 100;
}

// ─── Traffic Estimate ───
function estimateTraffic(volume: number, kd: number, serpPos: number | null): number {
  const ctrByPos: Record<number, number> = {
    1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.06,
    6: 0.05, 7: 0.04, 8: 0.03, 9: 0.025, 10: 0.02,
  };
  if (serpPos && serpPos <= 10) {
    return Math.round(volume * (ctrByPos[Math.round(serpPos)] || 0.02));
  }
  return Math.round(volume * Math.max(0.01, (100 - kd) / 100 * 0.10));
}

// ─── Intent Classification ───
function classifyIntent(title: string, h1: string, keywords: string[]): string {
  const text = `${title} ${h1} ${keywords.join(" ")}`.toLowerCase();
  const transactional = ["acheter", "prix", "tarif", "devis", "commander", "buy", "price", "order", "discount", "promo"];
  const navigational = ["connexion", "login", "mon compte", "dashboard", "contact", "about"];
  const commercial = ["meilleur", "comparatif", "avis", "test", "vs", "best", "review", "top", "alternative"];

  if (transactional.some((w) => text.includes(w))) return "transactional";
  if (navigational.some((w) => text.includes(w))) return "navigational";
  if (commercial.some((w) => text.includes(w))) return "commercial";
  return "informational";
}

// ─── Page Type Classification ───
function classifyPageType(url: string, title: string, h1: string, override?: string | null): string {
  // Manual override takes precedence
  if (override) return override;

  const path = url.toLowerCase();
  const text = `${title} ${h1}`.toLowerCase();

  // Homepage
  if (path === "/" || path.endsWith(".com") || path.endsWith(".fr") || path.match(/^https?:\/\/[^/]+\/?$/)) return "homepage";
  
  // Blog / editorial
  if (path.match(/\/blog|\/article|\/actualit|\/news|\/post|\/journal|\/magazine/)) return "blog";
  
  // Product / service
  if (path.match(/\/produit|\/product|\/shop|\/boutique|\/item|\/service|\/solution|\/offre|\/offer|\/outil|\/tool|\/feature|\/fonctionnalit/)) return "produit";
  
  // Category / collection
  if (path.match(/\/categor|\/collection|\/rayon|\/rubrique|\/section|\/tag|\/thematique/)) return "catégorie";
  
  // FAQ / support
  if (path.match(/\/faq|\/aide|\/help|\/support|\/assistance|\/centre-aide|\/knowledge/)) return "faq";
  
  // Contact
  if (path.match(/\/contact|\/nous-contacter|\/get-in-touch|\/contacto/)) return "contact";
  
  // Pricing
  if (path.match(/\/tarif|\/pricing|\/prix|\/plan|\/abonnement|\/subscription|\/forfait/)) return "tarifs";
  
  // Legal
  if (path.match(/\/mention|\/legal|\/cgu|\/cgv|\/politique|\/privacy|\/terms|\/conditions|\/confidentialit|\/cookie|\/rgpd|\/gdpr/)) return "légal";
  
  // About
  if (path.match(/\/a-propos|\/about|\/qui-sommes|\/equipe|\/team|\/notre-histoire|\/mission|\/valeurs/)) return "à propos";
  
  // Guide / tutorial (path-based)
  if (path.match(/\/guide|\/tutoriel|\/tutorial|\/how-to|\/comment|\/ressource|\/resource|\/documentation|\/docs|\/wiki|\/learn/)) return "guide";
  
  // Text-based fallback for guide
  if (text.match(/guide|tutoriel|tutorial|comment|how to|paso a paso/)) return "guide";
  
  // SaaS-specific patterns (text-based)
  if (text.match(/dashboard|tableau de bord|console|panel|admin/)) return "produit";
  if (text.match(/intégration|integration|api|webhook|plugin|extension|connector/)) return "produit";
  if (text.match(/cas d'usage|use case|caso de uso|témoignage|testimonial|case stud/)) return "blog";
  if (text.match(/changelog|release|mise à jour|roadmap|version/)) return "blog";
  if (text.match(/partenaire|partner|affiliate|affilié/)) return "à propos";
  if (text.match(/carrière|career|recrutement|hiring|job|emploi/)) return "à propos";
  if (text.match(/démo|demo|essai|trial|gratuit|free/)) return "tarifs";

  return "page";
}

// ─── Connected Components Clustering ───
function clusterByComponents(
  adjacency: Map<number, number[]>,
  nodeCount: number,
): Map<number, string> {
  const visited = new Set<number>();
  const clusters = new Map<number, string>();
  let clusterIdx = 0;

  for (let i = 0; i < nodeCount; i++) {
    if (visited.has(i)) continue;

    const clusterId = `cluster_${clusterIdx++}`;
    // BFS
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      clusters.set(curr, clusterId);

      for (const neighbor of adjacency.get(curr) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return clusters;
}

// ─── Keyword Extraction (TF-based) ───
function extractKeywords(title: string, h1: string, description: string): string[] {
  const words = tokenize(`${title} ${h1} ${description}`);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // ─── Auth ───
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Plan check ───
    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabase.from("profiles").select("plan_type").eq("user_id", userId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);

    if (!isAdmin && !["agency_pro", "agency_premium"].includes(profile?.plan_type || "")) {
      return new Response(JSON.stringify({ error: "Accès réservé Pro Agency" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Verify site ownership ───
    const { data: site } = await supabase
      .from("tracked_sites").select("id, domain, user_id")
      .eq("id", tracked_site_id).maybeSingle();

    if (!site || (site.user_id !== userId && !isAdmin)) {
      return new Response(JSON.stringify({ error: "Site non trouvé" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 1. Check prerequisites: crawl + strategic audit ───
    const { data: crawls } = await supabase
      .from("site_crawls" as any).select("id")
      .eq("domain", site.domain).eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1);

    const latestCrawlId = crawls?.[0]?.id;
    if (!latestCrawlId) {
      return new Response(
        JSON.stringify({ error: "Aucune page crawlée trouvée. Lancez d'abord un crawl du site." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cap at 100 pages for optimal TF-IDF precision (covers 100% of ~70% FR sites)
    const MAX_COCOON_PAGES = 100;

    // First count total pages to inform user of truncation
    const { count: totalCrawlPages } = await supabase
      .from("crawl_pages")
      .select("id", { count: "exact", head: true })
      .eq("crawl_id", latestCrawlId);

    const { data: crawlPages } = await supabase
      .from("crawl_pages")
      .select("id, url, title, h1, word_count, internal_links, external_links, seo_score, meta_description, crawl_depth, created_at, http_status, anchor_texts")
      .eq("crawl_id", latestCrawlId)
      .order("crawl_depth", { ascending: true })
      .limit(MAX_COCOON_PAGES);

    // Filter out error pages (403, 500, etc.) — only keep 200/301/302
    const validPages = (crawlPages || []).filter((p: any) => {
      const status = p.http_status || 200;
      return status >= 200 && status < 400;
    });

    if (!validPages.length) {
      return new Response(
        JSON.stringify({ error: "Aucune page valide trouvée (toutes les pages crawlées retournent des erreurs HTTP). Le site bloque peut-être les robots. Relancez le crawl ou vérifiez la configuration du site." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 2. Enrich from existing audit data ───
    const { data: auditData } = await supabase
      .from("audits")
      .select("url, audit_data")
      .eq("domain", site.domain)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Build a lookup: url → audit metrics
    const auditLookup = new Map<string, any>();
    for (const audit of auditData || []) {
      if (!audit.url || !audit.audit_data) continue;
      const data = typeof audit.audit_data === "string" ? JSON.parse(audit.audit_data) : audit.audit_data;
      auditLookup.set(audit.url.replace(/\/+$/, "").toLowerCase(), data);
    }

    // ─── 3. Build node data ───
    const nodeData: any[] = [];
    const tokenizedDocs: string[][] = [];

    for (const page of validPages) {
      const keywords = extractKeywords(page.title || "", page.h1 || "", page.meta_description || "");
      const intent = classifyIntent(page.title || "", page.h1 || "", keywords);
      const pageType = classifyPageType(page.url, page.title || "", page.h1 || "", page.page_type_override);
      
      // Enrich tokenization: title + h1 + meta + keywords + URL path segments + anchor texts
      const pathSegments = new URL(page.url).pathname.split(/[\/\-_]/).filter(s => s.length >= 3).join(" ");
      const anchorTexts = (page.anchor_texts || [])
        .filter((a: any) => a.type === "internal")
        .map((a: any) => a.text || "")
        .join(" ");
      const fullText = `${page.title || ""} ${page.h1 || ""} ${page.meta_description || ""} ${keywords.join(" ")} ${pathSegments} ${anchorTexts}`;
      tokenizedDocs.push(tokenize(fullText));

      // Try to enrich from audit data
      const normalizedUrl = page.url.replace(/\/+$/, "").toLowerCase();
      const audit = auditLookup.get(normalizedUrl);
      const serpData = audit?.serp_competitors || audit?.competitors || [];
      const cpc = audit?.cpc_value || audit?.cpc || 0;
      const volume = audit?.search_volume || audit?.volume || 0;
      const kd = audit?.keyword_difficulty || audit?.kd || 50;
      const serpPosition = audit?.serp_position || audit?.position || null;

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
        internal_links_in: 0,
        internal_links_out: page.internal_links || 0,
        eeat_score: page.seo_score || 0,
        crawl_depth: page.crawl_depth || 0,
        page_type: pageType,
        page_updated_at: page.created_at || null,
        // Enriched from audit
        cpc_value: cpc,
        search_volume: volume,
        keyword_difficulty: kd,
        serp_position: serpPosition,
        serp_competitors: serpData,
        conversion_potential: intent === "transactional" ? 80 : intent === "commercial" ? 60 : 30,
        status: "pending",
      });
    }

    // ─── 4. Compute TF-IDF vectors & cosine similarity ───
    console.log(`[Cocoon] Computing TF-IDF for ${tokenizedDocs.length} documents`);
    const tfidfVectors = buildTfIdfVectors(tokenizedDocs);

    // Similarity threshold for edges
    const STRONG_THRESHOLD = 0.4;
    const MEDIUM_THRESHOLD = 0.2;
    const WEAK_THRESHOLD = 0.1;

    // Build adjacency for clustering (medium+ edges)
    const adjacency = new Map<number, number[]>();
    for (let i = 0; i < nodeData.length; i++) adjacency.set(i, []);

    for (let i = 0; i < tfidfVectors.length; i++) {
      const edges: { idx: number; score: number }[] = [];

      for (let j = i + 1; j < tfidfVectors.length; j++) {
        const sim = cosineSimilaritySparse(tfidfVectors[i], tfidfVectors[j]);
        if (sim >= WEAK_THRESHOLD) {
          edges.push({ idx: j, score: sim });

          // Build adjacency for clustering (medium+ only)
          if (sim >= MEDIUM_THRESHOLD) {
            adjacency.get(i)!.push(j);
            adjacency.get(j)!.push(i);
          }
        }
      }

      // Keep top 10 most similar
      edges.sort((a, b) => b.score - a.score);
      nodeData[i].similarity_edges = edges.slice(0, 10).map((e) => ({
        target_url: nodeData[e.idx].url,
        score: Math.round(e.score * 1000) / 1000,
        type: e.score >= STRONG_THRESHOLD ? "strong" : e.score >= MEDIUM_THRESHOLD ? "medium" : "weak",
      }));
    }

    // ─── 4b. Fallback: structural edges from URL path similarity + internal links ───
    const totalTfidfEdges = nodeData.reduce((s: number, n: any) => s + (n.similarity_edges?.length || 0), 0);
    console.log(`[Cocoon] TF-IDF edges: ${totalTfidfEdges}`);

    if (totalTfidfEdges === 0) {
      console.log(`[Cocoon] No TF-IDF edges found, building structural + link-based edges`);
      
      // Build URL index for anchor-based linking
      const urlToIdx = new Map<string, number>();
      for (let i = 0; i < nodeData.length; i++) {
        urlToIdx.set(nodeData[i].url.replace(/\/+$/, "").toLowerCase(), i);
      }

      for (let i = 0; i < nodeData.length; i++) {
        const edges: { idx: number; score: number; type: string }[] = [];
        const pageI = validPages[i];
        const pathI = new URL(nodeData[i].url).pathname.split("/").filter(Boolean);

        // Structural: URL path prefix similarity
        for (let j = 0; j < nodeData.length; j++) {
          if (i === j) continue;
          const pathJ = new URL(nodeData[j].url).pathname.split("/").filter(Boolean);
          const commonPrefix = pathI.filter((seg, idx) => pathJ[idx] === seg).length;
          const maxLen = Math.max(pathI.length, pathJ.length, 1);
          const structScore = commonPrefix / maxLen;
          if (structScore >= 0.3) {
            edges.push({ idx: j, score: Math.round(structScore * 1000) / 1000, type: "structural" });
          }
        }

        // Link-based: pages that link to each other via anchor_texts
        const anchors = pageI.anchor_texts || [];
        for (const anchor of anchors) {
          if (anchor.type !== "internal") continue;
          const targetUrl = (anchor.href || "").replace(/\/+$/, "").toLowerCase();
          const targetIdx = urlToIdx.get(targetUrl);
          if (targetIdx !== undefined && targetIdx !== i) {
            // Check not already in edges
            if (!edges.some(e => e.idx === targetIdx)) {
              edges.push({ idx: targetIdx, score: 0.5, type: "link" });
            }
          }
        }

        // Merge with existing (empty) similarity_edges
        edges.sort((a, b) => b.score - a.score);
        const existing = nodeData[i].similarity_edges || [];
        const merged = [...existing, ...edges.slice(0, 10)].slice(0, 10);
        nodeData[i].similarity_edges = merged.map((e: any) => ({
          target_url: e.target_url || nodeData[e.idx]?.url,
          score: e.score,
          type: e.type || "structural",
        }));

        // Also update adjacency for clustering
        for (const edge of edges) {
          if (edge.score >= 0.3) {
            adjacency.get(i)!.push(edge.idx);
            adjacency.get(edge.idx)!.push(i);
          }
        }
      }
    }

    // ─── 5. Cluster via connected components ───
    const clusterMap = clusterByComponents(adjacency, nodeData.length);

    for (let i = 0; i < nodeData.length; i++) {
      nodeData[i].cluster_id = clusterMap.get(i) || `cluster_singleton_${i}`;
      // Depth: 0 = cluster seed (first found), 1 = member
      const clusterNodes = [...clusterMap.entries()].filter(([, c]) => c === nodeData[i].cluster_id);
      nodeData[i].depth = clusterNodes[0]?.[0] === i ? 0 : 1;
    }

    // ─── 6. Compute Iab, ROI, traffic ───
    for (const node of nodeData) {
      node.iab_score = calculateIabScore(node.serp_competitors || []);
      node.roi_predictive = calculateRoiPredictive(
        node.cpc_value || 0,
        node.search_volume || 0,
        node.keyword_difficulty || 50,
        node.conversion_potential || 50,
      );
      node.traffic_estimate = estimateTraffic(
        node.search_volume || 0,
        node.keyword_difficulty || 50,
        node.serp_position || null,
      );
      node.status = "computed";

      // Clean up temp fields before insert
      delete node.serp_competitors;
      delete node.serp_position;
      delete node.conversion_potential;
    }

    // ─── 7. Upsert into semantic_nodes ───
    await supabase
      .from("semantic_nodes" as any)
      .delete()
      .eq("tracked_site_id", tracked_site_id);

    let insertedCount = 0;
    for (let i = 0; i < nodeData.length; i += 50) {
      const batch = nodeData.slice(i, i + 50);
      const { error } = await supabase.from("semantic_nodes" as any).insert(batch);
      if (error) {
        console.error("[Cocoon] Insert error:", error);
        await logSilentError("calculate-cocoon-logic", "insert-batch", error.message, {
          severity: "high",
          impact: "data_loss",
          metadata: { batch_start: i, batch_size: batch.length },
        }).catch(() => {});
      } else {
        insertedCount += batch.length;
      }
    }

    // ─── 8. Summary stats ───
    const clusters = new Set(nodeData.map((n) => n.cluster_id)).size;
    const avgIab = nodeData.reduce((s, n) => s + (n.iab_score || 0), 0) / nodeData.length;
    const totalEdges = nodeData.reduce((s, n) => s + (n.similarity_edges?.length || 0), 0);

    console.log(`[Cocoon] Done: ${insertedCount} nodes, ${clusters} clusters, ${totalEdges} edges`);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          nodes_count: insertedCount,
          clusters_count: clusters,
          edges_count: totalEdges,
          avg_iab_score: Math.round(avgIab),
          domain: site.domain,
          total_crawl_pages: totalCrawlPages || insertedCount,
          max_pages: MAX_COCOON_PAGES,
          truncated: (totalCrawlPages || 0) > MAX_COCOON_PAGES,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Cocoon] Error:", error);
    await trackEdgeFunctionError("calculate-cocoon-logic", error instanceof Error ? error.message : String(error)).catch((e) => logSilentError("calculate-cocoon-logic", "track-error", e, { severity: "medium", impact: "tracking_miss" }));
    return new Response(JSON.stringify({ error: "Erreur interne du module Cocoon" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
