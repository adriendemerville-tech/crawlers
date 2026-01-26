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
            <HelpButton term="core-web-vitals" size="md" />
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              icon={Zap}
              label={t.pagespeed.fcp}
              value={scores.fcp}
              description={t.pagespeed.fcpDesc}
            />
            <MetricCard
              icon={Timer}
              label={t.pagespeed.lcp}
              value={scores.lcp}
              description={t.pagespeed.lcpDesc}
            />
            <MetricCard
              icon={Move}
              label={t.pagespeed.cls}
              value={scores.cls}
              description={t.pagespeed.clsDesc}
            />
            <MetricCard
              icon={Clock}
              label={t.pagespeed.tbt}
              value={scores.tbt}
              description={t.pagespeed.tbtDesc}
            />
            <MetricCard
              icon={Gauge}
              label={t.pagespeed.speedIndex}
              value={scores.speedIndex}
              description={t.pagespeed.speedIndexDesc}
            />
            <MetricCard
              icon={MousePointer}
              label={t.pagespeed.tti}
              value={scores.tti}
              description={t.pagespeed.ttiDesc}
            />
          </div>
        </div>
      </div>
    </section>
  );
}