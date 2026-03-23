import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Bot, Sun, Moon, Book, User, LogOut, FileText, LogIn, ArrowLeft, Settings, ClipboardList, Code2, Wallet, Scale, Radar, LayoutDashboard, Puzzle, Crown, Globe, Sparkles, Network, Grid3X3, Bug } from 'lucide-react';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
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
import { Badge } from '@/components/ui/badge';

// Lazy load credit button (loads modal with framer-motion on demand)
const CreditRechargeButton = lazy(() => import('./CreditRechargeButton').then(m => ({ default: m.CreditRechargeButton })));

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
    console: 'Console',
    profile: 'Mon profil',
    dashboard: 'Dashboard',
    identity: 'Identité',
    settings: 'Paramètres',
    myReports: 'Mes rapports',
    actionPlans: 'Plans d\'action',
    correctiveCodes: '<Scripts>',
    wallet: 'Mon Portefeuille',
    credits: 'crédits',
    logout: 'Déconnexion',
    login: 'Connexion',
    signup: "S'inscrire",
    back: 'Retour',
    comparatif: 'Comparatif',
  },
  en: {
    console: 'Console',
    profile: 'My profile',
    dashboard: 'Dashboard',
    identity: 'Identity',
    settings: 'Settings',
    myReports: 'My reports',
    actionPlans: 'Action plans',
    correctiveCodes: '<Scripts>',
    wallet: 'My Wallet',
    credits: 'credits',
    logout: 'Log out',
    login: 'Log in',
    signup: 'Sign up',
    back: 'Back',
    comparatif: 'Pricing',
  },
  es: {
    console: 'Consola',
    profile: 'Mi perfil',
    dashboard: 'Dashboard',
    identity: 'Identidad',
    settings: 'Configuración',
    myReports: 'Mis informes',
    actionPlans: 'Planes de acción',
    correctiveCodes: '<Scripts>',
    wallet: 'Mi Billetera',
    credits: 'créditos',
    logout: 'Cerrar sesión',
    login: 'Iniciar sesión',
    signup: 'Registrarse',
    back: 'Volver',
    comparatif: 'Comparativa',
  },
};

