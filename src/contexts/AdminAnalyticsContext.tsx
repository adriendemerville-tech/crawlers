import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

const EXCLUDED_IPS = ['5.49.156.158'];
const ADMIN_EMAIL = 'adriendemerville@gmail.com';
const PAGE_SIZE = 1000;
const MAX_PAGES = 5; // Cap at 5000 events to avoid long load times
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type AnalyticsEvent = {
  event_type: string;
  url: string | null;
  created_at: string;
  user_id: string | null;
  event_data: Record<string, unknown> | null;
};

interface AdminAnalyticsData {
  allEvents: AnalyticsEvent[];
  filteredEvents: AnalyticsEvent[];
  adminUserIds: string[];
  thirtyDaysAgo: string;
  isLoading: boolean;
  isRefreshing: boolean;
  lastFetched: number | null;
}

interface AdminAnalyticsContextType extends AdminAnalyticsData {
  fetchEvents: (silent?: boolean) => Promise<void>;
}

const AdminAnalyticsContext = createContext<AdminAnalyticsContextType | null>(null);

export function AdminAnalyticsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminAnalyticsData>({
    allEvents: [],
    filteredEvents: [],
    adminUserIds: [],
    thirtyDaysAgo: subDays(new Date(), 30).toISOString(),
    isLoading: false,
    isRefreshing: false,
    lastFetched: null,
  });

  const fetchingRef = useRef(false);

  const fetchEvents = useCallback(async (silent = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;

    // Skip if cache is fresh
    if (data.lastFetched && Date.now() - data.lastFetched < CACHE_TTL_MS && !silent) return;

    fetchingRef.current = true;
    setData(prev => ({
      ...prev,
      isLoading: !silent && !prev.lastFetched,
      isRefreshing: silent || !!prev.lastFetched,
    }));

    try {
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', ADMIN_EMAIL);

      const adminUserIds = adminProfiles?.map(p => p.user_id) || [];
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      let allEvents: AnalyticsEvent[] = [];
      let currentPage = 0;

      while (currentPage < MAX_PAGES) {
        const { data: rawPage, error } = await supabase
          .from('analytics_events')
          .select('event_type, url, created_at, user_id, event_data')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

        if (error) throw error;
        if (!rawPage || rawPage.length === 0) break;
        allEvents = allEvents.concat(rawPage as AnalyticsEvent[]);
        if (rawPage.length < PAGE_SIZE) break;
        currentPage++;
      }

      const filteredEvents = allEvents.filter(e => {
        if (e.user_id && adminUserIds.includes(e.user_id)) return false;
        const eventData = e.event_data as Record<string, unknown> | null;
        if (eventData?.ip && EXCLUDED_IPS.includes(eventData.ip as string)) return false;
        return true;
      });

      console.log(`📊 Shared analytics: ${allEvents.length} events loaded (${currentPage + 1} pages, capped at ${MAX_PAGES})`);

      setData({
        allEvents,
        filteredEvents,
        adminUserIds,
        thirtyDaysAgo,
        isLoading: false,
        isRefreshing: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      console.error('AdminAnalyticsContext fetch error:', err);
      setData(prev => ({ ...prev, isLoading: false, isRefreshing: false }));
    } finally {
      fetchingRef.current = false;
    }
  }, [data.lastFetched]);

  return (
    <AdminAnalyticsContext.Provider value={{ ...data, fetchEvents }}>
      {children}
    </AdminAnalyticsContext.Provider>
  );
}

export function useAdminAnalytics() {
  const ctx = useContext(AdminAnalyticsContext);
  if (!ctx) throw new Error('useAdminAnalytics must be used within AdminAnalyticsProvider');
  return ctx;
}
