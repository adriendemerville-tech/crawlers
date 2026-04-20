import { ShieldCheck, ShieldAlert, ShieldQuestion, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type VerificationStatus = 'verified' | 'suspect' | 'stealth' | 'unverified';
export type VerificationMethod = 'rdns_match' | 'asn_range' | 'ua_only' | 'behavioral' | 'none';

interface Props {
  status: VerificationStatus | null | undefined;
  method?: VerificationMethod | null;
  confidence?: number | null;
  compact?: boolean;
}

const METHOD_LABELS: Record<VerificationMethod, string> = {
  rdns_match: 'reverse DNS officiel',
  asn_range: 'plage IP officielle',
  ua_only: 'User-Agent uniquement',
  behavioral: 'analyse comportementale',
  none: 'aucune',
};

const STATUS_CONFIG: Record<VerificationStatus, {
  label: string;
  icon: typeof ShieldCheck;
  className: string;
  description: string;
}> = {
  verified: {
    label: 'Vérifié',
    icon: ShieldCheck,
    className: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10',
    description: 'Identité réseau confirmée — bot officiel.',
  },
  suspect: {
    label: 'Suspect',
    icon: ShieldAlert,
    className: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
    description: 'Le User-Agent dit "bot" mais aucune vérification réseau ne confirme. Peut être un usurpateur.',
  },
  stealth: {
    label: 'Furtif',
    icon: EyeOff,
    className: 'border-rose-500/40 text-rose-600 bg-rose-500/10',
    description: 'Comportement de bot sans User-Agent identifié — usurpation probable.',
  },
  unverified: {
    label: 'Non vérifié',
    icon: ShieldQuestion,
    className: 'border-border/60 text-muted-foreground bg-muted/30',
    description: 'Vérification en attente (sera traitée par le cron arrière-plan).',
  },
};

export function VerificationBadge({ status, method, confidence, compact = false }: Props) {
  const cfg = STATUS_CONFIG[status || 'unverified'];
  const Icon = cfg.icon;
  const methodLabel = method ? METHOD_LABELS[method] : null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1 font-medium border',
              compact ? 'text-[10px] px-1.5 py-0 h-4' : 'text-xs px-2 py-0.5',
              cfg.className,
            )}
          >
            <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            {cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-semibold mb-1">{cfg.label}</p>
          <p className="text-xs text-muted-foreground mb-2">{cfg.description}</p>
          {methodLabel && (
            <p className="text-[11px]">
              <span className="text-muted-foreground">Méthode :</span> {methodLabel}
            </p>
          )}
          {typeof confidence === 'number' && confidence > 0 && (
            <p className="text-[11px]">
              <span className="text-muted-foreground">Confiance :</span> {confidence}/100
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
