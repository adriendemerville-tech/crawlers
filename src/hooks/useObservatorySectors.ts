import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SectorData {
  sector: string;
  source: string;
  period: string;
  total_scans: number;
  json_ld_rate: number | null;
  sitemap_rate: number | null;
  robots_txt_rate: number | null;
  meta_description_rate: number | null;
  open_graph_rate: number | null;
  canonical_rate: number | null;
  hreflang_rate: number | null;
  https_rate: number | null;
  mobile_friendly_rate: number | null;
  schema_org_rate: number | null;
  avg_load_time_ms: number | null;
  avg_ttfb_ms: number | null;
  avg_fcp_ms: number | null;
  avg_lcp_ms: number | null;
  avg_cls: number | null;
  avg_seo_score: number | null;
  avg_word_count: number | null;
  avg_images_without_alt: number | null;
  avg_broken_links: number | null;
  updated_at: string;
}

export interface SectorTrend {
  period: string;
  sector: string;
  json_ld_rate: number;
  https_rate: number;
  mobile_friendly_rate: number;
  schema_org_rate: number;
  avg_seo_score: number;
  avg_lcp_ms: number;
  total_scans: number;
}

export interface ObservatorySectorsState {
  sectors: SectorData[];
  trends: SectorTrend[];
  sectorNames: string[];
  loading: boolean;
}

export function useObservatorySectors(): ObservatorySectorsState {
  const [state, setState] = useState<ObservatorySectorsState>({
    sectors: [],
    trends: [],
    sectorNames: [],
    loading: true,
  });

  useEffect(() => {
    const fetch = async () => {
      try {
        // Fetch all observatory_sectors data
        const { data, error } = await supabase
          .from('observatory_sectors')
          .select('*')
          .order('period', { ascending: true });

        if (error || !data) {
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        const sectors = data as SectorData[];

        // Extract unique sector names
        const sectorNames = [...new Set(sectors.map(s => s.sector))].sort();

        // Build trends: group by period+sector, take the latest source per period
        const trendMap = new Map<string, SectorTrend>();
        for (const row of sectors) {
          // Prefer expert_audit source over others for sector data
          const key = `${row.period}__${row.sector}`;
          const existing = trendMap.get(key);
          if (!existing || row.source === 'expert_audit') {
            trendMap.set(key, {
              period: row.period,
              sector: row.sector,
              json_ld_rate: row.json_ld_rate ?? 0,
              https_rate: row.https_rate ?? 0,
              mobile_friendly_rate: row.mobile_friendly_rate ?? 0,
              schema_org_rate: row.schema_org_rate ?? 0,
              avg_seo_score: row.avg_seo_score ?? 0,
              avg_lcp_ms: row.avg_lcp_ms ?? 0,
              total_scans: row.total_scans,
            });
          }
        }

        const trends = Array.from(trendMap.values())
          .sort((a, b) => a.period.localeCompare(b.period));

        setState({ sectors, trends, sectorNames, loading: false });
      } catch {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    fetch();
  }, []);

  return state;
}
