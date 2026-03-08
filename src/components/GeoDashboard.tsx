import { GeoResult } from '@/types/geo';
import { GeoScoreGauge } from './GeoScoreGauge';
import { GeoFactorCard } from './GeoFactorCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Sparkles, ExternalLink, Clock, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { HelpButton } from './HelpButton';

interface GeoDashboardProps {
  result: GeoResult | null;
  isLoading: boolean;
}

export function GeoDashboard({ result, isLoading }: GeoDashboardProps) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col items-center">
            <Skeleton className="h-40 w-40 rounded-full" />
            <Skeleton className="mt-4 h-6 w-24" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-8 w-12" />
                </div>
                <Skeleton className="mt-3 h-2 w-full rounded-full" />
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!result) return null;

  const passedFactors = result.factors.filter(f => f.status === 'good').length;
  const totalFactors = result.factors.length;

  return (
    <section className="px-4 pb-12">
      <div className="mx-auto max-w-6xl">
        {/* Header with score */}
        <div className="mb-8 rounded-xl border border-border bg-card p-8 card-shadow">
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
            <div className="flex flex-col items-center lg:items-start">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">{t.geo.title}</span>
                <HelpButton term="geo" size="sm" />
              </div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                {result.url}
                <a 
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </h2>
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(result.scannedAt).toLocaleTimeString()}
                </span>
                <span>{passedFactors}/{totalFactors} {t.geo.checksPassed}</span>
              </div>
            </div>

            <GeoScoreGauge score={result.totalScore} />
          </div>
        </div>

        {/* Info box */}
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-foreground">
            <strong>{t.geo.whatIsGeo.split('?')[0]}?</strong> {t.geo.whatIsGeo.split('?')[1]}
          </p>
        </div>

        {/* Misplaced head tags alert */}
        {result.misplacedHeadTags && result.misplacedHeadTags.length > 0 && (
          <Card className="mb-6 border-warning/40 bg-warning/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Balise mal placée (hors du &lt;head&gt;)
                </h4>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {result.misplacedHeadTags.length > 1 ? 'Ces balises sont' : 'Cette balise est'} actuellement dans le &lt;body&gt;. Google l'ignore à cet emplacement, ce qui rend l'instruction inefficace et peut indiquer une erreur d'intégration ou une injection HTML.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.misplacedHeadTags.map(tag => (
                    <span key={tag} className="inline-flex items-center rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                      &lt;{tag}&gt;
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Factor cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {result.factors.map((factor, index) => (
            <div 
              key={factor.id}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <GeoFactorCard factor={factor} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}