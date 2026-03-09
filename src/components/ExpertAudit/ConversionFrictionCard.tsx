import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MousePointerClick, FormInput, SquareMousePointer } from 'lucide-react';
import type { ConversionFriction } from '@/types/newAuditMetrics';

interface ConversionFrictionCardProps {
  data: ConversionFriction;
}

const frictionConfig = {
  low: { text: 'Pas de CTA', className: 'text-warning border-warning/30' },
  optimal: { text: 'Friction optimale', className: 'bg-success/10 text-success border-success/30' },
  high: { text: 'Friction élevée', className: 'text-destructive border-destructive/30' },
};

export function ConversionFrictionCard({ data }: ConversionFrictionCardProps) {
  const config = frictionConfig[data.frictionLevel];

  return (
    <Card className="border border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <MousePointerClick className="h-4.5 w-4.5 text-primary" />
            </div>
            Friction de Conversion
          </div>
          <Badge variant="outline" className={config.className}>
            {config.text}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <MetricBox icon={<FormInput className="h-4 w-4 text-primary" />} label="Formulaires" value={String(data.formsCount)} />
          <MetricBox icon={<SquareMousePointer className="h-4 w-4 text-primary" />} label="Champs / form" value={data.formsCount > 0 ? String(data.avgFieldsPerForm) : '—'} warning={data.avgFieldsPerForm > 5} />
          <MetricBox icon={<MousePointerClick className="h-4 w-4 text-primary" />} label="CTA détectés" value={String(data.ctaCount)} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {data.ctaAboveFold ? (
            <span className="text-success">✓ CTA présent au-dessus de la ligne de flottaison</span>
          ) : (
            <span className="text-destructive/70">✗ Aucun CTA visible dans les 20% supérieurs de la page</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBox({ icon, label, value, warning }: { icon: React.ReactNode; label: string; value: string; warning?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className={`text-xl font-bold ${warning ? 'text-warning' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
