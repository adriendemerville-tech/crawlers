import { memo } from 'react';

/**
 * Lightweight skeleton for ExpertAudit page
 * Renders immediately without JS dependencies
 * Optimized for FCP/LCP - no external library imports
 */
function ExpertAuditSkeletonComponent() {
  return (
    <div className="w-full">
      {/* Static Hero Section - SSR/GEO friendly */}
      <section className="px-4 pt-8 pb-6">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge skeleton */}
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 mb-4">
            <div className="h-4 w-4 rounded bg-primary/30" />
            <span className="text-sm font-medium text-primary">Audit Expert SEO & IA</span>
          </div>
          
          {/* H1 - Critical for SEO/GEO - Always visible */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Score SEO 200 - Audit Expert
          </h1>
          
          {/* Subtitle - Important for GEO */}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Analysez votre site en profondeur avec notre audit SEO & IA complet sur 200 points.
          </p>
          
          {/* Progress bar skeleton */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-0 bg-primary/50 rounded-full" />
            </div>
            <div className="flex justify-between mt-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground"
                >
                  {i}
                </div>
              ))}
            </div>
          </div>

          {/* URL Input skeleton */}
          <div className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 rounded bg-muted-foreground/20" />
              <div className="h-14 w-full rounded-lg border border-border bg-background pl-12" />
            </div>
          </div>
        </div>
      </section>

      {/* Cards skeleton */}
      <div className="flex justify-center gap-6 px-4 py-8">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="w-[340px] sm:w-[380px] rounded-xl border border-border bg-card p-8 animate-pulse"
            style={{ opacity: i === 1 ? 1 : 0.6 }}
          >
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded-t-xl" />
            
            {/* Icon */}
            <div className="w-14 h-14 rounded-xl bg-muted mb-6" />
            
            {/* Title */}
            <div className="h-6 w-3/4 rounded bg-muted mb-2" />
            
            {/* Description */}
            <div className="space-y-2 mb-6">
              <div className="h-4 w-full rounded bg-muted/60" />
              <div className="h-4 w-2/3 rounded bg-muted/60" />
            </div>
            
            {/* Button */}
            <div className="h-12 w-full rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export const ExpertAuditSkeleton = memo(ExpertAuditSkeletonComponent);
