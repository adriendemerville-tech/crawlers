import { Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-card/50 py-8" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 text-center space-y-2">
        <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
          {t.footer.builtWith} <Heart className="h-4 w-4 text-destructive" aria-label="amour" /> {t.footer.tagline}
        </p>
        <p className="text-sm text-muted-foreground">
          {t.footer.poweredBy}{' '}
          <a 
            href="https://iktracker.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
            title="IKTracker - Outils SEO et Analytics"
          >
            IKTracker
          </a>
        </p>
        <p className="text-sm text-muted-foreground">
          {t.footer.alsoDiscover}{' '}
          <a 
            href="https://ai-or-not-ai-that-is-the-question.lovable.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
            title="AI or Not AI - Détecteur de contenu IA"
          >
            AI or Not AI?
          </a>
        </p>
      </div>
    </footer>
  );
}
