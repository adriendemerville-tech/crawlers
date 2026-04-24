import { useEffect, lazy, Suspense, useState, Component, ErrorInfo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { ConsoleSidebar } from '@/components/Console/ConsoleSidebar';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));
const MyReports = lazy(() => import('@/components/Profile/MyReports').then(m => ({ default: m.MyReports })));
const MyActionPlans = lazy(() => import('@/components/Profile/MyActionPlans').then(m => ({ default: m.MyActionPlans })));
const MyCorrectiveCodes = lazy(() => import('@/components/Profile/MyCorrectiveCodes').then(m => ({ default: m.MyCorrectiveCodes })));
const MyWallet = lazy(() => import('@/components/Profile/MyWallet').then(m => ({ default: m.MyWallet })));
const MyTracking = lazy(() => import('@/components/Profile/MyTracking').then(m => ({ default: m.MyTracking })));
const GEOTab = lazy(() => import('@/components/Profile/GEOTab').then(m => ({ default: m.GEOTab })));
const MyCrawls = lazy(() => import('@/components/Profile/MyCrawls').then(m => ({ default: m.MyCrawls })));
const GMBDashboard = lazy(() => import('@/components/Profile/GMBDashboard').then(m => ({ default: m.GMBDashboard })));
const MyReportsTab = lazy(() => import('@/components/Profile/MyReportsTab').then(m => ({ default: m.MyReportsTab })));
const BundleOptionTab = lazy(() => import('@/components/Profile/BundleOptionTab').then(m => ({ default: m.BundleOptionTab })));
const MyContent = lazy(() => import('@/components/Profile/MyContent').then(m => ({ default: m.MyContent })));
const MarinaConsoleTab = lazy(() => import('@/components/Profile/MarinaConsoleTab').then(m => ({ default: m.MarinaConsoleTab })));
const SeaSeoBridgeTab = lazy(() => import('@/components/Profile/SeaSeoBridgeTab').then(m => ({ default: m.SeaSeoBridgeTab })));
const IndexationMonitor = lazy(() => import('@/components/Console/IndexationMonitor').then(m => ({ default: m.IndexationMonitor })));
const GscBigQueryPanel = lazy(() => import('@/components/Console/GscBigQueryPanel').then(m => ({ default: m.GscBigQueryPanel })));
const AdminDashboard = lazy(() => import('@/components/Admin').then(m => ({ default: m.AdminDashboard })));
const ProfileSettings = lazy(() => import('@/components/Profile/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
import { useAdmin } from '@/hooks/useAdmin';
import { useCredits } from '@/contexts/CreditsContext';
import { FreeTrialBanner } from '@/components/Profile/FreeTrialBanner';
import { WelcomeBackModal } from '@/components/WelcomeBackModal';
import { GoogleServicesOnboardingModal } from '@/components/Console/GoogleServicesOnboardingModal';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';

const translations = {
  fr: { pageTitle: 'Console - Crawlers AI' },
  en: { pageTitle: 'Console - Crawlers AI' },
  es: { pageTitle: 'Consola - Crawlers AI' },
};

function ProfileContent() {
  const { user, profile, signOut, loading } = useAuth();
  const { language } = useLanguage();
  const { isAdmin, isViewer, isViewerLevel2, hasAdminAccess, isReadOnly, isAuditor, auditorExpired, canSeeDocs, canSeeAlgos, canSeeFinances, canSeeUsers, canSeeIntelligence, loading: adminLoading } = useAdmin();
  const { isAgencyPro, balance, planType } = useCredits();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [simulatedDataEnabled, setSimulatedDataEnabled] = useState(true);
  const [showGoogleOnboarding, setShowGoogleOnboarding] = useState(false);
  const isMobile = useIsMobile();
  const isProUser = isAgencyPro || isAdmin;

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || (hasAdminAccess ? 'admin' : 'tracking'));
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [openApiPanel, setOpenApiPanel] = useState(false);

  // Sync tab with URL params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    if (tab === 'tracking-api') {
      setActiveTab('tracking');
      setSearchParams({ tab: 'tracking' });
      setOpenApiPanel(true);
      return;
    }
    setOpenApiPanel(false);
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from('admin_dashboard_config')
      .select('card_order')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.card_order && typeof data.card_order === 'object' && !Array.isArray(data.card_order)) {
          const config = data.card_order as Record<string, unknown>;
          setSimulatedDataEnabled(config.simulated_data_enabled !== false);
          return;
        }
        setSimulatedDataEnabled(true);
      });
  }, [user]);

  useEffect(() => {
    if (!user || !isAgencyPro) return;
    const key = `google_onboarding_shown_${user.id}`;
    if (!localStorage.getItem(key)) {
      const timer = setTimeout(() => {
        setShowGoogleOnboarding(true);
        localStorage.setItem(key, '1');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user, isAgencyPro]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (auditorExpired && !isAdmin && !isViewer && !isViewerLevel2) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'admin') {
        navigate('/app/console?tab=tracking', { replace: true });
      }
    }
  }, [auditorExpired, isAdmin, isViewer, isViewerLevel2, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'wallet': return <MyWallet />;
      case 'tracking': return <MyTracking externalSiteId={selectedSiteId} forceApiPanel={openApiPanel} onApiPanelOpened={() => setOpenApiPanel(false)} />;
      case 'geo': return <GEOTab externalSiteId={selectedSiteId} externalDomain={selectedDomain} />;
      case 'settings': return <ProfileSettings />;
      case 'reports': return <MyReports />;
      case 'action-plans': return <MyActionPlans externalDomain={selectedDomain} />;
      case 'corrective-codes': return <MyCorrectiveCodes externalDomain={selectedDomain} />;
      case 'crawls': return isProUser ? <MyCrawls externalDomain={selectedDomain} /> : null;
      case 'drafts': return <MyContent externalDomain={selectedDomain} />;
      case 'marina': return <MarinaConsoleTab />;
      case 'sea-seo': return isProUser ? <SeaSeoBridgeTab /> : null;
      case 'indexation': return <IndexationMonitor externalSiteId={selectedSiteId} externalDomain={selectedDomain} />;
      case 'gsc-bigquery': return isProUser ? <GscBigQueryPanel /> : null;
      case 'gmb': return <GMBDashboard isGated={!isProUser} simulatedDataEnabled={simulatedDataEnabled} />;
      case 'reports-tab': return isProUser ? <MyReportsTab /> : null;
      case 'bundle': return isAdmin ? <BundleOptionTab /> : null;
      case 'admin': return hasAdminAccess ? (
        <AdminDashboard
          readOnly={isReadOnly}
          canSeeDocs={canSeeDocs}
          canSeeAlgos={canSeeAlgos}
          canSeeFinances={canSeeFinances}
          canSeeUsers={canSeeUsers}
          canSeeIntelligence={canSeeIntelligence}
          isAuditor={isAuditor}
          onSimulatedDataChange={setSimulatedDataEnabled}
          onShowGoogleOnboarding={() => setShowGoogleOnboarding(true)}
        />
      ) : null;
      default: return <MyTracking externalSiteId={selectedSiteId} />;
    }
  };

  return (
    <>
      <WelcomeBackModal />
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="description" content="Gérez votre profil Crawlers.fr : crédits, abonnement, clé API et paramètres de compte." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <FreeTrialBanner />
        <div className={cn('flex-1 flex', isMobile ? 'flex-col' : 'flex-row')}>
          <ConsoleSidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onSiteSelect={(siteId, domain) => {
              setSelectedSiteId(siteId);
              setSelectedDomain(domain);
            }}
            
          />
          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-2 max-w-7xl">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }>
                {renderContent()}
              </Suspense>
            </motion.div>
          </main>
        </div>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
        {showCreditModal && (
          <CreditTopUpModal
            open={showCreditModal}
            onOpenChange={setShowCreditModal}
            currentBalance={balance}
          />
        )}
      </div>
      <GoogleServicesOnboardingModal open={showGoogleOnboarding} onOpenChange={setShowGoogleOnboarding} />
    </>
  );
}

class ProfileErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Profile] Crash:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <p className="text-lg font-semibold text-destructive">Erreur d'affichage</p>
            <p className="text-sm text-muted-foreground max-w-md">{this.state.error?.message}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Recharger</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Profile() {
  return (
    <ProfileErrorBoundary>
      <ProfileContent />
    </ProfileErrorBoundary>
  );
}
