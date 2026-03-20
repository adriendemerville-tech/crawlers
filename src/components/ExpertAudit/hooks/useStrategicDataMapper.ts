import { ExpertAuditResult } from '@/types/expertAudit';

/**
 * Maps raw strategic API response data to ExpertAuditResult format.
 * Eliminates the 3x duplication of this mapping in ExpertAuditDashboard.
 */
export function mapStrategicData(
  data: any,
  normalizedUrl: string,
  hallucinationCorrections?: any
): ExpertAuditResult {
  const keywordPositioning =
    data?.keyword_positioning ??
    data?.keywordPositioning ??
    data?.keyword_positionnement ??
    null;
  const marketDataSummary =
    data?.market_data_summary ??
    data?.marketDataSummary ??
    data?.market_summary ??
    null;

  let domain: string;
  try {
    domain = new URL(normalizedUrl).hostname;
  } catch {
    domain = normalizedUrl;
  }

  return {
    url: normalizedUrl,
    domain,
    totalScore: (data.overallScore ?? 0) * 2,
    maxScore: 200,
    scores: {
      performance: { score: 0, maxScore: 40, psiPerformance: 0, lcp: 0, cls: 0, tbt: 0, fcp: 0 },
      technical: { score: 0, maxScore: 50, psiSeo: 0, httpStatus: 200, isHttps: true },
      semantic: { score: 0, maxScore: 60, hasTitle: false, titleLength: 0, hasMetaDesc: false, metaDescLength: 0, h1Count: 0, hasUniqueH1: false, wordCount: 0 },
      aiReady: { score: 0, maxScore: 30, hasSchemaOrg: false, schemaTypes: [], hasRobotsTxt: false, robotsPermissive: false },
      security: { score: 0, maxScore: 20, isHttps: true, safeBrowsingOk: true, threats: [] },
    },
    recommendations: [],
    rawData: { psi: null, safeBrowsing: null, htmlAnalysis: null },
    scannedAt: data.scannedAt || new Date().toISOString(),
    strategicAnalysis: {
      // Page type detection
      isContentMode: data.isContentMode || false,
      pageType: data.pageType || (data.isContentMode ? 'editorial' : 'homepage'),
      // New 13 Modules Premium Format
      introduction: data.introduction,
      brand_authority: data.brand_authority,
      social_signals: data.social_signals,
      market_intelligence: data.market_intelligence,
      competitive_landscape: data.competitive_landscape,
      geo_readiness: data.geo_readiness,
      executive_roadmap: data.executive_roadmap,
      keyword_positioning: keywordPositioning,
      market_data_summary: marketDataSummary,
      // Standard Format (backward compatibility)
      brand_identity: data.brand_identity,
      market_positioning: data.market_positioning,
      geo_score: data.geo_score,
      strategic_roadmap: data.strategic_roadmap,
      executive_summary: data.executive_summary,
      // Legacy format
      brandPerception: data.brandPerception,
      geoAnalysis: data.geoAnalysis,
      llmVisibility: data.llmVisibility,
      testQueries: data.testQueries,
      executiveSummary: data.executiveSummary,
      overallScore: data.overallScore || data.geo_readiness?.citability_score || data.geo_score?.score,
      hallucinationCorrections: hallucinationCorrections || null,
      llm_visibility_raw: data.llm_visibility_raw || null,
      quotability: data.quotability || null,
      summary_resilience: data.summary_resilience || null,
      lexical_footprint: data.lexical_footprint || null,
      expertise_sentiment: data.expertise_sentiment || null,
      red_team: data.red_team || null,
      google_my_business: data.google_my_business || null,
      client_targets: data.client_targets || null,
    },
  };
}
