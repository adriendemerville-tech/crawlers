import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Image, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface ImageQualityCardProps {
  imagesTotal: number;
  imagesMissingAlt: number;
}

function getVerdict(total: number, missingAlt: number) {
  if (total === 0) return { label: 'Aucune image', color: 'text-muted-foreground', icon: AlertTriangle, status: 'neutral' };
  const ratio = missingAlt / total;
  if (ratio === 0) return { label: 'Excellent', color: 'text-emerald-500', icon: CheckCircle2, status: 'good' };
  if (ratio <= 0.2) return { label: 'Acceptable', color: 'text-amber-500', icon: AlertTriangle, status: 'warning' };
  return { label: 'Critique', color: 'text-rose-500', icon: XCircle, status: 'bad' };
}

function ImageQualityCardComponent({ imagesTotal, imagesMissingAlt }: ImageQualityCardProps) {
  const verdict = getVerdict(imagesTotal, imagesMissingAlt);
  const VerdictIcon = verdict.icon;
  const altOk = imagesTotal - imagesMissingAlt;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Image className="h-4 w-4 text-primary" />
          Qualité des Images
          <Badge variant="outline" className={`ml-auto text-[10px] ${verdict.color}`}>
            <VerdictIcon className="h-3 w-3 mr-1" />
            {verdict.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/40 border border-border/30">
            <p className="text-[11px] text-muted-foreground mb-0.5">Total images</p>
            <p className="text-lg font-bold text-foreground">{imagesTotal}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border/30">
            <p className="text-[11px] text-muted-foreground mb-0.5">Avec alt text</p>
            <p className={`text-lg font-bold ${altOk === imagesTotal && imagesTotal > 0 ? 'text-emerald-500' : 'text-foreground'}`}>
              {altOk}/{imagesTotal}
            </p>
          </div>
        </div>

        {imagesMissingAlt > 0 && (
          <p className="text-[11px] text-destructive/80 flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            {imagesMissingAlt} image{imagesMissingAlt > 1 ? 's' : ''} sans attribut alt — impact accessibilité & SEO
          </p>
        )}

        <div className="text-[11px] text-muted-foreground space-y-1 pt-2 border-t border-border/30">
          <p>💡 Format recommandé : AVIF &gt; WebP &gt; JPEG (poids &lt; 50 Ko)</p>
          <p>💡 Dimensions fixes (width/height) pour éviter le CLS</p>
          <p>💡 <code className="bg-muted px-1 rounded text-[10px]">loading="lazy"</code> sur les images hors viewport</p>
        </div>
      </CardContent>
    </Card>
  );
}

export const ImageQualityCard = memo(ImageQualityCardComponent);
