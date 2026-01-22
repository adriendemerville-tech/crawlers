import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function NewsCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[300px] md:w-[340px]">
      <Card className="h-full overflow-hidden border-0 shadow-lg bg-card">
        <AspectRatio ratio={16 / 9}>
          <Skeleton className="w-full h-full" />
        </AspectRatio>
        
        <CardContent className="p-4 flex flex-col gap-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
