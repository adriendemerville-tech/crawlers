import { ClientTargetsAnalysis, ClientTarget } from '@/types/expertAudit';
import { Users, Target, Lightbulb, Building2, User } from 'lucide-react';

interface Props {
  data: ClientTargetsAnalysis;
}

const marketBadge = (market: string) => {
  const colors: Record<string, string> = {
    B2B: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    B2C: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    B2B2C: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors[market] || colors.B2C}`}>
      {market}
    </span>
  );
};

const confidenceBar = (confidence: number) => {
  const pct = Math.round(confidence * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{pct}%</span>
    </div>
  );
};

function TargetDetail({ target }: { target: ClientTarget }) {
  const details: string[] = [];

  if (target.b2b) {
    const b = target.b2b;
    if (b.segment) details.push(b.segment);
    if (b.sector) details.push(b.sector);
    if (b.job_segment) details.push(b.job_segment);
    if (b.role) details.push(b.role);
    if (b.buying_frequency) details.push(`Achat: ${b.buying_frequency}`);
    if (b.payment_mode) details.push(`Paiement: ${b.payment_mode}`);
  }
  if (target.b2c) {
    const c = target.b2c;
    if (c.gender && c.gender !== 'Tous') details.push(c.gender);
    if (c.age_range) details.push(c.age_range);
    if (c.csp) details.push(c.csp);
    if (c.purchasing_power) details.push(c.purchasing_power);
    if (c.buying_frequency) details.push(`Achat: ${c.buying_frequency}`);
    if (c.payment_mode) details.push(`Paiement: ${c.payment_mode}`);
  }
  if (target.geo_scope) details.push(`📍 ${target.geo_scope}${target.geo_country ? ` (${target.geo_country})` : ''}`);
  if (target.intent) details.push(`🎯 ${target.intent}`);
  if (target.maturity) details.push(`📊 ${target.maturity}`);

  return (
    <div className="border border-border/50 rounded-lg p-3 space-y-2 bg-card/30">
      <div className="flex items-center justify-between">
        {marketBadge(target.market)}
        {confidenceBar(target.confidence)}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {details.map((d, i) => (
          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-muted/50 text-foreground/80">
            {d}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {target.rationale || target.evidence}
      </p>
    </div>
  );
}

export function ClientTargetsCard({ data }: Props) {
  if (!data || (!data.primary?.length && !data.secondary?.length && !data.untapped?.length)) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold text-foreground">Cibles Clients</h3>
      </div>

      {data.primary?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/90">
            <Target className="h-3.5 w-3.5 text-emerald-500" />
            Cibles principales
          </div>
          {data.primary.map((t, i) => <TargetDetail key={`p-${i}`} target={t} />)}
        </div>
      )}

      {data.secondary?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/90">
            <Building2 className="h-3.5 w-3.5 text-amber-500" />
            Cibles secondaires
          </div>
          {data.secondary.map((t, i) => <TargetDetail key={`s-${i}`} target={t} />)}
        </div>
      )}

      {data.untapped?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/90">
            <Lightbulb className="h-3.5 w-3.5 text-violet-500" />
            Cibles potentielles non adressées
          </div>
          {data.untapped.map((t, i) => <TargetDetail key={`u-${i}`} target={t} />)}
        </div>
      )}
    </div>
  );
}
