import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function BotCardSkeleton() {
  return (
    <Card className="overflow-hidden card-shadow">
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      {/* Animated scan line */}
      <div className="relative h-1 overflow-hidden bg-muted">
        <div className="absolute inset-0 animate-scan bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
    </Card>
  );
}
