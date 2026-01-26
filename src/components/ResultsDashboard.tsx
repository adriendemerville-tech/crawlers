import { CrawlResult } from '@/types/crawler';
import { BotCard } from './BotCard';
import { BotCardSkeleton } from './BotCardSkeleton';
import { ExternalLink, Globe, FileText, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { HelpButton } from './HelpButton';

interface ResultsDashboardProps {
  result: CrawlResult | null;
  isLoading: boolean;
}

export function ResultsDashboard({ result, isLoading }: ResultsDashboardProps) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl">
          {/* Scanning animation header */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-3 rounded-full bg-primary/10 px-6 py-3">
              <div className="relative h-5 w-5">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/50" />
                <div className="relative h-5 w-5 rounded-full bg-primary" />
              </div>
              <span className="text-lg font-medium text-primary">{t.crawlers.scanning}</span>
            </div>
            <p className="text-muted-foreground">{t.crawlers.checkingRobots}</p>
          </div>

          {/* Skeleton grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <BotCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!result) return null;

  const allowedCount = result.bots.filter(b => b.status === 'allowed').length;
  const blockedCount = result.bots.filter(b => b.status === 'blocked').length;

  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-6xl">
        {/* Summary header */}
        <div className="mb-8 rounded-xl border border-border bg-card p-6 card-shadow">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  {result.url}
                  <a 
                    href={result.url.startsWith('http') ? result.url : `https://${result.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    HTTP {result.httpStatus}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(result.scannedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="rounded-lg bg-success/10 px-4 py-2 text-center">
                <div className="text-2xl font-bold text-success">{allowedCount}</div>
                <div className="text-xs text-success/80 flex items-center gap-1">
                  {t.results.allowed}
                  <HelpButton term="robots-txt" size="sm" />
                </div>
              </div>
              <div className="rounded-lg bg-destructive/10 px-4 py-2 text-center">
                <div className="text-2xl font-bold text-destructive">{blockedCount}</div>
                <div className="text-xs text-destructive/80 flex items-center gap-1">
                  {t.results.blocked}
                  <HelpButton term="robots-txt" size="sm" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bot cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.bots.map((bot, index) => (
            <div 
              key={bot.name} 
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <BotCard bot={bot} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}