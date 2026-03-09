import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CalendarCheck, Calendar } from 'lucide-react';
import type { FreshnessSignals } from '@/types/newAuditMetrics';

interface FreshnessSignalsCardProps {
  data: FreshnessSignals;
}

const labelConfig = {
  fresh: { text: 'Fresh', className: 'bg-success/10 text-success border-success/30', icon: CalendarCheck },
  acceptable: { text: 'Acceptable', className: 'text-warning border-warning/30', icon: Calendar },
  stale: { text: 'Stale', className: 'text-destructive border-destructive/30', icon: Clock },
};

export function FreshnessSignalsCard({ data }: FreshnessSignalsCardProps) {
  const config = labelConfig[data.label];
  const StatusIcon = config.icon;

  return (
    <Card className="border border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4.5 w-4.5 text-primary" />
            </div>
            Preuve de Vie (Freshness)
          </div>
          <Badge variant="outline" className={config.className}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.text}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Score Fraîcheur</p>
            <p className={`text-2xl font-bold ${data.score >= 80 ? 'text-success' : data.score >= 50 ? 'text-warning' : 'text-destructive'}`}>
              {data.score}<span className="text-sm text-muted-foreground">/100</span>
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Dernière modification</p>
            <p className="text-sm font-medium text-foreground">
              {data.lastModifiedDate 
                ? new Date(data.lastModifiedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Non détectée'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {data.hasCurrentYearMention ? (
            <span className="flex items-center gap-1 text-success">✓ Année {data.currentYearFound} mentionnée dans le contenu</span>
          ) : (
            <span className="flex items-center gap-1 text-destructive/70">✗ Aucune mention de l'année en cours</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
