import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Heart, ExternalLink } from 'lucide-react';
import { AttributionConfig } from './types';

interface AttributionCardProps {
  config: AttributionConfig;
  onToggle: () => void;
}

export function AttributionCard({ config, onToggle }: AttributionCardProps) {
  return (
    <Card className={`
      border-2 transition-all
      ${config.enabled 
        ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-green-500/5' 
        : 'border-muted bg-muted/30'
      }
    `}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Switch
            checked={config.enabled}
            onCheckedChange={onToggle}
            className="mt-0.5 data-[state=checked]:bg-emerald-600"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Heart className={`w-4 h-4 ${config.enabled ? 'text-emerald-500' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-semibold ${config.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                Soutenir la communauté Crawlers
              </span>
              {config.enabled && (
                <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-1.5 py-0 border-emerald-500/30">
                  Activé
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Ajoute un lien discret de crédit technologique en bas de page. 
              <span className="text-emerald-600 dark:text-emerald-400 font-medium"> Améliore votre score éthique.</span>
            </p>
            {config.enabled && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 w-fit">
                <ExternalLink className="w-3 h-3" />
                <span>Ancre : </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{config.anchorText}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
