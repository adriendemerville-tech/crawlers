import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export function Header() {
  const { language, setLanguage } = useLanguage();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm" role="banner">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Navigation principale">
        <a href="/" className="flex items-center gap-2" aria-label="AI Crawler Check - Accueil">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Bot className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-lg font-semibold text-foreground">AI Crawler Check</span>
        </a>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1" role="group" aria-label="Sélection de la langue">
          <Button
            variant={language === 'fr' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLanguage('fr')}
            className="h-7 px-3 text-xs font-medium"
            aria-pressed={language === 'fr'}
            aria-label="Français"
          >
            FR
          </Button>
          <Button
            variant={language === 'en' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLanguage('en')}
            className="h-7 px-3 text-xs font-medium"
            aria-pressed={language === 'en'}
            aria-label="English"
          >
            EN
          </Button>
        </div>
      </nav>
    </header>
  );
}
