import { Shield } from 'lucide-react';

interface ApiQuotaGaugeProps {
  name: string;
  icon: React.ReactNode;
  calls: number;
  quota: number | null;
  costPerCall: number;
  color: string;
  status: 'ok' | 'warning' | 'exhausted' | 'active' | 'standby';
  statusLabel: string;
  estimatedCost?: number;
}

const statusColors: Record<string, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  exhausted: 'text-rose-600 dark:text-rose-400',
  active: 'text-blue-600 dark:text-blue-400',
  standby: 'text-muted-foreground',
};

const barColors: Record<string, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  exhausted: 'bg-rose-500',
  active: 'bg-blue-500',
  standby: 'bg-muted-foreground/30',
};

const borderColors: Record<string, string> = {
  ok: 'border-border',
  warning: 'border-amber-500/30',
  exhausted: 'border-rose-500/30',
  active: 'border-blue-500/30',
  standby: 'border-border',
};

export function ApiQuotaGauge({ name, icon, calls, quota, costPerCall, status, statusLabel, estimatedCost }: ApiQuotaGaugeProps) {
  const percent = quota ? Math.min(100, (calls / quota) * 100) : null;
  const cost = estimatedCost ?? calls * costPerCall;

  return (
    <div className={`p-4 rounded-lg border ${borderColors[status]} bg-card`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-semibold">{name}</span>
        </div>
        <Shield className={`h-3.5 w-3.5 ${statusColors[status]}`} />
      </div>

      <div className="text-2xl font-bold mb-1">
        {calls.toLocaleString('fr-FR')}
        {quota && (
          <span className="text-sm font-normal text-muted-foreground"> / {quota.toLocaleString('fr-FR')}</span>
        )}
      </div>

      {percent !== null && (
        <div className="mb-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColors[status]}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{percent.toFixed(1)}%</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-medium ${statusColors[status]}`}>{statusLabel}</span>
        {cost > 0 && (
          <span className="text-[10px] text-muted-foreground">
            ~{cost.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
          </span>
        )}
      </div>
    </div>
  );
}