export function Header() {
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, profile, signOut, loading } = useAuth();
  const { isAdmin } = useAdmin();
  const { balance: creditsBalance, isAgencyPro } = useCredits();
  const navigate = useNavigate();
  const location = useLocation();
  const t = translations[language];
  

  // Hover state for profile dropdown
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if we're on specific pages
  const isAuditExpertPage = location.pathname === '/audit-expert';
  const isProfilePage = location.pathname === '/console' || location.pathname === '/profil';
  const isHomePage = location.pathname === '/';
  const isCrawlPage = location.pathname === '/site-crawl' || location.pathname === '/crawl';

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
    }, 300);
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm" role="banner">
      <nav className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4" aria-label="Navigation principale">
        {/* Left side: Back button OR Logo + Language selector */}
        <div className="flex items-center gap-4">
          {isAuditExpertPage ? (
            // Back button + robot logo on audit-expert page
            <div className="flex items-center gap-2">
              <a href="/" className="flex items-center" aria-label="Crawlers.fr - Accueil">
                <svg className="h-9 w-9" viewBox="0 0 48 48" aria-hidden="true">
                  <defs>
                    <linearGradient id="headerBgGradientAudit" x1="100%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#d4a853"/>
                      <stop offset="30%" stopColor="#8b5cf6"/>
                      <stop offset="70%" stopColor="#7c3aed"/>
                      <stop offset="100%" stopColor="#3b5998"/>
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="48" height="48" rx="10" ry="10" fill="url(#headerBgGradientAudit)"/>
                  <g transform="translate(8.4, 8.4) scale(1.3)" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    <path d="M12 8V4H8"/>
                    <rect x="4" y="8" width="16" height="12" rx="2"/>
                    <path d="M2 14h2"/>
                    <path d="M20 14h2"/>
                    <path d="M9 13v2"/>
                    <path d="M15 13v2"/>
                  </g>
                </svg>
              </a>
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
            </div>
          ) : (
            // Logo + Language selector on other pages
            <>
              <a href="/" className="flex flex-col items-start gap-0.5" aria-label="Crawlers.fr - Accueil">
                <div className="flex items-center gap-2">
                  <svg className="h-9 w-9" viewBox="0 0 48 48" aria-hidden="true">
                    <defs>
                      <linearGradient id="headerBgGradient" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#d4a853"/>
                        <stop offset="30%" stopColor="#8b5cf6"/>
                        <stop offset="70%" stopColor="#7c3aed"/>
                        <stop offset="100%" stopColor="#3b5998"/>
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="48" height="48" rx="10" ry="10" fill="url(#headerBgGradient)"/>
                    <g transform="translate(8.4, 8.4) scale(1.3)" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                      <path d="M12 8V4H8"/>
                      <rect x="4" y="8" width="16" height="12" rx="2"/>
                      <path d="M2 14h2"/>
                      <path d="M20 14h2"/>
                      <path d="M9 13v2"/>
                      <path d="M15 13v2"/>
                    </g>
                  </svg>
                  <span className="hidden sm:inline text-lg font-display text-[#7c3aed]" style={{ fontWeight: 900 }}>
                    {isProfilePage ? (
                      <span className="text-foreground">Console</span>
                    ) : 'Crawlers'}
                  </span>
                </div>

                {/* Language selector below Crawlers */}
                {!isProfilePage && (
                  <div className="hidden sm:flex items-center gap-0.5 ml-11" role="group" aria-label="Sélection de la langue">
                    <button
                      onClick={(e) => { e.preventDefault(); setLanguage('fr'); }}
                      className={`h-5 w-5 rounded-md flex items-center justify-center transition-opacity ${language === 'fr' ? 'opacity-100' : 'opacity-50 hover:opacity-75'}`}
                      aria-pressed={language === 'fr'}
                      aria-label="Français"
                    >
                      <span className="text-xs">🇫🇷</span>
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setLanguage('en'); }}
                      className={`h-5 w-5 rounded-md flex items-center justify-center transition-opacity ${language === 'en' ? 'opacity-100' : 'opacity-50 hover:opacity-75'}`}
                      aria-pressed={language === 'en'}
                      aria-label="English"
                    >
                      <span className="text-xs">🇬🇧</span>
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setLanguage('es'); }}
                      className={`h-5 w-5 rounded-md flex items-center justify-center transition-opacity ${language === 'es' ? 'opacity-100' : 'opacity-50 hover:opacity-75'}`}
                      aria-pressed={language === 'es'}
                      aria-label="Español"
                    >
                      <span className="text-xs">🇪🇸</span>
                    </button>
                  </div>
                )}
              </a>
            </>
          )}
        </div>

        {/* Center: Navigation links - hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {/* Audit button first - hidden on audit-expert page */}
          {!isAuditExpertPage && (
            <Link to="/audit-expert">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-[#3b82f6] hover:text-[#60a5fa] hover:bg-[#3b82f6]/10"
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Audit</span>
              </Button>
            </Link>
          )}
          {!isAuditExpertPage && isHomePage && (
            <Link to="/cocoon">
              <Button variant="ghost" size="sm" className="gap-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BETA</span>
                <span className="text-sm font-semibold">Cocoon</span>
              </Button>
            </Link>
          )}
          {isAuditExpertPage ? (
            <>
              <a href="/site-crawl" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1.5 text-purple-500 hover:text-purple-400 hover:bg-muted/60">
                  <Bug className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">Crawl</span>
                </Button>
              </a>
              <a href="/matrice" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <Grid3X3 className="h-4 w-4" />
                  <span className="text-sm">Matrice</span>
                </Button>
              </a>
            </>
          ) : (
            <Link to="/site-crawl">
              <Button variant="ghost" size="sm" className="gap-1.5 text-purple-500 hover:text-purple-400 hover:bg-muted/60">
                <Bug className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold">Crawl</span>
              </Button>
            </Link>
          )}
          {isProfilePage && (
            <>
              <Link to="/cocoon">
                <Button variant="ghost" size="sm" className="gap-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10">
                  
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BETA</span>
                  <span className="text-sm font-semibold">Cocoon</span>
                </Button>
              </Link>
              {user && (
                <Link to="/matrice">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BETA</span>
                    <Grid3X3 className="h-3.5 w-3.5" />
                    <span className="text-sm font-semibold">Matrice d'audit</span>
                  </Button>
                </Link>
              )}
            </>
          )}
          {isProfilePage ? null : (isAuditExpertPage || (user && (isAgencyPro || (profile?.plan_type && profile.plan_type !== 'free')))) ? (
            isAuditExpertPage ? (
              <a href="/console" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="text-sm">{t.console}</span>
                </Button>
              </a>
            ) : (
              <Link to="/console">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="text-sm">{t.console}</span>
                </Button>
              </Link>
            )
          ) : null}
        </div>

        {/* Right side: Audit CTA, Credits, Theme, User */}
        <div className="flex items-center gap-3">

          {/* Credit recharge button - on home and /audit-expert (show for all users) */}
          {isAuditExpertPage && (
            <Suspense fallback={null}>
              <CreditRechargeButton showZeroForGuest />
            </Suspense>
          )}


          {/* Console button (logged in, hidden on /console) */}
          {!loading && user && !isProfilePage && (
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" asChild>
                <Link to="/console" aria-label={t.console}>
                  <LayoutDashboard className="h-4 w-4" />
                </Link>
              </Button>
          )}

          {/* User menu or login button */}
          {!loading && (
            user ? (
              <div 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <DropdownMenu open={isProfileOpen} modal={false} onOpenChange={(open) => {
                  if (open) {
                    if (closeTimeoutRef.current) {
                      clearTimeout(closeTimeoutRef.current);
                      closeTimeoutRef.current = null;
                    }
                    setIsProfileOpen(true);
                  } else {
                    // Only close via our timeout logic, not Radix's internal close
                  }
                }}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="relative h-9 w-9 rounded-full" 
                      aria-label={t.profile}
                      onClick={() => navigate('/console')}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  {/* Invisible bridge to prevent gap flicker */}
                  {isProfileOpen && (
                    <div 
                      className="absolute top-full right-0 h-3 w-72"
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    />
                  )}
                  <DropdownMenuContent 
                    className="w-72 bg-popover border border-border shadow-lg" 
                    align="end"
                    sideOffset={2}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    {/* Console subtitle */}
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.console}</p>
                    </div>
                    <DropdownMenuItem asChild className="p-0">
                      <Link to="/console" className="flex items-center justify-start gap-3 p-3 cursor-pointer">
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
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* Console shortcut */}
                    <DropdownMenuItem asChild>
                      <Link to="/console?tab=tracking" className="gap-2 cursor-pointer">
                        <LayoutDashboard className="h-4 w-4" />
                        {t.console}
                      </Link>
                    </DropdownMenuItem>
                    {!isAgencyPro && (
                      <DropdownMenuItem asChild className="gap-2 cursor-default hover:bg-transparent focus:bg-transparent">
                        <div>
                          <Wallet className="h-4 w-4 text-amber-500" />
                          <span>{t.wallet}</span>
                          <span className="ml-auto flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                            {creditsBalance}
                            <CreditCoin size="sm" />
                          </span>
                        </div>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/console?tab=settings" className="gap-2 cursor-pointer">
                        <Settings className="h-4 w-4" />
                        {t.settings}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/console?tab=reports" className="gap-2 cursor-pointer">
                        <FileText className="h-4 w-4" />
                        {t.myReports}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/console?tab=action-plans" className="gap-2 cursor-pointer">
                        <ClipboardList className="h-4 w-4" />
                        {t.actionPlans}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/console?tab=corrective-codes" className="gap-2 cursor-pointer">
                        <Code2 className="h-4 w-4" />
                        {t.correctiveCodes}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                      <LogOut className="h-4 w-4" />
                      {t.logout}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link to="/signup">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                    {t.signup}
                  </Button>
                </Link>
                <Link to="/auth" aria-label={t.login}>
                  <Button variant="outline" size="sm" className="gap-2" aria-label={t.login}>
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t.login}</span>
                  </Button>
                </Link>
              </div>
            )
          )}
        </div>
      </nav>
    </header>
  );
}
