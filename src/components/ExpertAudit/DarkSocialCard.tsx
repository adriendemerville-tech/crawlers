import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Share2, Image, Type, FileText } from 'lucide-react';
import { MethodologyPopover } from './MethodologyPopover';
import type { DarkSocialReadiness } from '@/types/newAuditMetrics';

interface DarkSocialCardProps {
  data: DarkSocialReadiness;
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-destructive';
}

function getScoreBadge(score: number) {
  if (score >= 80) return { label: 'Prêt', variant: 'default' as const, className: 'bg-success/10 text-success border-success/30' };
  if (score >= 50) return { label: 'Partiel', variant: 'outline' as const, className: 'text-warning border-warning/30' };
  return { label: 'Insuffisant', variant: 'outline' as const, className: 'text-destructive border-destructive/30' };
}

export function DarkSocialCard({ data }: DarkSocialCardProps) {
  const badge = getScoreBadge(data.score);

  return (
    <Card className="border border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Share2 className="h-4.5 w-4.5 text-primary" />
            </div>
            Dark Social Readiness
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getScoreColor(data.score)}`}>{data.score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge variant={badge.variant} className={badge.className}>{badge.label}</Badge>

        {/* Simulated preview */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Aperçu de partage</p>
          <div className="flex gap-3">
            {data.ogImage ? (
              <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                <img src={data.ogImage} alt="og:image" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            ) : (
              <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                <Image className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{data.ogTitle || '(og:title manquant)'}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{data.ogDescription || '(og:description manquante)'}</p>
            </div>
          </div>
        </div>

        {/* Tag checks */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MetricCheck label="og:title" present={!!data.ogTitle} icon={<Type className="h-3 w-3" />} />
          <MetricCheck label="og:description" present={!!data.ogDescription} icon={<FileText className="h-3 w-3" />} />
          <MetricCheck label="og:image" present={!!data.ogImage} icon={<Image className="h-3 w-3" />} />
          <MetricCheck label="twitter:card" present={!!data.twitterCard} icon={<Share2 className="h-3 w-3" />} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCheck({ label, present, icon }: { label: string; present: boolean; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-1.5 p-1.5 rounded ${present ? 'text-success' : 'text-destructive/70'}`}>
      {icon}
      <span>{label}</span>
      <span className="ml-auto">{present ? '✓' : '✗'}</span>
    </div>
  );
}
