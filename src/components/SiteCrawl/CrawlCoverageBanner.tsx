import { AlertTriangle, Info } from 'lucide-react';

interface Props {
  crawledPages: number;
  sitemapCount?: number | null;
  indexedCount?: number | null;
  discoveredCount?: number | null;
  language?: string;
}

/**
 * Bandeau de couverture (P1-4) : affiche explicitement l'écart entre le volume
 * d'URLs connu du site (sitemap / index Google / découverte) et le nombre de
 * pages réellement analysées, et avertit en cas de troncature.
 */
export function CrawlCoverageBanner({
  crawledPages,
  sitemapCount,
  indexedCount,
  discoveredCount,
  language = 'fr',
}: Props) {
  const reference = Math.max(
    sitemapCount || 0,
    indexedCount || 0,
    discoveredCount || 0,
  );
  if (!crawledPages || reference <= 0) return null;

  const coverage = Math.min(100, Math.round((crawledPages / reference) * 100));
  const truncated = coverage < 95;
  const fr = language === 'fr';

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${
        truncated
          ? 'border-amber-500/40 text-amber-600 dark:text-amber-400'
          : 'border-border text-muted-foreground'
      }`}
    >
      {truncated ? (
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      ) : (
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
      )}
      <div className="space-y-1">
        <p className="font-medium">
          {fr
            ? `${crawledPages.toLocaleString()} pages analysées sur ~${reference.toLocaleString()} URLs connues (${coverage} % de couverture)`
            : `${crawledPages.toLocaleString()} pages analyzed out of ~${reference.toLocaleString()} known URLs (${coverage}% coverage)`}
        </p>
        <p className="text-[11px] opacity-90">
          {fr
            ? [
                sitemapCount != null ? `Sitemap : ${sitemapCount.toLocaleString()}` : null,
                indexedCount != null ? `Indexées : ${indexedCount.toLocaleString()}` : null,
                discoveredCount != null ? `Découvertes : ${discoveredCount.toLocaleString()}` : null,
              ].filter(Boolean).join(' · ')
            : [
                sitemapCount != null ? `Sitemap: ${sitemapCount.toLocaleString()}` : null,
                indexedCount != null ? `Indexed: ${indexedCount.toLocaleString()}` : null,
                discoveredCount != null ? `Discovered: ${discoveredCount.toLocaleString()}` : null,
              ].filter(Boolean).join(' · ')}
        </p>
        {truncated && (
          <p className="text-[11px]">
            {fr
              ? 'Analyse partielle : les constats ci-dessous ne portent que sur l\'échantillon crawlé. Relancez avec un plafond de pages plus élevé pour un diagnostic exhaustif.'
              : 'Partial analysis: findings below only cover the crawled sample. Re-run with a higher page cap for an exhaustive diagnosis.'}
          </p>
        )}
      </div>
    </div>
  );
}
