import { BotResult } from '@/types/crawler';
import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotCardProps {
  bot: BotResult;
}

export function BotCard({ bot }: BotCardProps) {
  const statusConfig = {
    allowed: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', label: 'Autorisé' },
    blocked: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', label: 'Bloqué' },
    unknown: { icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', label: 'Inconnu' },
  };

  const config = statusConfig[bot.status];
  const Icon = config.icon;

  return (
    <Card className={cn('p-4 transition-all hover:shadow-md', config.border)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{bot.name}</h3>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.bg, config.color)}>
              <Icon className="h-3 w-3" />
              {config.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{bot.company}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70 font-mono">{bot.userAgent}</p>
          {bot.reason && (
            <p className="mt-2 text-xs text-muted-foreground">{bot.reason}</p>
          )}
          {bot.blockSource && (
            <p className="mt-1 text-xs text-muted-foreground/60">
              Source: {bot.blockSource}{bot.lineNumber ? ` (ligne ${bot.lineNumber})` : ''}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
