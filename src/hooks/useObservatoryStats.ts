import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ObservatoryStats {
  jsonLdPercent: number;
  avgLoadTimeMs: number;
  error404Percent: number;
  totalScans: number;
  monthlyData: { month: string; avgLoadTime: number; scans: number }[];
  trends: { jsonLd: number; loadTime: number; error404: number };
  loading: boolean;
}

export function useObservatoryStats(): ObservatoryStats {
  const [stats, setStats] = useState<ObservatoryStats>({
    jsonLdPercent: 0,
    avgLoadTimeMs: 0,
    error404Percent: 0,
    totalScans: 0,
    monthlyData: [],
    trends: { jsonLd: 0, loadTime: 0, error404: 0 },
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all scan results (public read)
        const { data, error } = await supabase
          .from('scan_results')
          .select('created_at, has_json_ld, load_time_ms, error_404_count')
          .order('created_at', { ascending: true });

        if (error || !data || data.length === 0) {
          setStats(prev => ({ ...prev, loading: false }));
          return;
        }

        const total = data.length;
        const jsonLdCount = data.filter(r => r.has_json_ld).length;
        const avgLoad = data.reduce((sum, r) => sum + r.load_time_ms, 0) / total;
        const error404Count = data.filter(r => r.error_404_count > 0).length;

        // Group by month for chart
        const monthMap = new Map<string, { totalLoad: number; count: number }>();
        data.forEach(r => {
          const d = new Date(r.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const existing = monthMap.get(key) || { totalLoad: 0, count: 0 };
          existing.totalLoad += r.load_time_ms;
          existing.count += 1;
          monthMap.set(key, existing);
        });

        const monthlyData = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-6)
          .map(([month, v]) => ({
            month,
            avgLoadTime: Math.round(v.totalLoad / v.count),
            scans: v.count,
          }));

        // Trends: compare last 30 days vs previous 30 days
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const recent = data.filter(r => now - new Date(r.created_at).getTime() < thirtyDays);
        const previous = data.filter(r => {
          const age = now - new Date(r.created_at).getTime();
          return age >= thirtyDays && age < thirtyDays * 2;
        });

        const calcTrend = (recentVal: number, prevVal: number) =>
          prevVal === 0 ? 0 : Math.round(((recentVal - prevVal) / prevVal) * 100);

        const recentJsonLd = recent.length ? (recent.filter(r => r.has_json_ld).length / recent.length) * 100 : 0;
        const prevJsonLd = previous.length ? (previous.filter(r => r.has_json_ld).length / previous.length) * 100 : 0;

        const recentLoad = recent.length ? recent.reduce((s, r) => s + r.load_time_ms, 0) / recent.length : 0;
        const prevLoad = previous.length ? previous.reduce((s, r) => s + r.load_time_ms, 0) / previous.length : 0;

        const recentErr = recent.length ? (recent.filter(r => r.error_404_count > 0).length / recent.length) * 100 : 0;
        const prevErr = previous.length ? (previous.filter(r => r.error_404_count > 0).length / previous.length) * 100 : 0;

        setStats({
          jsonLdPercent: Math.round((jsonLdCount / total) * 100),
          avgLoadTimeMs: Math.round(avgLoad),
          error404Percent: Math.round((error404Count / total) * 100),
          totalScans: total,
          monthlyData,
          trends: {
            jsonLd: calcTrend(recentJsonLd, prevJsonLd),
            loadTime: calcTrend(recentLoad, prevLoad),
            error404: calcTrend(recentErr, prevErr),
          },
          loading: false,
        });
      } catch {
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  return stats;
}
