import { useState, useRef } from 'react';
import { Bot, Sun, Moon, Book, User, LogOut, FileText, LogIn, ArrowLeft, Settings, ClipboardList, Code2, Wallet, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useTheme } from 'next-themes';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreditRechargeButton } from './CreditRechargeButton';

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
    identity: 'Identité',
    settings: 'Paramètres',
    myReports: 'Mes rapports',
    actionPlans: 'Plans d\'action',
    correctiveCodes: 'Codes correctifs',
    wallet: 'Mon Portefeuille',
    credits: 'crédits',
    logout: 'Déconnexion',
    login: 'Connexion',
    back: 'Retour',
  },
  en: {
    profile: 'My profile',
    identity: 'Identity',
    settings: 'Settings',
    myReports: 'My reports',
    actionPlans: 'Action plans',
    correctiveCodes: 'Corrective codes',
    wallet: 'My Wallet',
    credits: 'credits',
    logout: 'Log out',
    login: 'Log in',
    back: 'Back',
  },
  es: {
    profile: 'Mi perfil',
    identity: 'Identidad',
    settings: 'Configuración',
    myReports: 'Mis informes',
    actionPlans: 'Planes de acción',
    correctiveCodes: 'Códigos correctivos',
    wallet: 'Mi Billetera',
    credits: 'créditos',
    logout: 'Cerrar sesión',
    login: 'Iniciar sesión',
    back: 'Volver',
  },
};

export function Header() {
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, profile, signOut, loading } = useAuth();
  const { balance: creditsBalance } = useCredits();
  const navigate = useNavigate();
  const location = useLocation();
  const t = translations[language];
  
  // Hover state for profile dropdown
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if we're on specific pages
  const isAuditExpertPage = location.pathname === '/audit-expert';
  const isProfilePage = location.pathname === '/profil';

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    setIsProfileOpen(false);
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

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsProfileOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsProfileOpen(false);
    }, 150);
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm" role="banner">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Navigation principale">
        {/* Left side: Back button OR Logo + Language selector */}
        <div className="flex items-center gap-4">
          {isAuditExpertPage ? (
            // Back button on audit-expert page
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2 text-muted-foreground hover:text-foreground"
              aria-label={t.back}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t.back}</span>
            </Button>
          ) : (
            // Logo + Language selector on other pages
            <>
              <a href="/" className="flex items-center gap-2" aria-label="Crawlers.AI - Accueil">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                  <Bot className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                </div>
                {/* Hide site name on mobile */}
                <span className="hidden sm:inline text-lg font-semibold text-foreground">Crawlers.AI</span>
              </a>

              {/* Language selector - hidden on mobile and profile page */}
              {!isProfilePage && (
                <div className="hidden sm:flex items-center gap-1" role="group" aria-label="Sélection de la langue">
                  <button
                    onClick={() => setLanguage('fr')}
                    className={`h-7 w-7 rounded-md flex items-center justify-center transition-opacity ${language === 'fr' ? 'opacity-100' : 'opacity-50 hover:opacity-75'}`}
                    aria-pressed={language === 'fr'}
                    aria-label="Français"
                  >
                    <span className="text-base">🇫🇷</span>
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={`h-7 w-7 rounded-md flex items-center justify-center transition-opacity ${language === 'en' ? 'opacity-100' : 'opacity-50 hover:opacity-75'}`}
                    aria-pressed={language === 'en'}
                    aria-label="English"
                  >
                    <span className="text-base">🇬🇧</span>
                  </button>
                  <button
                    onClick={() => setLanguage('es')}
                    className={`h-7 w-7 rounded-md flex items-center justify-center transition-opacity ${language === 'es' ? 'opacity-100' : 'opacity-50 hover:opacity-75'}`}
                    aria-pressed={language === 'es'}
                    aria-label="Español"
                  >
                    <span className="text-base">🇪🇸</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Center: Lexique link - hidden on mobile */}
        <div className="hidden sm:block absolute left-1/2 -translate-x-1/2">
          <Link to="/lexique">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Book className="h-4 w-4" />
              <span className="text-sm">{lexiqueLabels[language]}</span>
            </Button>
          </Link>
        </div>

        {/* Right side: Credits (on audit-expert), Theme, User */}
        <div className="flex items-center gap-3">

          {/* Credit recharge button - only on /audit-expert when logged in */}
          {isAuditExpertPage && user && (
            <CreditRechargeButton />
          )}

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
              <div 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <DropdownMenu open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="relative h-9 w-9 rounded-full" 
                      aria-label={t.profile}
                      onClick={() => navigate('/profil')}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-72 bg-popover border border-border shadow-lg" 
                    align="end" 
                    forceMount
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="flex items-center justify-start gap-3 p-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-0.5 leading-none min-w-0 flex-1">
                        {profile && (
                          <p className="font-medium text-sm truncate">{profile.first_name} {profile.last_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {/* Wallet submenu */}
                    <DropdownMenuItem className="gap-2 cursor-default hover:bg-transparent focus:bg-transparent">
                      <Wallet className="h-4 w-4 text-amber-500" />
                      <span>{t.wallet}</span>
                      <span className="ml-auto flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                        <Zap className="h-3 w-3" />
                        {creditsBalance} {t.credits}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profil?tab=identity" className="gap-2 cursor-pointer">
                        <User className="h-4 w-4" />
                        {t.identity}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profil?tab=settings" className="gap-2 cursor-pointer">
                        <Settings className="h-4 w-4" />
                        {t.settings}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profil?tab=reports" className="gap-2 cursor-pointer">
                        <FileText className="h-4 w-4" />
                        {t.myReports}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profil?tab=action-plans" className="gap-2 cursor-pointer">
                        <ClipboardList className="h-4 w-4" />
                        {t.actionPlans}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profil?tab=corrective-codes" className="gap-2 cursor-pointer">
                        <Code2 className="h-4 w-4" />
                        {t.correctiveCodes}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="h-4 w-4" />
                      {t.logout}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Link to="/auth" aria-label={t.login}>
                <Button variant="outline" size="sm" className="gap-2" aria-label={t.login}>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
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
