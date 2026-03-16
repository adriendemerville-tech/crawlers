import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CrawlPagesStats {
  median: number;
  average: number;
  totalCrawls: number;
  loading: boolean;
}

export function useCrawlPagesStats(): CrawlPagesStats {
  const [stats, setStats] = useState<CrawlPagesStats>({ median: 0, average: 0, totalCrawls: 0, loading: true });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('site_crawls')
        .select('crawled_pages')
        .eq('status', 'completed')
        .gt('crawled_pages', 0);

      if (!data || data.length === 0) {
        setStats({ median: 0, average: 0, totalCrawls: 0, loading: false });
        return;
      }

      const values = data.map(d => d.crawled_pages).sort((a, b) => a - b);
      const n = values.length;
      const median = n % 2 === 0
        ? Math.round((values[n / 2 - 1] + values[n / 2]) / 2)
        : values[Math.floor(n / 2)];
      const average = Math.round(values.reduce((s, v) => s + v, 0) / n);

      setStats({ median, average, totalCrawls: n, loading: false });
    })();
  }, []);

  return stats;
}
