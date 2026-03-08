import { PageSpeedResult } from '@/types/pagespeed';
import { ScoreGauge } from './ScoreGauge';
import { MetricCard } from './MetricCard';
import { Smartphone, Monitor, Clock, Zap, Move, Timer, Gauge, MousePointer, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { HelpButton } from './HelpButton';

interface PageSpeedDashboardProps {
  result: PageSpeedResult | null;
  isLoading: boolean;
  strategy: 'mobile' | 'desktop';
  onStrategyChange: (strategy: 'mobile' | 'desktop') => void;
}

// Parse une valeur de temps (ex: "2.5s", "250 ms") en millisecondes
function parseTimeToMs(value: string): number {
  const cleaned = value.toLowerCase().trim();
  if (cleaned.includes('ms')) {
    return parseFloat(cleaned.replace(/[^0-9.,]/g, '').replace(',', '.'));
  }
  // Assume seconds if 's' or no unit
  return parseFloat(cleaned.replace(/[^0-9.,]/g, '').replace(',', '.')) * 1000;
}

// Convertit une métrique Core Web Vitals en score 0-100 selon les seuils PageSpeed officiels
function getMetricScore(metricName: string, value: string): number {
  const numValue = parseFloat(value.replace(/[^0-9.,]/g, '').replace(',', '.'));
  
  switch (metricName) {
    case 'lcp': {
      // LCP: < 2.5s = bon (90+), < 4s = moyen (60-89), >= 4s = mauvais (<60)
      const ms = parseTimeToMs(value);
      if (ms <= 2500) return 95;
      if (ms <= 4000) return 75;
      return 40;
    }
    case 'fcp': {
      // FCP: < 1.8s = bon, < 3s = moyen, >= 3s = mauvais
      const ms = parseTimeToMs(value);
      if (ms <= 1800) return 95;
      if (ms <= 3000) return 75;
      return 40;
    }
    case 'cls': {
      // CLS: < 0.1 = bon, < 0.25 = moyen, >= 0.25 = mauvais
      if (numValue <= 0.1) return 95;
      if (numValue <= 0.25) return 75;
      return 40;
    }
    case 'tbt': {
      // TBT: < 200ms = bon, < 600ms = moyen, >= 600ms = mauvais
      const ms = parseTimeToMs(value);
      if (ms <= 200) return 95;
      if (ms <= 600) return 75;
      return 40;
    }
    case 'speedIndex': {
      // Speed Index: < 3.4s = bon, < 5.8s = moyen, >= 5.8s = mauvais
      const ms = parseTimeToMs(value);
      if (ms <= 3400) return 95;
      if (ms <= 5800) return 75;
      return 40;
    }
    case 'tti': {
      // TTI: < 3.8s = bon, < 7.3s = moyen, >= 7.3s = mauvais
      const ms = parseTimeToMs(value);
      if (ms <= 3800) return 95;
      if (ms <= 7300) return 75;
      return 40;
    }
    default:
      return 75; // Valeur neutre par défaut
  }
}

// Composant d'animation de chargement
function LoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
      <div className="mt-6 flex items-center gap-1 text-lg font-medium text-foreground">
        <span>Analyse</span>
        <span className="inline-flex w-6">
          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
        </span>
      </div>
    </div>
  );
}

export function PageSpeedDashboard({ result, isLoading, strategy, onStrategyChange }: PageSpeedDashboardProps) {
  const { t } = useLanguage();

  if (isLoading && !result) {
    return (
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-foreground">{t.pagespeed.title}</h2>
            <div className="flex gap-2">
              <button
                disabled
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  strategy === 'mobile'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Smartphone className="h-4 w-4" />
                {t.pagespeed.mobile}
              </button>
              <button
                disabled
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  strategy === 'desktop'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Monitor className="h-4 w-4" />
                {t.pagespeed.desktop}
              </button>
            </div>
          </div>
          
          <div className="rounded-xl border border-border bg-card card-shadow">
            <LoadingAnimation />
          </div>
        </div>
      </section>
    );
  }

  if (!result) return null;

  const { scores } = result;
  const isFieldData = result.dataSource === 'field';

  // Adapt labels for field vs lab data
  const tbtLabel = isFieldData ? 'INP' : t.pagespeed.tbt;
  const tbtDesc = isFieldData ? 'Interaction to Next Paint — réactivité réelle mesurée chez les utilisateurs' : t.pagespeed.tbtDesc;
  const ttiLabel = isFieldData ? 'TTFB' : t.pagespeed.tti;
  const ttiDesc = isFieldData ? 'Time to First Byte — temps de réponse serveur mesuré en conditions réelles' : t.pagespeed.ttiDesc;

  return (
    <section className="px-4 pb-12">
      <div className="mx-auto max-w-6xl">
        {/* Header with strategy toggle */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-foreground">{t.pagespeed.title}</h2>
          
          <div className="flex gap-2">
            <button
              onClick={() => onStrategyChange('mobile')}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                strategy === 'mobile'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Smartphone className="h-4 w-4" />
              {t.pagespeed.mobile}
            </button>
            <button
              onClick={() => onStrategyChange('desktop')}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                strategy === 'desktop'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Monitor className="h-4 w-4" />
              {t.pagespeed.desktop}
            </button>
          </div>
        </div>

        {/* Main scores */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreGauge score={scores.performance} label={t.pagespeed.performance} />
          <ScoreGauge score={scores.accessibility} label={t.pagespeed.accessibility} />
          <ScoreGauge score={scores.bestPractices} label={t.pagespeed.bestPractices} />
          <ScoreGauge score={scores.seo} label={t.pagespeed.seo} />
        </div>

        {/* Core Web Vitals */}
        <div className="rounded-xl border border-border bg-card p-6 card-shadow">
          <h3 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
            {t.pagespeed.coreWebVitals}
            {isFieldData && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                ● Données terrain (CrUX)
              </span>
            )}
            {!isFieldData && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                ◉ Données labo (Lighthouse)
              </span>
            )}
            <HelpButton term="core-web-vitals" size="md" />
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              icon={Zap}
              label={t.pagespeed.fcp}
              value={scores.fcp}
              description={t.pagespeed.fcpDesc}
              score={getMetricScore('fcp', scores.fcp)}
            />
            <MetricCard
              icon={Timer}
              label={t.pagespeed.lcp}
              value={scores.lcp}
              description={t.pagespeed.lcpDesc}
              score={getMetricScore('lcp', scores.lcp)}
            />
            <MetricCard
              icon={Move}
              label={t.pagespeed.cls}
              value={scores.cls}
              description={t.pagespeed.clsDesc}
              score={getMetricScore('cls', scores.cls)}
            />
            <MetricCard
              icon={Clock}
              label={tbtLabel}
              value={scores.tbt}
              description={tbtDesc}
              score={getMetricScore(isFieldData ? 'inp' : 'tbt', scores.tbt)}
            />
            <MetricCard
              icon={Gauge}
              label={t.pagespeed.speedIndex}
              value={scores.speedIndex}
              description={t.pagespeed.speedIndexDesc}
              score={getMetricScore('speedIndex', scores.speedIndex)}
            />
            <MetricCard
              icon={MousePointer}
              label={ttiLabel}
              value={scores.tti}
              description={ttiDesc}
              score={getMetricScore(isFieldData ? 'ttfb' : 'tti', scores.tti)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}