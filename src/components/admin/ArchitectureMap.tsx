import React, { useState, useMemo, useCallback } from "react";

// ── Domain data ──────────────────────────────────────────────
interface Domain {
  color: string;
  tables: string[];
  functions: string[];
}

const domains: Record<string, Domain> = {
  CORE: { color: "#1D3557", tables: ["profiles", "tracked_sites", "architect_workbench", "seasonal_context"], functions: [] },
  COCOON: { color: "#2A9D8F", tables: ["cocoon_sessions", "cocoon_diagnostic_results", "cocoon_recommendations", "cocoon_tasks", "cocoon_auto_links", "cocoon_batch_operations", "cocoon_chat_histories", "cocoon_errors", "cocoon_strategy_plans", "cocoon_architect_drafts", "cocoon_linking_exclusions", "cocoon_nodes", "semantic_nodes"], functions: ["cocoon-chat", "cocoon-strategist", "cocoon-auto-linking", "cocoon-bulk-auto-linking", "cocoon-deploy-links", "cocoon-batch-deploy", "cocoon-diag-authority", "cocoon-diag-content", "cocoon-diag-semantic", "cocoon-diag-structure", "cocoon-diag-subdomains", "calculate-cocoon-logic", "persist-cocoon-session"] },
  AUDIT: { color: "#E63946", tables: ["audits", "audit_raw_data", "audit_cache", "audit_recommendations_registry", "audit_impact_snapshots", "pdf_audits"], functions: ["audit-expert-seo", "audit-local-seo", "audit-matrice", "audit-strategique-ia", "audit-compare", "audit-code-quality-backend", "audit-code-quality-frontend", "expert-audit", "save-audit", "measure-audit-impact", "snapshot-audit-impact"] },
  CRAWL: { color: "#457B9D", tables: ["site_crawls", "crawl_pages", "crawl_jobs", "crawl_page_backlinks", "crawl_index_history"], functions: ["crawl-site", "process-crawl-queue", "strategic-crawl", "check-crawlers"] },
  "AGENTS IA": { color: "#6A4C93", tables: ["agent_cto_directives", "agent_seo_directives", "agent_ux_directives", "agent_supervisor_directives", "agent_ux_logs", "cto_code_proposals", "cto_agent_logs", "seo_agent_logs", "supervisor_logs", "supervisor_cycles", "parmenion_decision_log"], functions: ["agent-cto", "agent-seo", "agent-ux", "dispatch-agent-directives", "supervisor-actions", "parmenion-orchestrator", "parmenion-feedback", "deploy-code-proposal", "rollback-code-proposal", "ingest-agent"] },
  CONTENT: { color: "#F4A261", tables: ["content_generation_logs", "content_deploy_snapshots", "content_monitor_log", "content_gap_results", "content_performance_correlations", "content_prompt_presets", "content_prompt_templates", "content_requirements_matrix", "seo_page_drafts", "prompt_registry", "prompt_deployments"], functions: ["content-architecture-advisor", "content-freshness", "content-monitor", "content-pruning", "content-perf-aggregator", "analyze-content-gap", "check-content-quality", "generate-corrective-code", "smart-recommendations"] },
  "SERP & VISIBILITY": { color: "#264653", tables: ["serp_snapshots", "keyword_rankings", "keyword_universe", "gsc_keyword_rankings", "gsc_daily_positions", "gsc_weekly_snapshots", "gsc_page_stats", "gsc_history_log", "llm_visibility_scores", "llm_visibility_snapshots", "llm_depth_conversations", "llm_test_executions"], functions: ["fetch-serp-kpis", "refresh-serp-all", "serpapi-actions", "calculate-sov", "calculate-llm-visibility", "calculate-llm-volumes", "check-llm", "check-llm-depth", "refresh-llm-visibility-all", "check-direct-answer", "diagnose-hallucination"] },
  "GSC & GA4": { color: "#1982C4", tables: ["google_connections", "gsc_connections", "ga4_connections", "ga4_daily_metrics", "ga4_behavioral_metrics", "ga4_top_pages", "ga4_history_log"], functions: ["gsc-auth", "fetch-gsc-daily", "fetch-ga4-data", "google-ads-connector"] },
  AUTOPILOT: { color: "#8AC926", tables: ["autopilot_configs", "autopilot_modification_log"], functions: ["autopilot-engine"] },
  "GEO & LOCAL": { color: "#FF595E", tables: ["geo_visibility_snapshots", "gmb_locations", "gmb_performance", "gmb_posts", "gmb_reviews", "gmb_local_competitors", "gmb_power_snapshots"], functions: ["check-geo", "snapshot-geo-visibility", "gmb-actions", "gmb-optimization", "gmb-local-competitors", "gmb-places-autocomplete", "gbp-auth"] },
  "CMS & DEPLOY": { color: "#E9C46A", tables: ["cms_connections", "code_deployment_history", "site_script_rules", "site_script_rules_history", "injection_monitor_log", "injection_error_logs"], functions: ["cms-patch-content", "cms-publish-draft", "cms-push-code", "cms-push-draft", "cms-push-redirect", "injection-monitor", "verify-injection", "wpsync", "scan-wp", "serve-client-script", "get-final-script", "watchdog-scripts"] },
  MARINA: { color: "#6D6875", tables: ["marina_prospects", "marina_api_keys", "marina_training_data", "prospect_outreach_queue"], functions: ["marina", "prospect-pipeline", "view-marina-report"] },
  SOCIAL: { color: "#B5838D", tables: ["social_posts", "social_accounts", "social_post_metrics"], functions: ["generate-social-content", "generate-social-image", "publish-to-social", "manage-social-comments", "translate-social-post", "fetch-social-stats", "shorten-social-link"] },
  PROFIL: { color: "#FFB4A2", tables: ["user_sessions", "user_stats_history", "user_bug_reports", "verification_codes"], functions: ["ensure-profile", "delete-account", "session-heartbeat", "auth-actions"] },
  ABONNEMENT: { color: "#E5989B", tables: ["credit_transactions", "affiliate_codes", "referral_rewards", "revenue_events"], functions: ["create-checkout", "create-credit-checkout", "apply-affiliate", "apply-referral", "track-payment"] },
  BLOG: { color: "#118AB2", tables: ["blog_articles", "quiz_questions"], functions: ["generate-blog-from-news", "fetch-news", "felix-seo-quiz"] },
  PAIEMENT: { color: "#06D6A0", tables: ["stripe_payments", "paid_api_calls", "billing_info"], functions: ["stripe-webhook", "stripe-actions"] },
  AGENCE: { color: "#FFD166", tables: ["agency_clients", "agency_client_sites", "agency_team_members", "agency_invitations"], functions: ["manage-team", "share-actions", "share-report"] },
};

