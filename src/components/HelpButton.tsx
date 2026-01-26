import { HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface HelpButtonProps {
  term: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Bouton d'aide discret qui pointe vers le lexique
 * @param term - Le terme à rechercher dans le lexique (sera utilisé comme ancre)
 * @param className - Classes CSS supplémentaires
 * @param size - Taille du bouton ('sm' par défaut)
 */
export function HelpButton({ term, className, size = 'sm' }: HelpButtonProps) {
  const { t } = useLanguage();
  
  // Normaliser le terme pour l'ancre URL
  const anchor = term.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={`/lexique#${anchor}`}
            className={cn(
              "inline-flex items-center justify-center rounded-full",
              "text-muted-foreground/50 hover:text-primary hover:bg-primary/10",
              "transition-all duration-200 ease-out",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              "ml-1 p-0.5",
              className
            )}
            aria-label={`${t.help.learnMore}: ${term}`}
          >
            <HelpCircle className={cn(sizeClasses[size], "opacity-60 hover:opacity-100")} />
          </Link>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-popover/95 backdrop-blur-sm text-xs px-2 py-1"
        >
          <p>{t.help.viewInLexicon}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
