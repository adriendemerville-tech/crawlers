import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackTokenUsage, trackPaidApiCall } from "../_shared/tokenTracker.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const CTR_CURVE: Record<number, number> = {
  1: 0.31, 2: 0.24, 3: 0.18, 4: 0.13, 5: 0.09,
  6: 0.06, 7: 0.04, 8: 0.03, 9: 0.02, 10: 0.01,
};

const SEASONALITY_MATRIX: Record<string, number[]> = {
  Retail:     [0.85, 0.80, 0.90, 0.95, 1.00, 1.05, 1.00, 0.90, 1.10, 1.15, 1.30, 1.50],
  RealEstate: [0.90, 0.95, 1.30, 1.25, 1.20, 1.15, 1.05, 0.85, 1.10, 1.05, 0.95, 0.80],
  Medical:    [1.15, 1.10, 1.05, 1.00, 0.95, 0.90, 0.85, 0.85, 1.10, 1.15, 1.10, 1.00],
  Services:   [1.00, 1.00, 1.05, 1.05, 1.00, 0.95, 0.90, 0.85, 1.10, 1.10, 1.05, 1.00],
  Travel:     [1.10, 1.05, 1.00, 1.10, 1.25, 1.35, 1.40, 1.30, 1.05, 0.90, 0.80, 0.95],
  Finance:    [1.20, 1.10, 1.15, 1.05, 1.00, 0.95, 0.90, 0.90, 1.05, 1.10, 1.10, 1.05],
  Education:  [1.15, 1.10, 1.00, 0.95, 0.90, 0.85, 0.80, 1.20, 1.30, 1.15, 1.05, 0.90],
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── FUEL: Pre-processing Utilities ─────────────────────────────────────────

function computeTDI(errorCount: number): number {
  return errorCount > 0 ? Math.pow(errorCount, 1.5) : 0;
}

function domainRoot(domain: string): string {
  return domain.replace(/^www\./, '').split('.')[0].toLowerCase();
}

function isBrand(keyword: string, root: string): boolean {
  const kw = keyword.toLowerCase();
  return kw.includes(root) || kw.includes(root.replace(/-/g, ' '));
}

type Intent = 'high_intent' | 'low_intent';

function classifyIntent(keyword: string): Intent {
  const kw = keyword.toLowerCase();
  const highSignals = [
    'acheter','buy','prix','price','tarif','devis','promo','discount',
    'commande','livraison','shop','boutique','comparatif','avis',
    'près de','near me','à proximité','horaire','itinéraire',
    'reservation','réservation','location','louer','souscrire',
  ];
  return highSignals.some(s => kw.includes(s)) ? 'high_intent' : 'low_intent';
}

function classifyDepth(data: Record<string, any>): 'thin' | 'utility' | 'authority' {
  const cqs = Number(data.content_quality_score) || 0;
  const words = Number(data.word_count) || 0;
  if (cqs >= 75 || words >= 2000) return 'authority';
  if (cqs >= 40 || words >= 800) return 'utility';
  return 'thin';
}

const REBOUND_DAYS: Record<string, number> = { authority: 45, utility: 55, thin: 60 };

function ctrAt(pos: number): number {
  const rounded = Math.round(Math.max(1, Math.min(pos, 10)));
  return CTR_CURVE[rounded] ?? 0.005;
}

function potentialGain(tdi: number): number {
  if (tdi < 15) return 3;
  if (tdi < 50) return 1.5;
  return 0.5;
}

function resolveSector(ext: Record<string, any>): string {
  const raw = (ext.sector || ext.industry || ext.niche || 'Services').toString().toLowerCase();
  const map: Record<string, string> = {
    retail: 'Retail', ecommerce: 'Retail', 'e-commerce': 'Retail', boutique: 'Retail', shop: 'Retail',
    realestate: 'RealEstate', immobilier: 'RealEstate', 'real estate': 'RealEstate', immo: 'RealEstate',
    medical: 'Medical', santé: 'Medical', health: 'Medical', pharma: 'Medical', clinique: 'Medical',
    travel: 'Travel', tourisme: 'Travel', voyage: 'Travel', hotel: 'Travel', 'hôtel': 'Travel',
    finance: 'Finance', banque: 'Finance', assurance: 'Finance', insurance: 'Finance', crypto: 'Finance',
    education: 'Education', formation: 'Education', 'e-learning': 'Education', école: 'Education',
  };
  for (const [pattern, sector] of Object.entries(map)) {
    if (raw.includes(pattern)) return sector;
  }
  return 'Services';
}

function seasonalFactor90d(sector: string): number {
  const now = new Date();
  const m0 = now.getMonth();
  const coeffs = SEASONALITY_MATRIX[sector] || SEASONALITY_MATRIX['Services'];
  const c1 = coeffs[m0];
  const c2 = coeffs[(m0 + 1) % 12];
  const c3 = coeffs[(m0 + 2) % 12];
  return Math.round(((c1 + c2 + c3) / 3) * 1000) / 1000;
}

// ─── GSC SEGMENTATION ───────────────────────────────────────────────────────

interface GscRow { keys?: string[]; clicks?: number; impressions?: number; position?: number }

interface GscSegment {
  totalClicks: number;
  totalImpressions: number;
  avgPos: number;
  brandClicks: number;
  brandImpressions: number;
  highIntentClicks: number;
  highIntentImpressions: number;
  lowIntentClicks: number;
  lowIntentImpressions: number;
  nonBrandClicks: number;
  nonBrandImpressions: number;
}

function segmentGsc(gsc_data: any, root: string): GscSegment {
  let totalClicks = 0, totalImpressions = 0, posSum = 0, rowCount = 0;
  let brandClicks = 0, brandImpressions = 0;
  let highIntentClicks = 0, highIntentImpressions = 0;
  let lowIntentClicks = 0, lowIntentImpressions = 0;

  const rows: GscRow[] = gsc_data?.rows || [];

  if (rows.length > 0) {
    for (const r of rows) {
      const c = r.clicks || 0, im = r.impressions || 0, pos = r.position || 0;
      const kw = (r.keys?.[0] || '').toLowerCase();
      totalClicks += c; totalImpressions += im; posSum += pos; rowCount++;
      if (isBrand(kw, root)) { brandClicks += c; brandImpressions += im; continue; }
      if (classifyIntent(kw) === 'high_intent') { highIntentClicks += c; highIntentImpressions += im; }
      else { lowIntentClicks += c; lowIntentImpressions += im; }
    }
  } else if (gsc_data?.total_clicks) {
    totalClicks = gsc_data.total_clicks;
    totalImpressions = gsc_data.total_impressions || 0;
    posSum = gsc_data.avg_position || 0; rowCount = 1;
    brandClicks = Math.round(totalClicks * 0.30);
    const nb = totalClicks - brandClicks;
    highIntentClicks = Math.round(nb * 0.35);
    lowIntentClicks = nb - highIntentClicks;
    brandImpressions = Math.round(totalImpressions * 0.30);
    highIntentImpressions = Math.round((totalImpressions - brandImpressions) * 0.35);
    lowIntentImpressions = totalImpressions - brandImpressions - highIntentImpressions;
  }

  const avgPos = rowCount > 0 ? posSum / rowCount : 0;
  const nonBrandClicks = totalClicks - brandClicks;
  const nonBrandImpressions = totalImpressions - brandImpressions;

  return {
    totalClicks, totalImpressions, avgPos,
    brandClicks, brandImpressions,
    highIntentClicks, highIntentImpressions,
    lowIntentClicks, lowIntentImpressions,
    nonBrandClicks, nonBrandImpressions,
  };
}

// ─── DETERMINISTIC ANCHORS ──────────────────────────────────────────────────

interface Anchors {
  potentialPositionGain: number;
  targetPos: number;
  theoreticalNonBrandGain: number;
  seasonalGain: number;
  seasonalFactor: number;
  sector: string;
  currentMonth: number;
  baseAiRisk: number;
  realisticFloor: number;
  realisticCeiling: number;
}

function computeAnchors(seg: GscSegment, tdiScore: number, sector: string): Anchors {
  const gain = potentialGain(tdiScore);
  const currentCtr = ctrAt(seg.avgPos);
  const targetPos = Math.max(1, seg.avgPos - gain);
  const newCtr = ctrAt(targetPos);
  const theoreticalNonBrandGain = Math.round(seg.nonBrandImpressions * (newCtr - currentCtr));

  const currentMonth = new Date().getMonth();
  const sf = seasonalFactor90d(sector);
  const seasonalGain = Math.round(Math.max(0, theoreticalNonBrandGain) * sf);

  const baseAiRisk = Math.min(100, Math.max(0,
    Math.round((seg.lowIntentClicks / (seg.nonBrandClicks || 1)) * 100)
  ));

  const realisticTarget = seg.totalClicks + Math.max(0, seasonalGain);
  const realisticFloor = Math.round(realisticTarget * 0.85);
  const realisticCeiling = Math.round(realisticTarget * 1.15);

  return {
    potentialPositionGain: gain, targetPos, theoreticalNonBrandGain,
    seasonalGain, seasonalFactor: sf, sector, currentMonth,
    baseAiRisk, realisticFloor, realisticCeiling,
  };
}

// ─── DATA SOURCE: Multi-source intelligence gathering ───────────────────────

/**
 * Input source types:
 * - 'pdf_audit': legacy PDF upload (admin)
 * - 'crawl': multi-page crawl data
 * - 'saved_reports': user's saved audit reports
 * - 'gsc': Google Search Console live data
 * - 'corrective_codes': implemented fixes detection
 */
interface DataIntelligence {
  domain: string;
  root: string;
  errorCount: number;
  tdiScore: number;
  depth: 'thin' | 'utility' | 'authority';
  reboundDays: number;
  sector: string;
  ext: Record<string, any>;  // normalized extracted data
  gscData: any;
  crawlContext: CrawlContext | null;
  fixesImplemented: boolean;
  fixesCount: number;
  reportsCount: number;
  source: string;
}

interface CrawlContext {
  totalPages: number;
  avgScore: number;
  pagesWithSchema: number;
  pagesWithCanonical: number;
  pagesWithOg: number;
  thinPages: number;
  totalImagesNoAlt: number;
  topIssues: any[];
}

async function gatherIntelligence(
  supabase: any,
  params: {
    audit_id?: string;
    crawl_id?: string;
    client_id?: string;
    gsc_data?: any;
    sector?: string;
  }
): Promise<DataIntelligence> {
  const ext: Record<string, any> = {};
  let domain = '';
  let errorCount = 0;
  let source = 'unknown';
  let crawlContext: CrawlContext | null = null;
  let gscData = params.gsc_data || null;

  // ─── Source 1: PDF Audit (legacy admin) ───
  if (params.audit_id) {
    const { data: audit } = await supabase
      .from('pdf_audits').select('*').eq('id', params.audit_id).maybeSingle();
    
    if (audit?.status === 'processed' && audit.extracted_data) {
      Object.assign(ext, audit.extracted_data);
      domain = ext.domain || '';
      errorCount = Number(ext.errors) || 0;
      source = 'pdf_audit';
    }
  }

  // ─── Source 2: Multi-page Crawl ───
  if (params.crawl_id) {
    const { data: crawl } = await supabase
      .from('site_crawls').select('*').eq('id', params.crawl_id).maybeSingle();
    
    if (crawl?.status === 'completed') {
      domain = domain || crawl.domain;
      source = source === 'pdf_audit' ? 'pdf_audit+crawl' : 'crawl';

      const { data: pages } = await supabase
        .from('crawl_pages').select('*').eq('crawl_id', params.crawl_id);
      
      if (pages && pages.length > 0) {
        const crawlErrors = pages.reduce((s: number, p: any) => s + ((p.issues as any[])?.length || 0), 0);
        // Use adjusted TDI exponent for multi-page (many small errors)
        errorCount = Math.max(errorCount, crawlErrors);

        crawlContext = {
          totalPages: pages.length,
          avgScore: crawl.avg_score || 0,
          pagesWithSchema: pages.filter((p: any) => p.has_schema_org).length,
          pagesWithCanonical: pages.filter((p: any) => p.has_canonical).length,
          pagesWithOg: pages.filter((p: any) => p.has_og).length,
          thinPages: pages.filter((p: any) => (p.word_count || 0) < 100).length,
          totalImagesNoAlt: pages.reduce((s: number, p: any) => s + (p.images_without_alt || 0), 0),
          topIssues: (crawl.ai_recommendations || []).slice(0, 5),
        };

        // Enrich ext with crawl averages
        ext.word_count = ext.word_count || Math.round(pages.reduce((s: number, p: any) => s + (p.word_count || 0), 0) / pages.length);
        ext.structured_data_present = ext.structured_data_present || (crawlContext.pagesWithSchema / pages.length > 0.5);
        ext.technical_score = ext.technical_score || Math.round(crawlContext.avgScore / 2); // /200 -> /100
      }
    }
  }

  // ─── Source 3: Saved Reports (user's audit history for this domain) ───
  if (domain && params.client_id) {
    const { data: reports } = await supabase
      .from('saved_reports')
      .select('report_data, report_type, created_at')
      .eq('user_id', params.client_id)
      .ilike('url', `%${domain}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (reports && reports.length > 0) {
      // Extract technical signals from saved expert reports
      for (const report of reports) {
        const rd = report.report_data as Record<string, any>;
        if (report.report_type === 'expert' || report.report_type === 'crawlers') {
          // Merge scores if not already set from PDF or crawl
          if (!ext.content_quality_score && rd?.contentDensity?.ratio) {
            ext.content_quality_score = Math.round(rd.contentDensity.ratio * 100);
          }
          if (!ext.page_speed_score && rd?.pagespeed?.performance) {
            ext.page_speed_score = rd.pagespeed.performance;
          }
          if (!ext.domain_authority && rd?.domainAuthority) {
            ext.domain_authority = rd.domainAuthority;
          }
          // Count additional errors from expert reports
          const reportErrors = (rd?.brokenLinks?.total || 0) + 
            (rd?.missingH1 ? 1 : 0) + (rd?.missingMeta ? 1 : 0) + 
            (rd?.noRobotsTxt ? 1 : 0) + (rd?.noSitemap ? 1 : 0);
          errorCount = Math.max(errorCount, reportErrors);
        }
      }
      ext._reports_count = reports.length;
    }
  }

  // ─── Source 4: GSC data auto-fetch if user has integration ───
  if (!gscData && domain && params.client_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('gsc_access_token, gsc_refresh_token, gsc_site_url, gsc_token_expiry')
      .eq('user_id', params.client_id)
      .maybeSingle();

    if (profile?.gsc_access_token && profile?.gsc_site_url) {
      try {
        // Check if token is still valid (not expired)
        const tokenExpiry = profile.gsc_token_expiry ? new Date(profile.gsc_token_expiry) : null;
        const isExpired = tokenExpiry && tokenExpiry < new Date();
        
        let accessToken = profile.gsc_access_token;
        
        // Refresh token if expired
        if (isExpired && profile.gsc_refresh_token) {
          const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID');
          const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET');
          if (clientId && clientSecret) {
            const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: profile.gsc_refresh_token,
                grant_type: 'refresh_token',
              }),
            });
            if (refreshRes.ok) {
              const tokenData = await refreshRes.json();
              accessToken = tokenData.access_token;
              // Update profile with new token
              await supabase.from('profiles').update({
                gsc_access_token: accessToken,
                gsc_token_expiry: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
              }).eq('user_id', params.client_id);
            }
          }
        }

        // Fetch GSC data for last 30 days
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const gscRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(profile.gsc_site_url)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              startDate, endDate,
              dimensions: ['query'],
              rowLimit: 500,
            }),
          }
        );
        
        if (gscRes.ok) {
          gscData = await gscRes.json();
          source += '+gsc';
        }
      } catch (gscErr) {
        console.warn('GSC auto-fetch failed:', gscErr);
        // Non-blocking: continue without GSC
      }
    }
  }

  // ─── Source 5: Corrective codes VERIFIED deployment detection ───
  // RULE: A code is only "deployed" if:
  //   (a) The user explicitly clicked "It works!" (validated_at IS NOT NULL), OR
  //   (b) The code was synced to a WordPress site via the plugin (tracked_sites.current_config.last_sync)
  // Simply generating a code does NOT count as deployed.
  let fixesImplemented = false;
  let fixesCount = 0;
  if (domain) {
    // (a) Check for user-validated codes ("It works!" button sets validated_at)
    const { data: validatedCodes } = await supabase
      .from('saved_corrective_codes')
      .select('id')
      .ilike('url', `%${domain}%`)
      .not('validated_at', 'is', null);
    
    if (validatedCodes && validatedCodes.length > 0) {
      fixesCount = validatedCodes.length;
      fixesImplemented = true;
      source += '+validated_fixes';
    }

    // (b) Check tracked sites for plugin OR GTM widget deployment
    if (!fixesImplemented) {
      const { data: wpSites } = await supabase
        .from('tracked_sites')
        .select('id, current_config, last_widget_ping')
        .ilike('domain', `%${domain}%`)
        .limit(1);
      if (wpSites && wpSites.length > 0) {
        const site = wpSites[0];
        const cfg = site.current_config as Record<string, any> | null;

        // (b1) WordPress plugin sync
        if (cfg && cfg.last_sync && cfg.fixes?.length > 0) {
          fixesImplemented = true;
          fixesCount = cfg.fixes.length;
          source += '+wp_deployed';
        }

        // (b2) GTM widget connected (last_widget_ping < 24h = active connection)
        if (!fixesImplemented && site.last_widget_ping) {
          const pingAge = Date.now() - new Date(site.last_widget_ping).getTime();
          const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
          if (pingAge < TWENTY_FOUR_HOURS) {
            fixesImplemented = true;
            fixesCount = 1; // GTM widget = 1 active deployment channel
            source += '+gtm_widget';
          }
        }
      }
    }
  }

  // ─── Source 6: Latest backlink snapshot (from weekly cron) ───
  if (domain) {
    const { data: blSnap } = await supabase
      .from('backlink_snapshots')
      .select('domain_rank, referring_domains, backlinks_total')
      .ilike('domain', `%${domain}%`)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (blSnap) {
      ext.domain_rank = ext.domain_rank || blSnap.domain_rank;
      ext.referring_domains = ext.referring_domains || blSnap.referring_domains;
      ext.backlinks_total = ext.backlinks_total || blSnap.backlinks_total;
    }
  }

  // ─── Compute derived metrics ───
  const root = domainRoot(domain);
  const tdiScore = crawlContext 
    ? (errorCount > 0 ? Math.pow(errorCount, 0.8) : 0) // Adjusted exponent for crawl
    : computeTDI(errorCount);
  const depth = classifyDepth(ext);
  const reboundDays = REBOUND_DAYS[depth];
  const sector = resolveSector(params.sector ? { sector: params.sector } : ext);

  return {
    domain, root, errorCount, tdiScore, depth, reboundDays, sector, ext,
    gscData, crawlContext, fixesImplemented, fixesCount,
    reportsCount: ext._reports_count || 0, source,
  };
}

// ─── PROMPT BUILDER ─────────────────────────────────────────────────────────

function buildPrompt(
  intel: DataIntelligence,
  seg: GscSegment,
  anchors: Anchors,
): string {
  const monthName = MONTH_NAMES[anchors.currentMonth];
  
  let crawlBlock = '';
  if (intel.crawlContext) {
    const cc = intel.crawlContext;
    crawlBlock = `
## MULTI-PAGE CRAWL DATA
- Pages crawled: ${cc.totalPages}
- Average SEO score: ${cc.avgScore}/200
- Schema.org adoption: ${cc.pagesWithSchema}/${cc.totalPages} (${Math.round(cc.pagesWithSchema / cc.totalPages * 100)}%)
- Canonical adoption: ${cc.pagesWithCanonical}/${cc.totalPages}
- Open Graph adoption: ${cc.pagesWithOg}/${cc.totalPages}
- Thin content pages (<100 words): ${cc.thinPages}
- Total images without alt: ${cc.totalImagesNoAlt}
${cc.topIssues.length > 0 ? `- Top issues:\n${cc.topIssues.map((r: any) => `  • ${r.title} (${r.priority}, ${r.affected_pages || '?'} pages)`).join('\n')}` : ''}`;
  }

  let fixesBlock = '';
  if (intel.fixesImplemented) {
    fixesBlock = `
## VERIFIED CORRECTIVE ACTIONS (DEPLOYED)
- ${intel.fixesCount} corrective code(s) **confirmed deployed** for this domain
- Deployment verified via: user validation ("It works!"), WordPress plugin sync, or GTM widget active connection
- This is NOT an assumption — these fixes are actively running on the site
- Factor in a HIGHER growth expectation (+5-10% on realistic scenario)`;
  } else {
    // Check if codes exist but are NOT validated
    fixesBlock = `
## CORRECTIVE CODES STATUS
- Corrective codes may have been generated but are NOT confirmed as deployed
- Do NOT factor any optimization boost — treat the site as if no fixes are in place`;
  }

  let reportsBlock = '';
  if (intel.reportsCount > 0) {
    reportsBlock = `
## HISTORICAL AUDIT DATA
- ${intel.reportsCount} saved audit report(s) for this domain
- This provides longitudinal context for trend analysis`;
  }

  return `You are a Senior Search Data Scientist running a causal traffic simulation for the 2026 Search ecosystem.

## DATA SOURCES USED: ${intel.source}

## PRE-COMPUTED INTELLIGENCE (use as-is, do NOT recalculate)
- Technical Debt Index (TDI): ${intel.tdiScore.toFixed(1)} (from ${intel.errorCount} errors)
  → High TDI creates an "Indexing Ceiling": Google throttles crawl budget.
- Semantic Depth: "${intel.depth}" → Trust Rebound ETA: ${intel.reboundDays} days
- Domain Authority: ${intel.ext.domain_authority || 'N/A'}
- Domain Rank (backlink-based): ${intel.ext.domain_rank || 'N/A'}
- Referring Domains: ${intel.ext.referring_domains || 'N/A'}

## AUDIT DATA
- Technical SEO score: ${intel.ext.technical_score || 'N/A'}/100
- Content quality score: ${intel.ext.content_quality_score || 'N/A'}/100
- Page speed score: ${intel.ext.page_speed_score || 'N/A'}
- Mobile score: ${intel.ext.mobile_score || 'N/A'}
- Structured data present: ${intel.ext.structured_data_present || false}
- Schema types: ${JSON.stringify(intel.ext.schema_types || [])}
${crawlBlock}${fixesBlock}${reportsBlock}

## GSC BASELINE (30 days)
- Total clicks: ${seg.totalClicks} | Impressions: ${seg.totalImpressions} | Avg position: ${seg.avgPos.toFixed(1)}
- Brand clicks: ${seg.brandClicks} (FROZEN — 0% growth)
- Non-Brand clicks: ${seg.nonBrandClicks}
  ├─ High-Intent (transactional/local): ${seg.highIntentClicks} clicks, ${seg.highIntentImpressions} impressions
  └─ Low-Intent (informational): ${seg.lowIntentClicks} clicks, ${seg.lowIntentImpressions} impressions

## INFLEXIBLE TRUTHS — YOU MUST RESPECT THESE

### 1. CTR Base Gain
Moving from position ${seg.avgPos.toFixed(1)} to position ${anchors.targetPos.toFixed(1)} yields raw gain of **${anchors.theoreticalNonBrandGain}** non-brand clicks.
After seasonal coefficient (${anchors.seasonalFactor}), adjusted gain = **${anchors.seasonalGain}** clicks.
Your **Realistic** total clicks MUST = brand (${seg.brandClicks}) + non-brand (${seg.nonBrandClicks}) + gain within **±15%** of ${anchors.seasonalGain}.

### 2. Sector Seasonality
Month: **${monthName}**. Sector: **${anchors.sector}**. Coefficient: **${anchors.seasonalFactor}**.

### 3. AI Risk Constraint
Base AI Risk = **${anchors.baseAiRisk}/100**. Adjust by ONLY ±15 points. Final: ${Math.max(0, anchors.baseAiRisk - 15)}-${Math.min(100, anchors.baseAiRisk + 15)}.

### 4. Scenario Spread (STRICT)
- pessimistic.clicks = realistic.clicks × 0.7
- aggressive.clicks = realistic.clicks × 1.4

## OUTPUT — Return ONLY this JSON (no markdown fences, no commentary)
{
  "scenarios": {
    "pessimistic": { "clicks": <integer>, "increase_pct": <number> },
    "realistic": { "clicks": <integer>, "increase_pct": <number> },
    "aggressive": { "clicks": <integer>, "increase_pct": <number> }
  },
  "ai_risk_score": <integer ${Math.max(0, anchors.baseAiRisk - 15)}-${Math.min(100, anchors.baseAiRisk + 15)}>,
  "business_impact": {
    "monthly_value_euro": <number>,
    "annual_value_euro": <number>,
    "cpc_basis": { "high_intent_cpc": <number>, "low_intent_cpc": <number> }
  },
  "market_insights": {
    "technical_unlock_potential": <integer>,
    "ai_cannibalization_risk": "low"|"medium"|"high"
  },
  "reasoning": "<2-3 sentence strategic explanation focusing on causality and seasonality>"
}

GUARDRAILS:
- Realistic clicks MUST be between ${anchors.realisticFloor} and ${anchors.realisticCeiling}.
- Brand traffic (${seg.brandClicks}) is constant.
- ai_risk_score MUST be integer between ${Math.max(0, anchors.baseAiRisk - 15)} and ${Math.min(100, anchors.baseAiRisk + 15)}.
- business_impact.annual_value_euro = monthly_value_euro × 12.
- Use CPC: high-intent × €1.20, low-intent × €0.25. Only NET GAIN over baseline.`;
}

// ─── POST-PROCESSING ────────────────────────────────────────────────────────

function validateAndCorrect(prediction: any, seg: GscSegment, anchors: Anchors): any {
  const p = prediction;

  let realisticClicks = p.scenarios?.realistic?.clicks ?? seg.totalClicks;
  if (realisticClicks < anchors.realisticFloor || realisticClicks > anchors.realisticCeiling) {
    realisticClicks = Math.max(anchors.realisticFloor, Math.min(anchors.realisticCeiling, realisticClicks));
  }
  realisticClicks = Math.max(realisticClicks, seg.totalClicks);

  const pessimisticClicks = Math.max(seg.totalClicks, Math.round(realisticClicks * 0.7));
  const aggressiveClicks = Math.round(realisticClicks * 1.4);

  p.scenarios = {
    pessimistic: { clicks: pessimisticClicks, increase_pct: pct(pessimisticClicks, seg.totalClicks) },
    realistic:   { clicks: realisticClicks,   increase_pct: pct(realisticClicks, seg.totalClicks) },
    aggressive:  { clicks: aggressiveClicks,  increase_pct: pct(aggressiveClicks, seg.totalClicks) },
  };

  const minRisk = Math.max(0, anchors.baseAiRisk - 15);
  const maxRisk = Math.min(100, anchors.baseAiRisk + 15);
  p.ai_risk_score = Math.min(maxRisk, Math.max(minRisk, p.ai_risk_score ?? anchors.baseAiRisk));

  const netGain = realisticClicks - seg.totalClicks;
  if (netGain > 0 && seg.nonBrandClicks > 0) {
    const hiRatio = seg.highIntentClicks / seg.nonBrandClicks;
    const loRatio = seg.lowIntentClicks / seg.nonBrandClicks;
    const hiCpc = p.business_impact?.cpc_basis?.high_intent_cpc ?? 1.20;
    const loCpc = p.business_impact?.cpc_basis?.low_intent_cpc ?? 0.25;
    const monthlyValue = Math.round((netGain * hiRatio * hiCpc + netGain * loRatio * loCpc) * 100) / 100;
    p.business_impact = {
      monthly_value_euro: monthlyValue,
      annual_value_euro: Math.round(monthlyValue * 12 * 100) / 100,
      cpc_basis: { high_intent_cpc: hiCpc, low_intent_cpc: loCpc },
    };
  } else {
    p.business_impact = p.business_impact || { monthly_value_euro: 0, annual_value_euro: 0, cpc_basis: { high_intent_cpc: 1.20, low_intent_cpc: 0.25 } };
  }

  return p;
}

function pct(final: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return Math.round(((final - baseline) / baseline) * 10000) / 100;
}

// ─── SERVE ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    /**
     * Accepted input params:
     * - audit_id: string (optional — PDF audit source)
     * - crawl_id: string (optional — multi-page crawl source)
     * - client_id: string (required — user who owns the data)
     * - gsc_data: object (optional — manual GSC data, auto-fetched if absent)
     * - sector: string (optional — override sector detection)
     */
    const body = await req.json();
    const { audit_id, crawl_id, client_id, gsc_data, sector } = body;

    if (!client_id) {
      return new Response(JSON.stringify({ error: 'client_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!audit_id && !crawl_id) {
      return new Response(JSON.stringify({ error: 'audit_id or crawl_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) throw new Error('OPENROUTER_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Gather intelligence from all available sources ──
    const intel = await gatherIntelligence(supabase, { audit_id, crawl_id, client_id, gsc_data, sector });

    if (!intel.domain) {
      throw new Error('Could not resolve domain from any source');
    }

    // ── GSC segmentation ──
    const seg = segmentGsc(intel.gscData, intel.root);

    // ── If no GSC data and source is crawl-only, synthesize baseline from crawl ──
    if (seg.totalClicks === 0 && intel.crawlContext) {
      const cc = intel.crawlContext;
      // Heuristic baseline: ~15 clicks per well-optimized page per month
      const syntheticBaseline = Math.round(cc.totalPages * (cc.avgScore / 200) * 15);
      seg.totalClicks = syntheticBaseline;
      seg.totalImpressions = syntheticBaseline * 20;
      seg.avgPos = 15 - (cc.avgScore / 200) * 10; // Score-based position estimate
      seg.brandClicks = Math.round(syntheticBaseline * 0.30);
      seg.nonBrandClicks = syntheticBaseline - seg.brandClicks;
      seg.highIntentClicks = Math.round(seg.nonBrandClicks * 0.35);
      seg.lowIntentClicks = seg.nonBrandClicks - seg.highIntentClicks;
      seg.brandImpressions = Math.round(seg.totalImpressions * 0.30);
      seg.nonBrandImpressions = seg.totalImpressions - seg.brandImpressions;
      seg.highIntentImpressions = Math.round(seg.nonBrandImpressions * 0.35);
      seg.lowIntentImpressions = seg.nonBrandImpressions - seg.highIntentImpressions;
    }

    // ── Deterministic anchors ──
    const anchors = computeAnchors(seg, intel.tdiScore, intel.sector);

    // ── Build prompt ──
    const prompt = buildPrompt(intel, seg, anchors);

    // ── Call AI ──
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': supabaseUrl,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: 'You are a quantitative search traffic simulator. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI error ${aiResponse.status}: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    await trackTokenUsage('generate-prediction', 'anthropic/claude-3.5-sonnet', aiData.usage);
    trackPaidApiCall('generate-prediction', 'openrouter', 'anthropic/claude-3.5-sonnet');

    let prediction: any;
    try { prediction = JSON.parse(cleaned); }
    catch { throw new Error(`Failed to parse prediction JSON: ${cleaned.substring(0, 300)}`); }

    // ── Post-processing: validate & correct ──
    prediction = validateAndCorrect(prediction, seg, anchors);

    // ── Consistency Rule: ±2% if same audit AND no code patch detected ──
    let anchorPrediction: number | null = null;
    let consistencyClamped = false;
    let consistencySkipReason: string | null = null;

    if (intel.fixesImplemented) {
      consistencySkipReason = 'patch_detected';
    } else if (intel.domain) {
      // Find prior predictions for same domain
      const priorQuery = supabase
        .from('predictions')
        .select('predicted_traffic, prediction_details')
        .eq('domain', intel.domain)
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (audit_id) priorQuery.eq('audit_id', audit_id);

      const { data: priorPreds } = await priorQuery;

      if (priorPreds && priorPreds.length > 0) {
        anchorPrediction = priorPreds[0].predicted_traffic;

        const priorTdi = (priorPreds[0].prediction_details as any)?._meta?.tdi_score;
        const tdiDelta = priorTdi != null ? Math.abs(intel.tdiScore - priorTdi) / (priorTdi || 1) : 0;
        const consistencyMargin = tdiDelta > 0.30 ? 0.10 : 0.02;

        const lowerBound = Math.round(anchorPrediction * (1 - consistencyMargin));
        const upperBound = Math.round(anchorPrediction * (1 + consistencyMargin));
        const currentRealistic = prediction.scenarios.realistic.clicks;

        if (currentRealistic < lowerBound || currentRealistic > upperBound) {
          const clamped = Math.max(lowerBound, Math.min(upperBound, currentRealistic));
          prediction.scenarios.realistic.clicks = clamped;
          prediction.scenarios.realistic.increase_pct = pct(clamped, seg.totalClicks);
          const pessClamped = Math.max(seg.totalClicks, Math.round(clamped * 0.7));
          const aggrClamped = Math.round(clamped * 1.4);
          prediction.scenarios.pessimistic = { clicks: pessClamped, increase_pct: pct(pessClamped, seg.totalClicks) };
          prediction.scenarios.aggressive = { clicks: aggrClamped, increase_pct: pct(aggrClamped, seg.totalClicks) };
          const netGain = clamped - seg.totalClicks;
          if (netGain > 0 && seg.nonBrandClicks > 0) {
            const hiRatio = seg.highIntentClicks / seg.nonBrandClicks;
            const loRatio = seg.lowIntentClicks / seg.nonBrandClicks;
            const hiCpc = prediction.business_impact?.cpc_basis?.high_intent_cpc ?? 1.20;
            const loCpc = prediction.business_impact?.cpc_basis?.low_intent_cpc ?? 0.25;
            const mv = Math.round((netGain * hiRatio * hiCpc + netGain * loRatio * loCpc) * 100) / 100;
            prediction.business_impact = { monthly_value_euro: mv, annual_value_euro: Math.round(mv * 12 * 100) / 100, cpc_basis: { high_intent_cpc: hiCpc, low_intent_cpc: loCpc } };
          }
          consistencyClamped = true;
        }
      } else {
        consistencySkipReason = 'new_prediction';
      }
    }

    // ── Fetch cross-source training vector (SERP × GSC × Backlinks) ──
    let trainingVector: Record<string, any> | null = null;
    if (intel.domain) {
      const weekQuery = (table: string) => supabase
        .from(table)
        .select('*')
        .ilike('domain', `%${intel.domain}%`)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const [serpSnap, gscSnap, blSnap] = await Promise.all([
        supabase.from('serp_snapshots').select('*').ilike('domain', `%${intel.domain}%`).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('gsc_history_log').select('*').ilike('domain', `%${intel.domain}%`).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('backlink_snapshots').select('*').ilike('domain', `%${intel.domain}%`).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const serp = serpSnap.data;
      const gsc = gscSnap.data;
      const bl = blSnap.data;

      if (serp || gsc || bl) {
        trainingVector = {
          captured_at: new Date().toISOString(),
          serp: serp ? {
            total_keywords: serp.total_keywords,
            avg_position: serp.avg_position,
            top_3: serp.top_3,
            top_10: serp.top_10,
            top_50: serp.top_50,
            etv: serp.etv,
            indexed_pages: serp.indexed_pages,
            measured_at: serp.measured_at,
          } : null,
          gsc: gsc ? {
            clicks: gsc.clicks,
            impressions: gsc.impressions,
            ctr: gsc.ctr,
            avg_position: gsc.avg_position,
            week_start_date: gsc.week_start_date,
          } : null,
          backlinks: bl ? {
            domain_rank: bl.domain_rank,
            referring_domains: bl.referring_domains,
            backlinks_total: bl.backlinks_total,
            referring_domains_new: bl.referring_domains_new,
            referring_domains_lost: bl.referring_domains_lost,
            week_start_date: bl.week_start_date,
          } : null,
        };
      }
    }

    // ── Inject auditable metadata ──
    const aiRealisticRaw = JSON.parse(cleaned).scenarios?.realistic?.clicks ?? null;
    prediction._meta = {
      source: intel.source,
      tdi_score: intel.tdiScore,
      error_count: intel.errorCount,
      semantic_depth: intel.depth,
      trust_rebound_days: intel.reboundDays,
      brand_clicks: seg.brandClicks,
      non_brand_clicks: seg.nonBrandClicks,
      high_intent_clicks: seg.highIntentClicks,
      low_intent_clicks: seg.lowIntentClicks,
      theoretical_gain_anchor: anchors.theoreticalNonBrandGain,
      seasonal_gain_anchor: anchors.seasonalGain,
      seasonal_factor: anchors.seasonalFactor,
      sector: anchors.sector,
      current_month: anchors.currentMonth,
      target_position: anchors.targetPos,
      ai_adjustment_delta: (prediction.scenarios.realistic.clicks - seg.totalClicks) - anchors.seasonalGain,
      base_ai_risk: anchors.baseAiRisk,
      realistic_floor: anchors.realisticFloor,
      realistic_ceiling: anchors.realisticCeiling,
      potential_position_gain: anchors.potentialPositionGain,
      ai_raw_realistic_clicks: aiRealisticRaw,
      consistency_anchor: anchorPrediction,
      consistency_clamped: consistencyClamped,
      consistency_skip_reason: consistencySkipReason,
      fixes_detected: intel.fixesImplemented,
      fixes_count: intel.fixesCount,
      reports_used: intel.reportsCount,
      crawl_context: intel.crawlContext ? {
        total_pages: intel.crawlContext.totalPages,
        avg_score: intel.crawlContext.avgScore,
      } : null,
      training_vector: trainingVector,
    };

    // ── Persist ──
    const realisticClicks = prediction.scenarios.realistic.clicks;
    const realisticPct = prediction.scenarios.realistic.increase_pct;

    // Resolve tracked_site_id for direct FK linkage
    let trackedSiteId: string | null = null;
    if (intel.domain) {
      const { data: ts } = await supabase
        .from('tracked_sites')
        .select('id')
        .ilike('domain', `%${intel.domain}%`)
        .limit(1)
        .maybeSingle();
      trackedSiteId = ts?.id || null;
    }

    const { data: saved, error: saveErr } = await supabase
      .from('predictions')
      .insert({
        audit_id: audit_id || crawl_id, // Use crawl_id as audit_id fallback for FK
        client_id,
        domain: intel.domain || null,
        tracked_site_id: trackedSiteId,
        predicted_increase_pct: realisticPct,
        predicted_traffic: realisticClicks,
        baseline_traffic: seg.totalClicks,
        baseline_data: intel.gscData || {},
        prediction_details: prediction,
      })
      .select()
      .single();

    if (saveErr) throw new Error(`Failed to save prediction: ${saveErr.message}`);

    await supabase.rpc('recalculate_reliability');

    return new Response(JSON.stringify({ 
      success: true, 
      prediction: saved,
      // Also return in predict-from-crawl compatible format for frontend
      baseline_traffic: seg.totalClicks,
      scenarios: prediction.scenarios,
      ai_risk_score: prediction.ai_risk_score,
      business_impact: prediction.business_impact,
      reasoning: prediction.reasoning,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-prediction error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