// Directed connections: [source, target]
const solidLinks: [string, string][] = [
  ["AUDIT", "SERP & VISIBILITY"], ["AUTOPILOT", "AGENTS IA"], ["AUTOPILOT", "CONTENT"],
  ["AUTOPILOT", "CMS & DEPLOY"], ["AUDIT", "CRAWL"], ["MARINA", "CRAWL"],
  ["AUDIT", "GEO & LOCAL"], ["SERP & VISIBILITY", "COCOON"],
];

const dashedLinks: [string, string][] = [
  ["AGENTS IA", "AUDIT"], ["AGENTS IA", "CONTENT"], ["AGENTS IA", "CORE"],
  ["AGENTS IA", "PROFIL"], ["AGENTS IA", "BLOG"], ["CONTENT", "AUDIT"],
  ["CONTENT", "SERP & VISIBILITY"], ["CONTENT", "CORE"], ["ABONNEMENT", "CORE"],
  ["AUDIT", "CORE"], ["AUDIT", "GEO & LOCAL"], ["AUDIT", "SERP & VISIBILITY"],
  ["PROFIL", "AUDIT"], ["PROFIL", "PAIEMENT"], ["PROFIL", "BLOG"],
  ["PROFIL", "CMS & DEPLOY"], ["PROFIL", "COCOON"], ["PROFIL", "GEO & LOCAL"],
  ["PROFIL", "CORE"], ["PROFIL", "CONTENT"], ["PROFIL", "ABONNEMENT"],
  ["AUTOPILOT", "CORE"], ["AUTOPILOT", "AUDIT"], ["AUTOPILOT", "AGENTS IA"],
  ["COCOON", "AUDIT"], ["COCOON", "CRAWL"], ["COCOON", "CORE"],
  ["SERP & VISIBILITY", "CORE"], ["SERP & VISIBILITY", "PROFIL"],
  ["CMS & DEPLOY", "BLOG"], ["CMS & DEPLOY", "COCOON"], ["CMS & DEPLOY", "CONTENT"],
  ["CMS & DEPLOY", "CORE"], ["COCOON", "SERP & VISIBILITY"], ["CONTENT", "COCOON"],
  ["CONTENT", "ABONNEMENT"], ["CONTENT", "CRAWL"], ["CRAWL", "GSC & GA4"],
  ["CRAWL", "CORE"], ["ABONNEMENT", "AUDIT"], ["PROFIL", "AGENCE"],
  ["PROFIL", "CRAWL"], ["PROFIL", "GSC & GA4"], ["AGENTS IA", "CMS & DEPLOY"],
  ["SERP & VISIBILITY", "CRAWL"], ["GSC & GA4", "CORE"], ["GSC & GA4", "ABONNEMENT"],
  ["GSC & GA4", "SERP & VISIBILITY"], ["GEO & LOCAL", "GSC & GA4"],
  ["GEO & LOCAL", "CORE"], ["SOCIAL", "CORE"], ["CMS & DEPLOY", "AUDIT"],
  ["AGENCE", "CORE"], ["MARINA", "AUDIT"], ["MARINA", "CRAWL"],
  ["MARINA", "CORE"], ["MARINA", "COCOON"], ["AGENTS IA", "COCOON"],
  ["AGENCE", "ABONNEMENT"], ["PAIEMENT", "AUDIT"], ["PAIEMENT", "CORE"],
  ["PAIEMENT", "ABONNEMENT"],
];

