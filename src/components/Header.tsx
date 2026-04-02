import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Sun, Moon, Book, User, LogOut, FileText, LogIn, ArrowLeft, Settings, ClipboardList, Code2, Scale, Radar, LayoutDashboard, Puzzle, Crown, Globe, Sparkles, Network, Grid3X3, Bug, CreditCard, PenLine, HelpCircle, ChevronRight } from 'lucide-react';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useCredits } from '@/contexts/CreditsContext';
import { useTheme } from 'next-themes';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
const CreditTopUpModal = lazy(() => import('./CreditTopUpModal').then(m => ({ default: m.CreditTopUpModal })));
const CocoonContentArchitectModal = lazy(() => import('./Cocoon/CocoonContentArchitectModal').then(m => ({ default: m.CocoonContentArchitectModal })));

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
    account: 'Compte',
    dashboard: 'Dashboard',
    identity: 'Identité',
    settings: 'Paramètres',
    myReports: 'Mes rapports',
    actionPlans: 'Plans d\'action',
    correctiveCodes: '<Scripts>',
    wallet: 'Mon Portefeuille',
    credits: 'crédits',
    logout: 'Déconnexion',
    myAccount: 'Mon compte',
    help: 'Aide',
    login: 'Connexion',
    signup: "S'inscrire",
    back: 'Retour',
    comparatif: 'Comparatif',
  },
  en: {
    console: 'Console',
    profile: 'My profile',
    account: 'Account',
    dashboard: 'Dashboard',
    identity: 'Identity',
    settings: 'Settings',
    myReports: 'My reports',
    actionPlans: 'Action plans',
    correctiveCodes: '<Scripts>',
    wallet: 'My Wallet',
    credits: 'credits',
    logout: 'Log out',
    myAccount: 'My account',
    help: 'Help',
    login: 'Log in',
    signup: 'Sign up',
    back: 'Back',
    comparatif: 'Pricing',
  },
  es: {
    console: 'Consola',
    profile: 'Mi perfil',
    account: 'Cuenta',
    dashboard: 'Dashboard',
    identity: 'Identidad',
    settings: 'Configuración',
    myReports: 'Mis informes',
    actionPlans: 'Planes de acción',
    correctiveCodes: '<Scripts>',
    wallet: 'Mi Billetera',
    credits: 'créditos',
    logout: 'Cerrar sesión',
    myAccount: 'Mi cuenta',
    help: 'Ayuda',
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
  

  // Collaborator detection (team members cannot manage billing)
  const [isCollaborator, setIsCollaborator] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showContentArchitect, setShowContentArchitect] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('agency_team_members')
      .select('id')
      .eq('member_user_id', user.id)
      .limit(1)
      .then(({ data }) => setIsCollaborator(!!data && data.length > 0));
  }, [user]);

  // Hover state for profile dropdown
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if we're on specific pages
  const isAuditExpertPage = location.pathname === '/audit-expert';
  const isProfilePage = location.pathname === '/app/console' || location.pathname === '/app/profil';
  const isHomePage = location.pathname === '/';
  const isCrawlPage = location.pathname === '/app/site-crawl' || location.pathname === '/crawl';
  const isMatricePage = location.pathname === '/matrice';
  const isCocoonPage = location.pathname === '/app/cocoon';

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };


  const handleLogout = async () => {
    setIsProfileOpen(false);
    await signOut();
    navigate('/');
  };

  const navigateFromMenu = (path: string) => {
    setIsProfileOpen(false);
    navigate(path);
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
    <>
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/80 backdrop-blur-md" role="banner">
      <nav className="mx-auto flex h-14 sm:h-20 max-w-6xl items-center justify-between px-3 sm:px-4" aria-label="Navigation principale">
        {/* Left side: Back button OR Logo + Language selector */}
        <div className="flex items-center gap-4">
          {isAuditExpertPage ? (
            // Back button only on audit-expert page
            <div className="flex items-center gap-2">
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
                  {!isProfilePage && (
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
                  )}
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

        {/* Center: Navigation links - desktop */}
        <div className="hidden sm:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {/* Crawl */}
          {isAuditExpertPage ? (
            <a href="/app/site-crawl" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className={`gap-1.5 text-purple-500 hover:text-purple-400 hover:bg-muted/60 ${isCrawlPage ? 'border border-purple-500' : ''}`}>
                <Bug className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold">Crawl</span>
              </Button>
            </a>
          ) : (
            <Link to="/app/site-crawl">
              <Button variant="ghost" size="sm" className={`gap-1.5 text-purple-500 hover:text-purple-400 hover:bg-muted/60 ${isCrawlPage ? 'border border-purple-500' : ''}`}>
                <Bug className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold">Crawl</span>
              </Button>
            </Link>
          )}

          <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />

          {/* Audit */}
          {isAuditExpertPage ? (
            <Button variant="ghost" size="sm" className="gap-1.5 text-[#3b82f6] hover:text-[#60a5fa] hover:bg-[#3b82f6]/10 border border-[#3b82f6]">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-semibold">Audit</span>
            </Button>
          ) : (
            <Link to="/audit-expert">
              <Button variant="ghost" size="sm" className="gap-1.5 text-[#3b82f6] hover:text-[#60a5fa] hover:bg-[#3b82f6]/10">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-semibold">Audit</span>
              </Button>
            </Link>
          )}

          <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />

          {/* Cocoon */}
          {isAuditExpertPage ? (
            <a href="/app/cocoon" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className={`gap-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 ${isCocoonPage ? 'border border-amber-500' : ''}`}>
                <span className="text-sm font-semibold">Cocoon</span>
              </Button>
            </a>
          ) : (
            <Link to="/app/cocoon">
              <Button variant="ghost" size="sm" className={`gap-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 ${isCocoonPage ? 'border border-amber-500' : ''}`}>
                <span className="text-sm font-semibold">Cocoon</span>
              </Button>
            </Link>
          )}

          <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />

          {/* Content Architect */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowContentArchitect(true)}
            className="gap-1.5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
          >
            <PenLine className="h-3.5 w-3.5" />
            <span className="text-sm font-semibold">Content</span>
          </Button>


          {/* Console — for paid users, hidden on console page and audit-expert page */}
          {!isProfilePage && !isAuditExpertPage && (user && (isAgencyPro || (profile?.plan_type && profile.plan_type !== 'free'))) && (
            <Link to="/app/console">
              <Button variant="ghost" size="sm" className={`gap-1.5 text-muted-foreground hover:text-foreground ${isProfilePage ? 'border border-muted-foreground' : ''}`}>
                <LayoutDashboard className="h-4 w-4" />
                <span className="text-sm">{t.console}</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Right side: Audit CTA, Credits, Theme, User */}
        <div className="flex items-center gap-3">

          {/* Credit recharge button - on audit-expert only, hidden for agency pro subscribers */}
          {isAuditExpertPage && !isAgencyPro && (
            <Suspense fallback={null}>
              <CreditRechargeButton showZeroForGuest />
            </Suspense>
          )}


          {/* Console button (logged in, hidden on /console) */}
          {!loading && user && !isProfilePage && (
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" asChild>
                <Link to="/app/console" aria-label={t.console}>
                  <LayoutDashboard className="h-4 w-4" />
                </Link>
              </Button>
          )}

          {/* Matrice d'audit - console only, centered between Content and user avatar */}
          {location.pathname === '/app/console' && (
            <Link to="/matrice">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <Grid3X3 className="h-3.5 w-3.5" />
                <span className="text-sm">Matrice</span>
              </Button>
            </Link>
          )}

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
                    setIsProfileOpen(false);
                  }
                }}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="relative h-9 w-9 rounded-full" 
                      aria-label={t.profile}
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
                    {/* Profile card (non-clickable) */}
                    <div className="flex w-full items-center justify-start gap-3 p-3">
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
                    {/* Console shortcut */}
                    <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => navigateFromMenu('/app/console?tab=tracking')}>
                        <LayoutDashboard className="h-4 w-4" />
                        {t.console}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => navigateFromMenu('/app/console?tab=settings')}>
                        <User className="h-4 w-4" />
                        {t.myAccount}
                    </DropdownMenuItem>
                    {!isCollaborator && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => { setIsProfileOpen(false); setShowTopUpModal(true); }}>
                          <CreditCard className="h-4 w-4" />
                          {isAgencyPro ? (language === 'fr' ? 'Abonnement' : language === 'es' ? 'Suscripción' : 'Subscription') : (language === 'fr' ? 'Tarifs' : language === 'es' ? 'Tarifas' : 'Pricing')}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => {}}>
                        <HelpCircle className="h-4 w-4" />
                        {t.help}
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
      {showTopUpModal && user && (
        <Suspense fallback={null}>
          <CreditTopUpModal
            open={showTopUpModal}
            onOpenChange={setShowTopUpModal}
            currentBalance={creditsBalance}
          />
        </Suspense>
      )}
    </header>
    {/* Mobile scrollable navigation — only mobile-friendly features */}
    <nav className="sm:hidden fixed top-14 left-0 right-0 z-40 border-b border-border bg-card/90 backdrop-blur-md overflow-x-auto" aria-label="Navigation mobile">
      <div className="flex items-center gap-1 px-3 py-1.5 min-w-max">
        <Link to="/audit-expert" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${isAuditExpertPage ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
          <Sparkles className="h-3.5 w-3.5" />
          Audit
        </Link>
        <Link to="/app/site-crawl" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${isCrawlPage ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
          <Bug className="h-3.5 w-3.5" />
          Crawl
        </Link>
        <Link to="/app/audit-compare" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${location.pathname === '/app/audit-compare' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
          <Scale className="h-3.5 w-3.5" />
          Comparé
        </Link>
        <Link to="/matrice" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${isMatricePage ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
          <Grid3X3 className="h-3.5 w-3.5" />
          Matrice
        </Link>
      </div>
    </nav>
    <div className="h-14 sm:h-20" aria-hidden="true" />
    <div className="h-10 sm:hidden" aria-hidden="true" /> {/* Extra spacer for mobile second nav bar */}
    <>
      {isAdmin && showContentArchitect && createPortal(
        <Suspense fallback={null}>
          <CocoonContentArchitectModal
            isOpen={showContentArchitect}
            onClose={() => setShowContentArchitect(false)}
            nodes={[]}
            domain=""
            trackedSiteId=""
            colorTheme="green"
          />
        </Suspense>,
        document.body
      )}
    </>
    </>
  );
}
