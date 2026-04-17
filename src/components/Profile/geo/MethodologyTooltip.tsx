/**
 * MethodologyTooltip — petit bouton "?" en bordure (charte crawlers : violet/or/noir/blanc, pas de fond)
 * qui ouvre une popover contenant l'explication méthodologique d'une métrique GEO.
 *
 * Usage :
 *   <MethodologyTooltip
 *     title="Attribution multi-touch"
 *     body={<>Texte explicatif…</>}
 *   />
 */
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface MethodologyTooltipProps {
  title: string;
  body: React.ReactNode;
  className?: string;
  /** Petit libellé à droite du `?` (ex: "Méthode") */
  label?: string;
}

export function MethodologyTooltip({ title, body, className, label }: MethodologyTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Méthodologie : ${title}`}
          className={cn(
            // bordure-only, pas de fond, respect de la charte
            'inline-flex items-center gap-1 rounded-md border border-primary/40 px-1.5 py-0.5',
            'text-[10px] font-medium text-foreground/80 hover:text-primary hover:border-primary',
            'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            className,
          )}
        >
          <HelpCircle className="h-3 w-3" />
          {label && <span className="leading-none">{label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-80 border-primary/30 text-xs leading-relaxed"
      >
        <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
        <div className="space-y-1.5 text-muted-foreground">{body}</div>
      </PopoverContent>
    </Popover>
  );
}