// ── Layout ───────────────────────────────────────────────────
const SVG_W = 1400;
const SVG_H = 1000;
const CX = SVG_W / 2;
const CY = SVG_H / 2 - 20;

const minorNames = ["PROFIL", "ABONNEMENT", "BLOG", "PAIEMENT", "AGENCE"];
const majorNames = Object.keys(domains).filter(d => d !== "CORE" && !minorNames.includes(d));

// Core 2x2 grid
const CORE_W = 140;
const CORE_H = 65;
const CORE_GAP = 10;
const coreNames = ["profiles", "tracked_sites", "architect_workbench", "seasonal_context"];

interface CardRect { x: number; y: number; w: number; h: number; }

function computePositions() {
  const positions: Record<string, CardRect> = {};

  // Core cards (grouped as one logical unit)
  positions.CORE = {
    x: CX - CORE_W - CORE_GAP / 2,
    y: CY - CORE_H - CORE_GAP / 2,
    w: 2 * CORE_W + CORE_GAP,
    h: 2 * CORE_H + CORE_GAP,
  };

  // Major cards in ellipse
  const CW = 160, CH = 130;
  const ERX = 520, ERY = 340;
  majorNames.forEach((dn, i) => {
    const angle = (i * 360 / majorNames.length - 90) * Math.PI / 180;
    positions[dn] = {
      x: CX + ERX * Math.cos(angle) - CW / 2,
      y: CY + ERY * Math.sin(angle) - CH / 2,
      w: CW, h: CH,
    };
  });

  // Minor cards in bottom row
  const MW = 130, MH = 80, GAP = 14;
  const total = minorNames.length * MW + (minorNames.length - 1) * GAP;
  const startX = (SVG_W - total) / 2;
  minorNames.forEach((dn, i) => {
    positions[dn] = { x: startX + i * (MW + GAP), y: SVG_H - MH - 20, w: MW, h: MH };
  });

  return positions;
}

function rectCenter(r: CardRect): [number, number] {
  return [r.x + r.w / 2, r.y + r.h / 2];
}

function rectAnchor(r: CardRect, tx: number, ty: number): [number, number] {
  const [cx, cy] = rectCenter(r);
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const scale = 1 / Math.max(Math.abs(dx) / (r.w / 2), Math.abs(dy) / (r.h / 2));
  return [cx + dx * scale, cy + dy * scale];
}

// ── Adjacency map ────────────────────────────────────────────
function buildAdjacency() {
  const adj: Record<string, Set<string>> = {};
  const allDomains = Object.keys(domains);
  allDomains.forEach(d => (adj[d] = new Set()));
  [...solidLinks, ...dashedLinks].forEach(([a, b]) => {
    adj[a]?.add(b);
    adj[b]?.add(a);
  });
  return adj;
}

