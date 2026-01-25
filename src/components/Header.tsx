import { Bot, Sun, Moon, Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';

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

const lexiqueLabels = {
  fr: 'Lexique',
  en: 'Glossary',
  es: 'Glosario',
};

export function Header() {
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm" role="banner">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Navigation principale">
        <a href="/" className="flex items-center gap-2" aria-label="Crawlers AI - Accueil">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Bot className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-lg font-semibold text-foreground">Crawlers AI</span>
        </a>

        <div className="flex items-center gap-3">
          {/* Lexique link - discrete */}
          <Link to="/lexique">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Book className="h-4 w-4" />
              <span className="text-sm">{lexiqueLabels[language]}</span>
            </Button>
          </Link>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
            aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Language selector */}
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
        </div>
      </nav>
    </header>
  );
}
