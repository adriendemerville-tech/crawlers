import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import type { RedTeamAnalysis } from '@/types/newAuditMetrics';

interface RedTeamCardProps {
  data: RedTeamAnalysis;
}

export function RedTeamCard({ data }: RedTeamCardProps) {
  if (!data.flaws || data.flaws.length === 0) return null;

  return (
    <Card className="border-2 border-destructive/40 bg-gradient-to-br from-destructive/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-destructive">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
            <ShieldAlert className="h-4.5 w-4.5 text-destructive" />
          </div>
          Red Team : Objections Non Adressées
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.flaws.map((flaw, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 shrink-0 mt-0.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </div>
              <p className="text-sm text-foreground leading-relaxed">{flaw}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground italic">
          Analyse adversariale : ces objections représentent les points qu'un prospect sceptique soulèverait.
        </p>
      </CardContent>
    </Card>
  );
}
