import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface QuotaExceededProps {
  onRetry?: () => void;
}

export function QuotaExceeded({ onRetry }: QuotaExceededProps) {
  return (
    <section className="px-4 pb-12">
      <div className="mx-auto max-w-2xl">
        <Card className="border-warning/30 bg-warning/5 p-8 text-center card-shadow">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/20">
            <AlertTriangle className="h-8 w-8 text-warning" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            Daily Quota Exceeded
          </h3>
          <p className="mb-6 text-muted-foreground">
            The free PageSpeed Insights API has reached its daily limit. 
            This typically resets at midnight Pacific Time.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>Options:</strong>
            </p>
            <ul className="mx-auto max-w-md space-y-2 text-left text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Try the <strong>AI Bot Checker</strong> tab instead (no quota limits)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  Use Google's official{' '}
                  <a 
                    href="https://pagespeed.web.dev/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    PageSpeed Insights
                  </a>
                  {' '}website directly
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Come back tomorrow when the quota resets</span>
              </li>
            </ul>
          </div>
          {onRetry && (
            <Button 
              variant="outline" 
              onClick={onRetry}
              className="mt-6"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </Card>
      </div>
    </section>
  );
}
