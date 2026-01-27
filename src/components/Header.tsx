import { Bot, Sun, Moon, Book, User, LogOut, FileText, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { Link, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

const translations = {
  fr: {
    profile: 'Mon profil',
    myReports: 'Mes rapports',
    logout: 'Déconnexion',
    login: 'Connexion',
  },
  en: {
    profile: 'My profile',
    myReports: 'My reports',
    logout: 'Log out',
    login: 'Log in',
  },
  es: {
    profile: 'Mi perfil',
    myReports: 'Mis informes',
    logout: 'Cerrar sesión',
    login: 'Iniciar sesión',
  },
};

export function Header() {
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const t = translations[language];

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = () => {
    if (profile) {
      return `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm" role="banner">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Navigation principale">
        {/* Left side: Logo + Language selector */}
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-2" aria-label="Crawlers AI - Accueil">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Bot className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold text-foreground">Crawlers AI</span>
          </a>

          {/* Language selector - next to logo */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1" role="group" aria-label="Sélection de la langue">
            <Button
              variant={language === 'fr' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setLanguage('fr')}
              className="h-7 w-9 p-0"
              aria-pressed={language === 'fr'}
              aria-label="Français"
            >
              <FlagFR />
            </Button>
            <Button
              variant={language === 'en' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setLanguage('en')}
              className="h-7 w-9 p-0"
              aria-pressed={language === 'en'}
              aria-label="English"
            >
              <FlagEN />
            </Button>
            <Button
              variant={language === 'es' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setLanguage('es')}
              className="h-7 w-9 p-0"
              aria-pressed={language === 'es'}
              aria-label="Español"
            >
              <FlagES />
            </Button>
          </div>
        </div>

        {/* Right side: Lexique, Theme, User */}
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

          {/* User menu or login button */}
          {!loading && (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      {profile && (
                        <p className="font-medium">{profile.first_name} {profile.last_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profil" className="gap-2 cursor-pointer">
                      <User className="h-4 w-4" />
                      {t.profile}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profil?tab=reports" className="gap-2 cursor-pointer">
                      <FileText className="h-4 w-4" />
                      {t.myReports}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />
                    {t.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <Button variant="outline" size="sm" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.login}</span>
                </Button>
              </Link>
            )
          )}
        </div>
      </nav>
    </header>
  );
}
