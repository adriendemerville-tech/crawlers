import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

// Flag emoji components for better accessibility and consistency
const FlagFR = () => (
  <span className="text-base" role="img" aria-label="Français">🇫🇷</span>
);

const FlagEN = () => (
  <span className="text-base" role="img" aria-label="English">🇬🇧</span>
);

const FlagES = () => (
  <span className="text-base" role="img" aria-label="Español">🇪🇸</span>
);

export function Header() {
  const { language, setLanguage } = useLanguage();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm" role="banner">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Navigation principale">
        <a href="/" className="flex items-center gap-2" aria-label="Crawlers AI - Accueil">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Bot className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-lg font-semibold text-foreground">Crawlers AI</span>
        </a>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1" role="group" aria-label="Sélection de la langue">
          <Button
            variant={language === 'fr' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLanguage('fr')}
            className="h-8 w-10 p-0"
            aria-pressed={language === 'fr'}
            aria-label="Français"
          >
            <FlagFR />
          </Button>
          <Button
            variant={language === 'en' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLanguage('en')}
            className="h-8 w-10 p-0"
            aria-pressed={language === 'en'}
            aria-label="English"
          >
            <FlagEN />
          </Button>
          <Button
            variant={language === 'es' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLanguage('es')}
            className="h-8 w-10 p-0"
            aria-pressed={language === 'es'}
            aria-label="Español"
          >
            <FlagES />
          </Button>
        </div>
      </nav>
    </header>
  );
}