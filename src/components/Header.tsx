import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Sun, Moon, Book, User, LogOut, FileText, LogIn, ArrowLeft, Settings, ClipboardList, Code2, Scale, Radar, LayoutDashboard, Puzzle, Crown, Globe, Sparkles, Network, Grid3X3, Bug, CreditCard, PenLine, HelpCircle, ChevronRight, Share2, Search, ShieldCheck } from 'lucide-react';
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

  // Auto-hide header on scroll down for /app pages
  const isAppPage = location.pathname.startsWith('/app');
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!isAppPage) {
      setHeaderHidden(false);
      return;
    }
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      if (delta > 10 && currentY > 80) {
        setHeaderHidden(true);
      } else if (delta < -5) {
        setHeaderHidden(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAppPage]);

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
  const isHomePage = location.pathname === '/' || location.pathname === '/tarifs' || location.pathname === '/features' || location.pathname.startsWith('/landing/') || location.pathname.startsWith('/blog') || location.pathname.startsWith('/guide') || location.pathname.startsWith('/lexique') || location.pathname === '/app/ranking-serp' || location.pathname === '/score-geo' || location.pathname === '/analyse-bots-ia' || location.pathname === '/visibilite-llm' || location.pathname === '/pagespeed' || location.pathname === '/eeat' || location.pathname === '/pro-agency' || location.pathname === '/content-architect';
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
    <header className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-6xl rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-lg shadow-black/5" role="banner">
      <nav className="mx-auto flex h-12 sm:h-14 items-center justify-between px-4 sm:px-6" aria-label="Navigation principale">
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
               <a href="/" className="flex flex-col items-start" aria-label="Crawlers.fr - Accueil">
                <div className="flex items-center gap-2">
                {!isProfilePage && (
                  <svg className="h-8 w-8" viewBox="0 0 48 48" aria-hidden="true">
                    <defs>
                      <linearGradient id="headerBgGradient" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#d4a853"/>
                        <stop offset="30%" stopColor="#8b5cf6"/>
                        <stop offset="70%" stopColor="#7c3aed"/>
                        <stop offset="100%" stopColor="#3b5998"/>
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="48" height="48" rx="10" ry="10" fill="url(#headerBgGradient)"/>
                    <g transform="translate(9, 7.5) scale(1.25)" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
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
                {/* Language selector below logo */}
                {!isProfilePage && (
                  <div className="hidden sm:flex items-center gap-0.5 ml-10" role="group" aria-label="Sélection de la langue">
                    <button
                      onClick={(e) => { e.preventDefault(); setLanguage('fr'); }}
                      className={`h-4 w-4 rounded-md flex items-center justify-center transition-opacity ${language === 'fr' ? 'opacity-100' : 'opacity-40 hover:opacity-75'}`}
                      aria-pressed={language === 'fr'}
                      aria-label="Français"
                    >
                      <span className="text-[10px]">🇫🇷</span>
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setLanguage('en'); }}
                      className={`h-4 w-4 rounded-md flex items-center justify-center transition-opacity ${language === 'en' ? 'opacity-100' : 'opacity-40 hover:opacity-75'}`}
                      aria-pressed={language === 'en'}
                      aria-label="English"
                    >
                      <span className="text-[10px]">🇬🇧</span>
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setLanguage('es'); }}
                      className={`h-4 w-4 rounded-md flex items-center justify-center transition-opacity ${language === 'es' ? 'opacity-100' : 'opacity-40 hover:opacity-75'}`}
                      aria-pressed={language === 'es'}
                      aria-label="Español"
                    >
                      <span className="text-[10px]">🇪🇸</span>
                    </button>
                  </div>
                )}
              </a>
            </>
          )}
        </div>

        {/* Center: Navigation links - desktop */}
        {!isProfilePage && isHomePage && (
          <div className="hidden sm:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            <Link to="/features">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <span className="text-sm font-thin text-primary-foreground">Features</span>
              </Button>
            </Link>
            <Link to="/tarifs">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <span className="text-sm font-thin text-primary-foreground">{language === 'fr' ? 'Tarifs' : language === 'es' ? 'Precios' : 'Pricing'}</span>
              </Button>
            </Link>
            <Link to="/audit-expert">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <span className="text-sm font-thin text-primary-foreground">Audit</span>
              </Button>
            </Link>
            <Link to="/eeat">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <span className="text-sm font-thin text-primary-foreground">E-E-A-T</span>
              </Button>
            </Link>
            <Link to="/app/ranking-serp">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <span className="text-sm font-thin text-primary-foreground">SERPs</span>
              </Button>
            </Link>
          </div>
        )}
        {!isProfilePage && !isHomePage && <div className="hidden sm:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {/* 1. Matrice (gris) — hidden for non-subscribed users */}
          {user && profile?.plan_type && profile.plan_type !== 'free' && (
            <>
              <Link to="/matrice">
                <Button variant="ghost" size="sm" className={`gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 ${isMatricePage ? 'border border-muted-foreground' : ''}`}>
                  <Grid3X3 className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">Matrice</span>
                </Button>
              </Link>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            </>
          )}

          {/* 2. Crawl (violet) */}
          {isAuditExpertPage ? (
            <a href="/app/site-crawl" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className={`gap-1.5 text-purple-500 hover:text-purple-400 hover:bg-purple-500/10 ${isCrawlPage ? 'border border-purple-500' : ''}`}>
                <Bug className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold">Crawl</span>
              </Button>
            </a>
          ) : (
            <Link to="/app/site-crawl">
              <Button variant="ghost" size="sm" className={`gap-1.5 text-purple-500 hover:text-purple-400 hover:bg-purple-500/10 ${isCrawlPage ? 'border border-purple-500' : ''}`}>
                <Bug className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold">Crawl</span>
              </Button>
            </Link>
          )}

          <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />

          {/* 3. Audit (bleu foncé) */}
          {isAuditExpertPage ? (
            <Button variant="ghost" size="sm" className="gap-1.5 text-[#1e3a5f] dark:text-[#60a5fa] hover:bg-[#1e3a5f]/10 border border-[#1e3a5f] dark:border-[#60a5fa]">
              <Sparkles className="h-4 w-4" />
               <span className="text-sm font-normal">Audit</span>
            </Button>
          ) : (
            <Link to="/audit-expert">
              <Button variant="ghost" size="sm" className="gap-1.5 text-[#1e3a5f] dark:text-[#60a5fa] hover:text-[#1e3a5f] dark:hover:text-[#93c5fd] hover:bg-[#1e3a5f]/10">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-normal">Audit</span>
              </Button>
            </Link>
          )}

          <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />

          {/* 4. Cocoon (jaune d'or) */}
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

          {/* 5. Content Architect (vert foncé) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowContentArchitect(true)}
            className="gap-1.5 text-green-700 dark:text-green-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-700/10"
          >
            <PenLine className="h-3.5 w-3.5" />
            <span className="text-sm font-semibold">Content</span>
          </Button>

          {/* 6. Social Hub (vert glow) — hidden for non-subscribed users */}
          {user && profile?.plan_type && profile.plan_type !== 'free' && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              <Link to="/app/social">
                <Button variant="ghost" size="sm" className="gap-1.5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 [text-shadow:0_0_8px_rgba(16,185,129,0.4)]">
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">Social Hub</span>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-emerald-500/40 text-emerald-500 ml-0.5">beta</Badge>
                </Button>
              </Link>
            </>
          )}

          {/* Console — for paid users */}
          {!isProfilePage && !isAuditExpertPage && (user && (isAgencyPro || (profile?.plan_type && profile.plan_type !== 'free'))) && (
            <Link to="/app/console">
              <Button variant="ghost" size="sm" className={`gap-1.5 text-muted-foreground hover:text-foreground ${isProfilePage ? 'border border-muted-foreground' : ''}`}>
                <LayoutDashboard className="h-4 w-4" />
                <span className="text-sm">{t.console}</span>
              </Button>
            </Link>
          )}
        </div>}

        {/* Console-only centered shortcuts: Matrice, Crawl, Audit, Cocoon, Content, Social Hub */}
        {location.pathname === '/app/console' && (
          <div className="hidden sm:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
            <Link to="/matrice">
              <Button variant="ghost" size="sm" className="gap-1 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 sm:text-sm sm:gap-1.5 sm:px-3">
                <Grid3X3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Matrice
              </Button>
            </Link>
            <Link to="/app/site-crawl">
              <Button variant="ghost" size="sm" className="gap-1 px-2 text-xs text-purple-500 hover:text-purple-400 hover:bg-purple-500/10 sm:text-sm sm:gap-1.5 sm:px-3">
                <Bug className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Crawl
              </Button>
            </Link>
            <Link to="/audit-expert">
              <Button variant="ghost" size="sm" className="gap-1 px-2 text-xs text-[#1e3a5f] dark:text-[#60a5fa] hover:bg-[#1e3a5f]/10 sm:text-sm sm:gap-1.5 sm:px-3">
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Audit
              </Button>
            </Link>
            <Link to="/app/cocoon">
              <Button variant="ghost" size="sm" className="gap-1 px-2 text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 sm:text-sm sm:gap-1.5 sm:px-3">
                Cocoon
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowContentArchitect(true)}
              className="gap-1 px-2 text-xs text-green-700 dark:text-green-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-700/10 sm:text-sm sm:gap-1.5 sm:px-3"
            >
              <PenLine className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Content
            </Button>
            <Link to="/app/social">
              <Button variant="ghost" size="sm" className="gap-1 px-2 text-xs text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 [text-shadow:0_0_8px_rgba(16,185,129,0.4)] sm:text-sm sm:gap-1.5 sm:px-3">
                <Share2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Social Hub
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-emerald-500/40 text-emerald-500 ml-0.5">beta</Badge>
              </Button>
            </Link>
          </div>
        )}

        {/* Right side: Mobile nav + Audit CTA, Credits, Theme, User */}
        <div className="flex items-center gap-1.5 sm:gap-3">

          {/* Mobile-only: contextual nav buttons */}
          {!isProfilePage && (
            <div className="flex sm:hidden items-center gap-0.5">
              {isHomePage ? (
                <>
                  <Link to="/features">
                    <Button variant="ghost" size="sm" className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                      Features
                    </Button>
                  </Link>
                  <Link to="/tarifs">
                    <Button variant="ghost" size="sm" className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                      {language === 'fr' ? 'Tarifs' : language === 'es' ? 'Precios' : 'Pricing'}
                    </Button>
                  </Link>
                  <Link to="/audit-expert">
                    <Button variant="ghost" size="sm" className={`px-1.5 text-[11px] font-normal ${isAuditExpertPage ? 'text-primary bg-primary/10' : 'text-[#1e3a5f] dark:text-[#60a5fa]'}`}>
                      Audit
                    </Button>
                  </Link>
                  <Link to="/eeat">
                    <Button variant="ghost" size="sm" className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                      E-E-A-T
                    </Button>
                  </Link>
                  <Link to="/app/ranking-serp">
                    <Button variant="ghost" size="sm" className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                      SERPs
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/audit-expert">
                    <Button variant="ghost" size="sm" className={`gap-0.5 px-1.5 text-[11px] font-semibold ${isAuditExpertPage ? 'text-primary bg-primary/10' : 'text-[#1e3a5f] dark:text-[#60a5fa]'}`}>
                      <Sparkles className="h-3 w-3" />
                      Audit
                    </Button>
                  </Link>
                  <Link to="/app/site-crawl">
                    <Button variant="ghost" size="sm" className={`gap-0.5 px-1.5 text-[11px] font-semibold ${isCrawlPage ? 'text-purple-500 bg-purple-500/10' : 'text-purple-500'}`}>
                      <Bug className="h-3 w-3" />
                      Crawl
                    </Button>
                  </Link>
                  <Link to="/app/cocoon">
                    <Button variant="ghost" size="sm" className={`px-1.5 text-[11px] font-semibold text-amber-500 ${isCocoonPage ? 'bg-amber-500/10' : ''}`}>
                      Cocoon
                    </Button>
                  </Link>
                </>
              )}
            </div>
          )}

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
                    <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => navigate('/aide')}>
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
    <div className="h-14 sm:h-20" aria-hidden="true" />
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
