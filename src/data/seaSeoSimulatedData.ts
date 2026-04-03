export interface SimulatedOpportunity {
  keyword: string;
  sea_clicks: number;
  sea_cpc: number;
  sea_conversions: number;
  sea_cost: number;
  sea_campaign: string;
  organic_position: number | null;
  organic_clicks: number;
  organic_impressions: number;
  has_cocoon_gap: boolean;
  cocoon_gap_id: string | null;
  opportunity_score: number;
  opportunity_type: 'no_organic' | 'low_organic' | 'high_potential' | 'cannibalisation_risk';
  monthly_savings_potential: number;
}

export interface SimulatedSummary {
  total_keywords: number;
  total_sea_cost_eur: number;
  potential_monthly_savings_eur: number;
  no_organic_count: number;
  cannibalisation_count: number;
  cocoon_aligned_count: number;
  data_source: 'live' | 'simulated';
}

export const SIMULATED_OPPORTUNITIES: SimulatedOpportunity[] = [
  {
    keyword: 'audit seo gratuit',
    sea_clicks: 342,
    sea_cpc: 2.45,
    sea_conversions: 18,
    sea_cost: 837.90,
    sea_campaign: 'Acquisition SEO Tools',
    organic_position: null,
    organic_clicks: 0,
    organic_impressions: 12,
    has_cocoon_gap: true,
    cocoon_gap_id: 'sim-gap-001',
    opportunity_score: 92,
    opportunity_type: 'no_organic',
    monthly_savings_potential: 837.90,
  },
  {
    keyword: 'optimisation site internet',
    sea_clicks: 187,
    sea_cpc: 3.12,
    sea_conversions: 9,
    sea_cost: 583.44,
    sea_campaign: 'Acquisition SEO Tools',
    organic_position: 18,
    organic_clicks: 23,
    organic_impressions: 890,
    has_cocoon_gap: true,
    cocoon_gap_id: 'sim-gap-002',
    opportunity_score: 85,
    opportunity_type: 'low_organic',
    monthly_savings_potential: 450.00,
  },
  {
    keyword: 'crawler seo en ligne',
    sea_clicks: 156,
    sea_cpc: 4.80,
    sea_conversions: 12,
    sea_cost: 748.80,
    sea_campaign: 'Brand + Generic',
    organic_position: 4,
    organic_clicks: 289,
    organic_impressions: 3200,
    has_cocoon_gap: false,
    cocoon_gap_id: null,
    opportunity_score: 78,
    opportunity_type: 'cannibalisation_risk',
    monthly_savings_potential: 748.80,
  },
  {
    keyword: 'analyse maillage interne',
    sea_clicks: 98,
    sea_cpc: 1.95,
    sea_conversions: 5,
    sea_cost: 191.10,
    sea_campaign: 'Cocoon Features',
    organic_position: 25,
    organic_clicks: 8,
    organic_impressions: 450,
    has_cocoon_gap: true,
    cocoon_gap_id: 'sim-gap-003',
    opportunity_score: 74,
    opportunity_type: 'low_organic',
    monthly_savings_potential: 155.00,
  },
  {
    keyword: 'outil seo ia',
    sea_clicks: 276,
    sea_cpc: 5.20,
    sea_conversions: 14,
    sea_cost: 1435.20,
    sea_campaign: 'AI SEO Tools',
    organic_position: null,
    organic_clicks: 0,
    organic_impressions: 5,
    has_cocoon_gap: false,
    cocoon_gap_id: null,
    opportunity_score: 88,
    opportunity_type: 'no_organic',
    monthly_savings_potential: 1435.20,
  },
  {
    keyword: 'référencement naturel prix',
    sea_clicks: 210,
    sea_cpc: 2.85,
    sea_conversions: 7,
    sea_cost: 598.50,
    sea_campaign: 'Acquisition SEO Tools',
    organic_position: 12,
    organic_clicks: 45,
    organic_impressions: 1800,
    has_cocoon_gap: true,
    cocoon_gap_id: 'sim-gap-004',
    opportunity_score: 81,
    opportunity_type: 'high_potential',
    monthly_savings_potential: 390.00,
  },
  {
    keyword: 'crawlers seo',
    sea_clicks: 520,
    sea_cpc: 3.50,
    sea_conversions: 28,
    sea_cost: 1820.00,
    sea_campaign: 'Brand',
    organic_position: 2,
    organic_clicks: 1200,
    organic_impressions: 8500,
    has_cocoon_gap: false,
    cocoon_gap_id: null,
    opportunity_score: 95,
    opportunity_type: 'cannibalisation_risk',
    monthly_savings_potential: 1820.00,
  },
  {
    keyword: 'geo seo optimisation',
    sea_clicks: 67,
    sea_cpc: 1.80,
    sea_conversions: 3,
    sea_cost: 120.60,
    sea_campaign: 'GEO Features',
    organic_position: null,
    organic_clicks: 0,
    organic_impressions: 0,
    has_cocoon_gap: true,
    cocoon_gap_id: 'sim-gap-005',
    opportunity_score: 68,
    opportunity_type: 'no_organic',
    monthly_savings_potential: 120.60,
  },
];

export const SIMULATED_SUMMARY: SimulatedSummary = {
  total_keywords: SIMULATED_OPPORTUNITIES.length,
  total_sea_cost_eur: SIMULATED_OPPORTUNITIES.reduce((sum, o) => sum + o.sea_cost, 0),
  potential_monthly_savings_eur: SIMULATED_OPPORTUNITIES.reduce((sum, o) => sum + o.monthly_savings_potential, 0),
  no_organic_count: SIMULATED_OPPORTUNITIES.filter(o => o.opportunity_type === 'no_organic').length,
  cannibalisation_count: SIMULATED_OPPORTUNITIES.filter(o => o.opportunity_type === 'cannibalisation_risk').length,
  cocoon_aligned_count: SIMULATED_OPPORTUNITIES.filter(o => o.has_cocoon_gap).length,
  data_source: 'simulated',
};
