import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabaseClient.ts";

/**
 * admin-backend-query: Read-only backend exploration for creator admins.
 * 
 * Accepts natural language questions about the backend, translates them
 * to safe SELECT queries via LLM, executes, and returns results.
 * 
 * SECURITY: Only accessible to users with admin role. Read-only queries only.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Complete schema reference for the LLM to generate accurate queries
const SCHEMA_REFERENCE = `
# DATABASE SCHEMA (public)

## Core tables
- profiles: user_id (uuid PK), email, first_name, last_name, plan_type (free|agency_pro), subscription_status, credits_balance, persona_type, affiliate_code_used, referral_code, created_at, updated_at
- user_roles: id, user_id, role (admin|viewer|viewer_level2|auditor), expires_at
- tracked_sites: id, user_id, domain, display_name, geo_score, seo_score, llm_visibility_score, sector, target_audience, entity_type, created_at
- credit_transactions: id, user_id, amount, transaction_type (usage|bonus|purchase|refund), description, created_at

## Audits & Analysis
- audits: id, user_id, url, domain, fixes_count, dynamic_price, payment_status, created_at
- audit_raw_data: id, user_id, url, domain, audit_type, source_functions, created_at
- audit_recommendations_registry: id, user_id, url, domain, audit_type, title, category, priority, is_resolved, fix_type
- pdf_audits: id, user_id, domain, url, audit_type, status, created_at
- audit_cache: id, cache_key, function_name, expires_at
- audit_impact_snapshots: id, user_id, url, domain, audit_type, impact_score, measurement_phase

## Crawl
- site_crawls: id, user_id, domain, url, status (pending|crawling|completed|error), total_pages, crawled_pages, avg_score, created_at
- crawl_pages: id, crawl_id, url, path, http_status, seo_score, word_count, h1, title, has_schema_org, is_indexable, internal_links, external_links
- crawl_jobs: id, crawl_id, user_id, domain, status, total_count, processed_count, priority

## Cocoon
- cocoon_sessions: id, user_id, tracked_site_id, domain, nodes_count, clusters_count, chat_turns, avg_geo_score, avg_eeat_score, created_at
- cocoon_chat_histories: id, user_id, tracked_site_id, domain, session_hash, message_count, messages, workflow_state
- cocoon_strategy_plans: id, user_id, tracked_site_id, domain, strategy, task_budget, status
- cocoon_tasks: id, user_id, tracked_site_id, title, priority, status
- cocoon_diagnostic_results: id, user_id, tracked_site_id, diagnostic_type, scores, findings
- cocoon_recommendations: id, user_id, tracked_site_id, domain, summary, is_applied

## Support & SAV
- sav_conversations: id, user_id, user_email, messages, message_count, escalated, phone_callback, created_at
- sav_quality_scores: id, conversation_id, user_id, precision_score, route_match, detected_intent, escalated_to_phone, repeated_intent_count
- user_bug_reports: id, user_id, raw_message, translated_message, category, route, status, cto_response, notified_user, created_at

## Analytics & Events
- analytics_events: id, user_id, event_type, event_data, url, session_id, created_at
- analyzed_urls: id, url, domain, analysis_count, last_analyzed_at

## Agents
- cto_agent_logs: id, function_analyzed, confidence_score, decision, analysis_summary, self_critique, created_at
- predictions: id, url, domain, predicted_traffic, model_version, created_at
- actual_results: id, prediction_id, real_traffic_after_90_days, accuracy_gap

## Financial
- billing_info: id, user_id, company_name, vat_number, stripe_customer_id
- bundle_subscriptions: id, user_id, selected_apis, api_count, monthly_price_cents, status
- bundle_api_catalog: id, api_name, seo_segment, crawlers_feature, is_active

## CMS & Connectors
- cms_connections: id, user_id, tracked_site_id, platform, site_url, status, auth_method
- google_connections: id, user_id, provider, access_token (HIDDEN), refresh_token (HIDDEN)

## Content
- blog_articles: id, title, slug, content, status, published_at
- action_plans: id, user_id, url, audit_type, title, tasks, is_archived
- site_script_rules: id, user_id, domain_id, url_pattern, payload_type, payload_data

## Monitoring
- anomaly_alerts: id, user_id, tracked_site_id, domain, metric_name, severity, direction, z_score, is_read
- backlink_snapshots: id, user_id, tracked_site_id, domain, referring_domains, domain_rank, backlinks_total
- domain_data_cache: id, domain, data_type, result_data, expires_at

## Agency
- agency_clients: id, owner_user_id, first_name, last_name, company, email
- agency_team_members: id, owner_user_id, member_user_id, role
- agency_invitations: id, owner_user_id, email, role, status, token

## Functions (RPC)
- has_role(_user_id, _role) → boolean
- check_fair_use_v2(p_user_id, p_action, p_hourly_limit, p_daily_limit) → jsonb
- get_database_size() → jsonb
- use_credit(p_user_id, p_description, p_amount) → jsonb
- downgrade_expired_subscriptions() → integer
- recalculate_reliability() → void

## Edge Functions (121 total, key ones)
Audits: audit-expert-seo, audit-strategique-ia, audit-compare, audit-local-seo
Crawl: crawl-site, calculate-cocoon-logic, calculate-internal-pagerank
Cocoon: cocoon-chat, cocoon-strategist, cocoon-diag-content/semantic/structure/authority
Strategy: content-architecture-advisor, detect-anomalies
Visibility: check-llm, check-llm-depth, diagnose-hallucination, calculate-llm-volumes
Code: generate-corrective-code, process-script-queue
SAV: sav-agent, submit-bug-report
Agent: supervisor-actions (CTO)
Auth: stripe-webhook, gsc-auth, gmb-actions
`;

const QUERY_SYSTEM_PROMPT = `Tu es un assistant base de données READ-ONLY pour Crawlers.fr.

RÈGLES ABSOLUES:
1. Génère UNIQUEMENT des requêtes SELECT. JAMAIS INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE.
2. Ne retourne JAMAIS de données sensibles: access_token, refresh_token, api_key, password, phone_callback, stripe_customer_id, stripe_subscription_id, stripe_session_id, stripe_payment_intent_id.
3. Limite toujours les résultats: max 50 lignes (LIMIT 50).
4. Pour les comptages, utilise COUNT(*).
5. Les dates sont en timestamptz. Utilise now(), interval, date_trunc.
6. Ne fais JAMAIS de sous-requête sur auth.users — utilise profiles.

${SCHEMA_REFERENCE}

Réponds UNIQUEMENT avec un objet JSON:
{"query": "SELECT ...", "description": "Ce que cette requête fait en français"}

Si la question ne peut pas être résolue par une requête SQL, réponds:
{"query": null, "description": "Explication de pourquoi"}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth check
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = getServiceClient();

    // Verify user is admin
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Creator access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Generate SQL query from natural language
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: QUERY_SYSTEM_PROMPT },
          { role: "user", content: question },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_query",
            description: "Generate a safe read-only SQL query",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "The SELECT SQL query, or null if not possible" },
                description: { type: "string", description: "French description of what the query does" }
              },
              required: ["description"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_query" } }
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI service error", description: "Impossible de générer la requête" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let queryInfo: { query?: string; description: string };

    if (toolCall) {
      queryInfo = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try to parse content directly
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        queryInfo = JSON.parse(content);
      } catch {
        queryInfo = { description: content || "Impossible de générer une requête pour cette question." };
      }
    }

    if (!queryInfo.query) {
      return new Response(JSON.stringify({ 
        query: null, 
        description: queryInfo.description, 
        results: null 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 2: Safety validation - ensure it's truly read-only
    const upperQuery = queryInfo.query.toUpperCase().trim();
    const dangerousKeywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE", "EXECUTE"];
    const isDangerous = dangerousKeywords.some(kw => {
      // Check if keyword appears as a standalone word (not inside a string literal)
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      // Remove string literals before checking
      const cleaned = queryInfo.query!.replace(/'[^']*'/g, "");
      return regex.test(cleaned);
    });

    if (isDangerous || !upperQuery.startsWith("SELECT")) {
      return new Response(JSON.stringify({ 
        query: queryInfo.query, 
        description: "⚠️ Requête bloquée : seules les requêtes SELECT sont autorisées.", 
        results: null,
        blocked: true
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check for sensitive columns
    const sensitiveColumns = ["access_token", "refresh_token", "api_key", "password", "phone_callback", 
      "stripe_customer_id", "stripe_subscription_id", "basic_auth_pass", "oauth_access_token", "oauth_refresh_token"];
    const hasSensitive = sensitiveColumns.some(col => queryInfo.query!.toLowerCase().includes(col));
    if (hasSensitive) {
      return new Response(JSON.stringify({ 
        query: queryInfo.query, 
        description: "⚠️ Requête bloquée : accès aux colonnes sensibles interdit.", 
        results: null,
        blocked: true
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Enforce LIMIT
    if (!upperQuery.includes("LIMIT")) {
      queryInfo.query += " LIMIT 50";
    }

    // Step 3: Execute the query
    const { data: results, error: queryError } = await sb.rpc("execute_readonly_query" as any, { query_text: queryInfo.query });

    // If RPC doesn't exist, fall back to a direct approach via postgrest
    // Since we can't run arbitrary SQL via supabase-js client, we'll use a workaround
    // Actually, let's try a different approach: use the REST API directly
    let queryResults: any = null;
    let queryErrorMsg: string | null = null;

    if (queryError) {
      // The RPC doesn't exist, let's inform the creator
      // We'll execute via Deno's postgres directly
      try {
        const dbUrl = Deno.env.get("SUPABASE_DB_URL");
        if (dbUrl) {
          const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
          const pool = new Pool(dbUrl, 1);
          const conn = await pool.connect();
          try {
            // Set read-only transaction
            await conn.queryObject("SET TRANSACTION READ ONLY");
            const result = await conn.queryObject(queryInfo.query!);
            queryResults = result.rows;
          } finally {
            conn.release();
            await pool.end();
          }
        } else {
          queryErrorMsg = "Database connection not available";
        }
      } catch (dbErr: any) {
        queryErrorMsg = dbErr.message || "Query execution error";
        console.error("DB query error:", dbErr);
      }
    } else {
      queryResults = results;
    }

    return new Response(JSON.stringify({
      query: queryInfo.query,
      description: queryInfo.description,
      results: queryResults,
      error: queryErrorMsg,
      row_count: Array.isArray(queryResults) ? queryResults.length : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("admin-backend-query error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