// ── Component ────────────────────────────────────────────────
const ArchitectureMap: React.FC = () => {
  const [hovered, setHovered] = useState<string | null>(null);
  const positions = useMemo(computePositions, []);
  const adjacency = useMemo(buildAdjacency, []);

  const isActive = useCallback((name: string) => {
    if (!hovered) return false;
    return name === hovered || adjacency[hovered]?.has(name);
  }, [hovered, adjacency]);

  const isLinkActive = useCallback((a: string, b: string) => {
    if (!hovered) return false;
    return (hovered === a || hovered === b) && (adjacency[hovered]?.has(a) || adjacency[hovered]?.has(b) || hovered === a || hovered === b);
  }, [hovered, adjacency]);

  return (
    <div className="w-full bg-[#0B0F19] rounded-xl overflow-hidden select-none" style={{ aspectRatio: `${SVG_W}/${SVG_H}` }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full">
        <defs>
          {/* Shimmer particle for active links */}
          {[...solidLinks, ...dashedLinks].map(([src, tgt], i) => {
            const rA = positions[src], rB = positions[tgt];
            if (!rA || !rB) return null;
            const [cx2, cy2] = rectCenter(rB);
            const [ax, ay] = rectAnchor(rA, cx2, cy2);
            const [cx1, cy1] = rectCenter(rA);
            const [bx, by] = rectAnchor(rB, cx1, cy1);
            const id = `path-${i}`;
            return (
              <path key={id} id={id} d={`M${ax},${ay} L${bx},${by}`} fill="none" stroke="none" />
            );
          })}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Links ── */}
        {solidLinks.map(([src, tgt], i) => {
          const rA = positions[src], rB = positions[tgt];
          if (!rA || !rB) return null;
          const [cx2, cy2] = rectCenter(rB);
          const [ax, ay] = rectAnchor(rA, cx2, cy2);
          const [cx1, cy1] = rectCenter(rA);
          const [bx, by] = rectAnchor(rB, cx1, cy1);
          const active = isLinkActive(src, tgt);
          const color = active ? (domains[src]?.color || "#fff") : "#1a1f2e";
          return (
            <g key={`solid-${i}`}>
              <line x1={ax} y1={ay} x2={bx} y2={by}
                stroke={color} strokeWidth={active ? 2.5 : 1}
                opacity={active ? 1 : 0.25}
                filter={active ? "url(#glow)" : undefined}
                style={{ transition: "stroke 0.3s, opacity 0.3s" }}
              />
              {active && (
                <circle r="4" fill="#fff" opacity="0.9" filter="url(#glow)">
                  <animateMotion dur="1.5s" repeatCount="indefinite" path={`M${ax},${ay} L${bx},${by}`} />
                </circle>
              )}
            </g>
          );
        })}

        {dashedLinks.map(([src, tgt], i) => {
          const rA = positions[src], rB = positions[tgt];
          if (!rA || !rB) return null;
          const [cx2, cy2] = rectCenter(rB);
          const [ax, ay] = rectAnchor(rA, cx2, cy2);
          const [cx1, cy1] = rectCenter(rA);
          const [bx, by] = rectAnchor(rB, cx1, cy1);
          const active = isLinkActive(src, tgt);
          const color = active ? (domains[src]?.color || "#fff") : "#1a1f2e";
          return (
            <g key={`dash-${i}`}>
              <line x1={ax} y1={ay} x2={bx} y2={by}
                stroke={color} strokeWidth={active ? 1.8 : 0.8}
                strokeDasharray="8 5"
                opacity={active ? 0.85 : 0.15}
                filter={active ? "url(#glow)" : undefined}
                style={{ transition: "stroke 0.3s, opacity 0.3s" }}
              />
              {active && (
                <circle r="3" fill={color} opacity="0.7">
                  <animateMotion dur="2s" repeatCount="indefinite" path={`M${ax},${ay} L${bx},${by}`} />
                </circle>
              )}
            </g>
          );
        })}

        {/* ── Cards ── */}
        {Object.entries(domains).map(([name, d]) => {
          const pos = positions[name];
          if (!pos) return null;
          const active = isActive(name);
          const isHov = hovered === name;
          const isMinor = minorNames.includes(name);
          const isCore = name === "CORE";

          if (isCore) {
            // Render 4 sub-cards
            return (
              <g key={name}
                onMouseEnter={() => setHovered(name)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                {[0, 1, 2, 3].map(idx => {
                  const cx = pos.x + (idx % 2) * (CORE_W + CORE_GAP);
                  const cy = pos.y + Math.floor(idx / 2) * (CORE_H + CORE_GAP);
                  return (
                    <g key={idx}>
                      <rect x={cx} y={cy} width={CORE_W} height={CORE_H} rx={6}
                        fill={active || isHov ? d.color : "#1e2433"}
                        stroke={isHov ? "#fff" : active ? d.color : "#2a3040"}
                        strokeWidth={isHov ? 2 : 1}
                        opacity={hovered && !active ? 0.3 : 1}
                        style={{ transition: "fill 0.3s, opacity 0.3s, stroke 0.3s" }}
                      />
                      <text x={cx + 8} y={cy + 18} fill="#fff" fontSize={12} fontWeight="bold"
                        opacity={hovered && !active ? 0.3 : 1}
                        style={{ transition: "opacity 0.3s" }}
                      >CORE</text>
                      <text x={cx + 8} y={cy + 36} fill="#ffffffcc" fontSize={9}
                        opacity={hovered && !active ? 0.3 : 1}
                        style={{ transition: "opacity 0.3s" }}
                      >{coreNames[idx]}</text>
                    </g>
                  );
                })}
              </g>
            );
          }

          const titleSize = isMinor ? 10 : 12;
          const itemSize = isMinor ? 7.5 : 8.5;
          const maxItems = isMinor ? 5 : Math.floor((pos.h - 30) / 12);
          const divX = pos.x + pos.w * 0.55;

          return (
            <g key={name}
              onMouseEnter={() => setHovered(name)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h} rx={7}
                fill={active || isHov ? d.color : "#1e2433"}
                stroke={isHov ? "#fff" : active ? d.color : "#2a3040"}
                strokeWidth={isHov ? 2.5 : 1}
                opacity={hovered && !active ? 0.3 : 1}
                style={{ transition: "fill 0.3s, opacity 0.3s, stroke 0.3s" }}
              />
              {/* Title */}
              <text x={pos.x + 8} y={pos.y + titleSize + 6} fill="#fff"
                fontSize={titleSize} fontWeight="bold"
                opacity={hovered && !active ? 0.3 : 1}
                style={{ transition: "opacity 0.3s" }}
              >{name}</text>
              {/* Divider line */}
              <line x1={pos.x + 6} y1={pos.y + titleSize + 12} x2={pos.x + pos.w - 6} y2={pos.y + titleSize + 12}
                stroke="#ffffff44" strokeWidth={0.5}
                opacity={hovered && !active ? 0.3 : 1}
              />
              {/* Vertical divider */}
              <line x1={divX} y1={pos.y + titleSize + 16} x2={divX} y2={pos.y + pos.h - 6}
                stroke="#ffffff33" strokeWidth={0.5}
                opacity={hovered && !active ? 0.3 : 1}
              />
              {/* Tables (left col) */}
              {d.tables.slice(0, maxItems).map((t, ti) => (
                <text key={`t-${ti}`} x={pos.x + 8} y={pos.y + titleSize + 26 + ti * 12}
                  fill="#ffffffdd" fontSize={itemSize}
                  opacity={hovered && !active ? 0.3 : 1}
                  style={{ transition: "opacity 0.3s" }}
                >{t.length > 18 ? t.slice(0, 17) + "…" : t}</text>
              ))}
              {/* Functions (right col, italic) */}
              {d.functions.slice(0, maxItems).map((f, fi) => (
                <text key={`f-${fi}`} x={divX + 4} y={pos.y + titleSize + 26 + fi * 12}
                  fill="#ffffffbb" fontSize={itemSize - 0.5} fontStyle="italic"
                  opacity={hovered && !active ? 0.3 : 1}
                  style={{ transition: "opacity 0.3s" }}
                >{f.length > 16 ? f.slice(0, 15) + "…" : f}</text>
              ))}
            </g>
          );
        })}

        {/* ── Title ── */}
        <text x={20} y={30} fill="#fff" fontSize={18} fontWeight="bold" fontFamily="system-ui">
          CRAWLERS — Architecture Backend
        </text>
        <text x={20} y={48} fill="#888" fontSize={11} fontFamily="system-ui">
          175 tables | 225 edge functions | 18 domaines — Survol pour explorer les connexions
        </text>

        {/* ── Legend ── */}
        <g transform={`translate(${SVG_W - 320}, ${SVG_H - 90})`}>
          <rect x={0} y={0} width={300} height={75} rx={6} fill="#151a27" stroke="#2a3040" />
          <text x={10} y={18} fill="#ccc" fontSize={10} fontWeight="bold">LEGENDE</text>
          <line x1={10} y1={30} x2={40} y2={30} stroke="#aaa" strokeWidth={2} />
          <text x={48} y={34} fill="#999" fontSize={9}>Appel inter-functions (invoke)</text>
          <line x1={10} y1={46} x2={40} y2={46} stroke="#777" strokeWidth={1.5} strokeDasharray="6 4" />
          <text x={48} y={50} fill="#999" fontSize={9}>Lecture table cross-domaine (SELECT)</text>
          <text x={10} y={66} fill="#888" fontSize={8}>Col. gauche = tables | Col. droite (italique) = functions</text>
        </g>
      </svg>
    </div>
  );
};

export default ArchitectureMap;
