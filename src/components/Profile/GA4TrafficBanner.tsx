import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface GA4TrafficBannerProps {
  domain: string;
  simulatedDataEnabled?: boolean;
}

const SIMULATED_ALERTS = [
  { page: '/guide-seo-2025', delta: +34, metric: 'sessions' },
  { page: '/audit-technique', delta: +18, metric: 'users' },
  { page: '/blog/core-web-vitals', delta: -12, metric: 'sessions' },
  { page: '/tarifs', delta: +52, metric: 'conversions' },
  { page: '/contact', delta: -8, metric: 'bounce_rate' },
  { page: '/blog/netlinking-guide', delta: +27, metric: 'sessions' },
  { page: '/outil-crawl', delta: +41, metric: 'users' },
  { page: '/faq', delta: -5, metric: 'sessions' },
];

const translations = {
  fr: {
    sessions: 'sessions',
    users: 'utilisateurs',
    conversions: 'conversions',
    bounce_rate: 'taux de rebond',
    via: 'via GA4',
  },
  en: {
    sessions: 'sessions',
    users: 'users',
    conversions: 'conversions',
    bounce_rate: 'bounce rate',
    via: 'via GA4',
  },
  es: {
    sessions: 'sesiones',
    users: 'usuarios',
    conversions: 'conversiones',
    bounce_rate: 'tasa de rebote',
    via: 'via GA4',
  },
};

export function GA4TrafficBanner({ domain, simulatedDataEnabled = false }: GA4TrafficBannerProps) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const alerts = useMemo(() => {
    if (!simulatedDataEnabled) return [];
    return SIMULATED_ALERTS.map((a) => {
      const isUp = a.delta > 0;
      const metricLabel = t[a.metric as keyof typeof t] || a.metric;
      const sign = isUp ? '+' : '';
      return {
        ...a,
        isUp,
        label: `${a.page} ${sign}${a.delta}% ${metricLabel}`,
      };
    });
  }, [simulatedDataEnabled, t]);

  if (alerts.length === 0) return null;

  // Double items for seamless loop
  const doubled = [...alerts, ...alerts];

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card/50 backdrop-blur-sm h-8 flex items-center">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-card/50 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-card/50 to-transparent z-10 pointer-events-none" />
      
      <div className="flex items-center gap-6 animate-marquee whitespace-nowrap">
        {doubled.map((alert, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-medium">
            {alert.isUp ? (
              <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
            )}
            <span className={alert.isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
              {alert.label}
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-muted-foreground/40 text-[10px]">{t.via}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
