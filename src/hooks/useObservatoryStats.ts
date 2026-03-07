import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type BooleanField = 'has_json_ld' | 'has_sitemap' | 'has_robots_txt' | 'has_meta_description'
  | 'has_open_graph' | 'has_twitter_cards' | 'has_canonical' | 'has_hreflang'
  | 'has_https' | 'is_mobile_friendly' | 'has_viewport_meta';

type NumericField = 'load_time_ms' | 'error_404_count' | 'dom_size_kb' | 'total_requests'
  | 'image_count' | 'images_without_alt' | 'css_files_count' | 'js_files_count'
  | 'ttfb_ms' | 'fcp_ms' | 'lcp_ms' | 'cls_score';

export interface ObservatoryStats {
  booleanKpis: Record<BooleanField, { percent: number; trend: number }>;
  numericKpis: Record<NumericField, { avg: number; trend: number }>;
  totalScans: number;
  monthlyData: { month: string; avgLoadTime: number; avgTtfb: number; avgFcp: number; avgLcp: number; scans: number }[];
  loading: boolean;
}

const BOOLEAN_FIELDS: BooleanField[] = [
  'has_json_ld', 'has_sitemap', 'has_robots_txt', 'has_meta_description',
  'has_open_graph', 'has_twitter_cards', 'has_canonical', 'has_hreflang',
  'has_https', 'is_mobile_friendly', 'has_viewport_meta',
];

const NUMERIC_FIELDS: NumericField[] = [
  'load_time_ms', 'error_404_count', 'dom_size_kb', 'total_requests',
  'image_count', 'images_without_alt', 'css_files_count', 'js_files_count',
  'ttfb_ms', 'fcp_ms', 'lcp_ms', 'cls_score',
];

const calcTrend = (recent: number, prev: number) =>
  prev === 0 ? 0 : Math.round(((recent - prev) / prev) * 100);

export function useObservatoryStats(): ObservatoryStats {
  const [stats, setStats] = useState<ObservatoryStats>({
    booleanKpis: Object.fromEntries(BOOLEAN_FIELDS.map(f => [f, { percent: 0, trend: 0 }])) as any,
    numericKpis: Object.fromEntries(NUMERIC_FIELDS.map(f => [f, { avg: 0, trend: 0 }])) as any,
    totalScans: 0,
    monthlyData: [],
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('scan_results')
          .select('*')
          .order('created_at', { ascending: true });

        if (error || !data || data.length === 0) {
          setStats(prev => ({ ...prev, loading: false }));
          return;
        }

        const total = data.length;
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const recent = data.filter(r => now - new Date(r.created_at).getTime() < thirtyDays);
        const previous = data.filter(r => {
          const age = now - new Date(r.created_at).getTime();
          return age >= thirtyDays && age < thirtyDays * 2;
        });

        // Boolean KPIs
        const booleanKpis = {} as ObservatoryStats['booleanKpis'];
        for (const f of BOOLEAN_FIELDS) {
          const pct = Math.round((data.filter(r => (r as any)[f]).length / total) * 100);
          const rPct = recent.length ? (recent.filter(r => (r as any)[f]).length / recent.length) * 100 : 0;
          const pPct = previous.length ? (previous.filter(r => (r as any)[f]).length / previous.length) * 100 : 0;
          booleanKpis[f] = { percent: pct, trend: calcTrend(rPct, pPct) };
        }

        // Numeric KPIs
        const numericKpis = {} as ObservatoryStats['numericKpis'];
        for (const f of NUMERIC_FIELDS) {
          const avg = Math.round(data.reduce((s, r) => s + ((r as any)[f] || 0), 0) / total);
          const rAvg = recent.length ? recent.reduce((s, r) => s + ((r as any)[f] || 0), 0) / recent.length : 0;
          const pAvg = previous.length ? previous.reduce((s, r) => s + ((r as any)[f] || 0), 0) / previous.length : 0;
          numericKpis[f] = { avg, trend: calcTrend(rAvg, pAvg) };
        }

        // Monthly data for chart
        const monthMap = new Map<string, { load: number; ttfb: number; fcp: number; lcp: number; count: number }>();
        data.forEach(r => {
          const d = new Date(r.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const existing = monthMap.get(key) || { load: 0, ttfb: 0, fcp: 0, lcp: 0, count: 0 };
          existing.load += r.load_time_ms;
          existing.ttfb += r.ttfb_ms;
          existing.fcp += r.fcp_ms;
          existing.lcp += r.lcp_ms;
          existing.count += 1;
          monthMap.set(key, existing);
        });

        const monthlyData = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-6)
          .map(([month, v]) => ({
            month,
            avgLoadTime: Math.round(v.load / v.count),
            avgTtfb: Math.round(v.ttfb / v.count),
            avgFcp: Math.round(v.fcp / v.count),
            avgLcp: Math.round(v.lcp / v.count),
            scans: v.count,
          }));

        setStats({ booleanKpis, numericKpis, totalScans: total, monthlyData, loading: false });
      } catch {
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  return stats;
}
