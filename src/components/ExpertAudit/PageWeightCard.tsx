import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCode2 } from 'lucide-react';

interface PageWeightCardProps {
  htmlSizeBytes: number;
}

function getWeightVerdict(sizeKB: number) {
  // SEO recommendations:
  // < 100 KB = Excellent (green)
  // 100-200 KB = Bon (green-yellow)
  // 200-500 KB = Acceptable (yellow)
  // 500-1000 KB = Lourd (orange)
  // > 1000 KB = Critique (red)
  if (sizeKB < 100) return { label: 'Excellent', pct: 15 };
  if (sizeKB < 200) return { label: 'Bon', pct: 35 };
  if (sizeKB < 500) return { label: 'Acceptable', pct: 55 };
  if (sizeKB < 1000) return { label: 'Lourd', pct: 78 };
  return { label: 'Critique', pct: 95 };
}

function PageWeightCardComponent({ htmlSizeBytes }: PageWeightCardProps) {
  const sizeKB = Math.round(htmlSizeBytes / 1024);
  const sizeMB = (htmlSizeBytes / (1024 * 1024)).toFixed(2);
  const verdict = getWeightVerdict(sizeKB);

  // Gradient from green to red
  const gradientStyle = {
    background: 'linear-gradient(to right, hsl(var(--success)), hsl(50 80% 50%), hsl(var(--warning)), hsl(var(--destructive)))',
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-primary" />
          Poids de la page HTML
          <Badge variant="outline" className="ml-auto text-[10px]">
            {verdict.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="text-center">
          <span className="text-2xl font-bold text-foreground">{sizeKB < 1024 ? `${sizeKB} Ko` : `${sizeMB} Mo`}</span>
        </div>

        {/* Gradient bar with indicator */}
        <div className="relative">
          <div className="h-2.5 rounded-full overflow-hidden" style={gradientStyle} />
          <div
            className="absolute top-0 h-2.5 w-1 bg-foreground rounded-full shadow-md transition-all"
            style={{ left: `${Math.min(verdict.pct, 98)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0 Ko</span>
          <span>100 Ko</span>
          <span>500 Ko</span>
          <span>1 Mo+</span>
        </div>

        <div className="text-[11px] text-muted-foreground space-y-1 pt-2 border-t border-border/30">
          <p>💡 Cible recommandée : &lt; 100 Ko pour un chargement optimal</p>
          <p>💡 Au-delà de 500 Ko, les bots IA risquent de tronquer l'analyse</p>
        </div>
      </CardContent>
    </Card>
  );
}

export const PageWeightCard = memo(PageWeightCardComponent);
