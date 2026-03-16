import { Hash, TrendingUp, TrendingDown, Home, Award, Target, BarChart3, RefreshCw, Loader2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';

interface SerpData {
  total_keywords: number;
  avg_position: number | null;
  homepage_position: number | null;
  top_3: number;
  top_10: number;
  top_50: number;
  etv: number;
  indexed_pages?: number | null;
  measured_at?: string;
}

interface SerpKpiBannerProps {
  data: SerpData | null | undefined;
  previousIndexedPages?: number | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const translations = {
  fr: {
    title: 'Classement SERP',
    subtitle: 'DataForSEO',
    avgPosition: 'Position moyenne',
    homepageRank: 'Ranking page d\'accueil',
    totalKeywords: 'Mots-clés adressés',
    indexedPages: 'Pages indexées',
    noData: 'Aucune donnée SERP disponible. Lancez un audit pour collecter les données.',
  },
  en: {
    title: 'SERP Ranking',
    subtitle: 'DataForSEO',
    avgPosition: 'Average Position',
    homepageRank: 'Homepage Ranking',
    totalKeywords: 'Ranked Keywords',
    indexedPages: 'Indexed Pages',
    noData: 'No SERP data available. Run an audit to collect data.',
  },
  es: {
    title: 'Clasificación SERP',
    subtitle: 'DataForSEO',
    avgPosition: 'Posición media',
    homepageRank: 'Ranking página principal',
    totalKeywords: 'Palabras clave posicionadas',
    indexedPages: 'Páginas indexadas',
    noData: 'No hay datos SERP disponibles. Ejecute una auditoría para recopilar datos.',
  },
};

function positionColor(pos: number | null): string {
  if (pos === null) return 'text-muted-foreground';
  if (pos <= 3) return 'text-green-600 dark:text-green-400';
  if (pos <= 10) return 'text-emerald-600 dark:text-emerald-400';
  if (pos <= 20) return 'text-yellow-600 dark:text-yellow-400';
  if (pos <= 50) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function DistributionBar({ top3, top10, top50, total }: { top3: number; top10: number; top50: number; total: number }) {
  if (total === 0) return null;
  
  const pct3 = (top3 / total) * 100;
  const pct10 = ((top10 - top3) / total) * 100;
  const pct50 = ((top50 - top10) / total) * 100;
  const pctRest = ((total - top50) / total) * 100;

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex gap-0.5 h-3 rounded-full overflow-hidden">
          {pct3 > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-green-500 dark:bg-green-400 transition-all" style={{ width: `${Math.max(pct3, 2)}%` }} />
              </TooltipTrigger>
              <TooltipContent>Top 3: {top3} ({pct3.toFixed(1)}%)</TooltipContent>
            </Tooltip>
          )}
          {pct10 > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-emerald-400 dark:bg-emerald-500 transition-all" style={{ width: `${Math.max(pct10, 2)}%` }} />
              </TooltipTrigger>
              <TooltipContent>Top 4–10: {top10 - top3} ({pct10.toFixed(1)}%)</TooltipContent>
            </Tooltip>
          )}
          {pct50 > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-yellow-400 dark:bg-yellow-500 transition-all" style={{ width: `${Math.max(pct50, 2)}%` }} />
              </TooltipTrigger>
              <TooltipContent>Top 11–50: {top50 - top10} ({pct50.toFixed(1)}%)</TooltipContent>
            </Tooltip>
          )}
          {pctRest > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-muted transition-all" style={{ width: `${Math.max(pctRest, 2)}%` }} />
              </TooltipTrigger>
              <TooltipContent>50+: {total - top50} ({pctRest.toFixed(1)}%)</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />Top 3: <strong className="text-foreground">{top3}</strong></span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Top 10: <strong className="text-foreground">{top10}</strong></span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" />Top 50: <strong className="text-foreground">{top50}</strong></span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted" />50+: <strong className="text-foreground">{total - top50}</strong></span>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function SerpKpiBanner({ data, previousIndexedPages, onRefresh, isRefreshing }: SerpKpiBannerProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  // Compute indexed pages trend (min ±5%)
  const indexedPagesTrend = (() => {
    if (data?.indexed_pages == null || previousIndexedPages == null || previousIndexedPages === 0) return null;
    const pctChange = ((data.indexed_pages - previousIndexedPages) / previousIndexedPages) * 100;
    if (pctChange >= 5) return { direction: 'up' as const, pct: pctChange };
    if (pctChange <= -5) return { direction: 'down' as const, pct: pctChange };
    return null;
  })();

  if (!data || data.total_keywords === 0) {
    return (
      <Card className="border-dashed opacity-80 relative">
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>{t.noData}</p>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isRefreshing 
                ? (language === 'fr' ? 'Analyse en cours…' : 'Analyzing…') 
                : (language === 'fr' ? 'Analyser maintenant' : 'Analyze now')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Award className="h-4 w-4" />
          {t.title}
          <Badge variant="secondary" className="text-[10px] font-normal">{t.subtitle}</Badge>
          {data.measured_at && (
            <span className="ml-auto text-[10px] text-muted-foreground font-normal">
              {new Date(data.measured_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
            </span>
          )}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Home className="h-3 w-3" />
              {t.homepageRank}
            </div>
            <p className={`text-lg font-semibold ${positionColor(data.homepage_position)}`}>
              {data.homepage_position !== null ? `#${data.homepage_position}` : '—'}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" />
              {t.totalKeywords}
            </div>
            <p className="text-lg font-semibold">{data.total_keywords.toLocaleString()}</p>
          </div>

          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Target className="h-3 w-3" />
              ETV
            </div>
            <p className="text-lg font-semibold text-primary">{data.etv.toLocaleString()}</p>
          </div>

          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              {t.indexedPages}
            </div>
            <p className="text-lg font-semibold flex items-center gap-1">
              {data.indexed_pages != null ? data.indexed_pages.toLocaleString() : '—'}
              {indexedPagesTrend && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center">
                      {indexedPagesTrend.direction === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {indexedPagesTrend.direction === 'up' ? '+' : ''}{indexedPagesTrend.pct.toFixed(1)}%
                    {previousIndexedPages != null && ` (${language === 'fr' ? 'avant' : 'prev'}: ${previousIndexedPages.toLocaleString()})`}
                  </TooltipContent>
                </Tooltip>
              )}
            </p>
          </div>
        </div>

        {/* Distribution bar */}
        <DistributionBar 
          top3={data.top_3} 
          top10={data.top_10} 
          top50={data.top_50} 
          total={data.total_keywords} 
        />
      </CardContent>
    </Card>
  );
}