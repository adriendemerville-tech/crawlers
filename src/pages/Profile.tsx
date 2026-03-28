import { useEffect, lazy, Suspense, useState, Component, ErrorInfo, ReactNode } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Settings, FileText, ArrowLeft, LogOut, Loader2, CheckSquare, Code2, Wallet, Shield, Radar, Crown, Bug, Lock, Network, Store, Grid3X3, FileBox, Blocks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));
const MyReports = lazy(() => import('@/components/Profile/MyReports').then(m => ({ default: m.MyReports })));
const MyActionPlans = lazy(() => import('@/components/Profile/MyActionPlans').then(m => ({ default: m.MyActionPlans })));
const MyCorrectiveCodes = lazy(() => import('@/components/Profile/MyCorrectiveCodes').then(m => ({ default: m.MyCorrectiveCodes })));
const MyWallet = lazy(() => import('@/components/Profile/MyWallet').then(m => ({ default: m.MyWallet })));
const MyTracking = lazy(() => import('@/components/Profile/MyTracking').then(m => ({ default: m.MyTracking })));
const MyCrawls = lazy(() => import('@/components/Profile/MyCrawls').then(m => ({ default: m.MyCrawls })));
const GMBDashboard = lazy(() => import('@/components/Profile/GMBDashboard').then(m => ({ default: m.GMBDashboard })));
const MyReportsTab = lazy(() => import('@/components/Profile/MyReportsTab').then(m => ({ default: m.MyReportsTab })));
const BundleOptionTab = lazy(() => import('@/components/Profile/BundleOptionTab').then(m => ({ default: m.BundleOptionTab })));
const AdminDashboard = lazy(() => import('@/components/Admin').then(m => ({ default: m.AdminDashboard })));
const ProfileSettings = lazy(() => import('@/components/Profile/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
import { useAdmin } from '@/hooks/useAdmin';
import { useCredits } from '@/contexts/CreditsContext';
import { FreeTrialBanner } from '@/components/Profile/FreeTrialBanner';
import { WelcomeBackModal } from '@/components/WelcomeBackModal';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';


const translations = {
  fr: {
    pageTitle: 'Console - Crawlers AI',
    title: 'Console',
    identity: 'Mes infos',
    settings: 'Paramètres',
    myReports: 'Rapports',
    actionPlans: 'Plans d\'Action',
    correctiveCodes: '<Scripts>',
    creator: 'Créateur',
    wallet: 'Portefeuille',
    tracking: 'Mes sites',
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'Email',
    saveChanges: 'Enregistrer',
    saving: 'Enregistrement...',
    saved: 'Modifications enregistrées',
    loginSettings: 'Paramètres de connexion',
    connectedWith: 'Connecté avec',
    googleAccount: 'Compte Google',
    emailAccount: 'Email et mot de passe',
    changePassword: 'Changer le mot de passe',
    logout: 'Déconnexion',
    backToHome: 'Retour à l\'accueil',
    memberSince: 'Membre depuis',
    languageSettings: 'Langue de l\'interface',
    languageDescription: 'Choisissez la langue d\'affichage de l\'application',
    french: 'Français',
    english: 'English',
    spanish: 'Español',
  },
  en: {
    pageTitle: 'Console - Crawlers AI',
    title: 'Console',
    identity: 'My Info',
    settings: 'Settings',
    myReports: 'Reports',
    actionPlans: 'Action Plans',
    correctiveCodes: '<Scripts>',
    creator: 'Creator',
    wallet: 'Wallet',
    tracking: 'My Sites',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    saveChanges: 'Save',
    saving: 'Saving...',
    saved: 'Changes saved',
    loginSettings: 'Login Settings',
    connectedWith: 'Connected with',
    googleAccount: 'Google Account',
    emailAccount: 'Email and password',
    changePassword: 'Change password',
    logout: 'Log out',
    backToHome: 'Back to home',
    memberSince: 'Member since',
    languageSettings: 'Interface Language',
    languageDescription: 'Choose the display language for the application',
    french: 'Français',
    english: 'English',
    spanish: 'Español',
  },
  es: {
    pageTitle: 'Consola - Crawlers AI',
    title: 'Consola',
    identity: 'Mis datos',
    settings: 'Configuración',
    myReports: 'Informes',
    actionPlans: 'Planes de Acción',
    correctiveCodes: '<Scripts>',
    creator: 'Creador',
    wallet: 'Billetera',
    tracking: 'Mis sitios',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    saveChanges: 'Guardar',
    saving: 'Guardando...',
    saved: 'Cambios guardados',
    loginSettings: 'Configuración de inicio de sesión',
    connectedWith: 'Conectado con',
    googleAccount: 'Cuenta de Google',
    emailAccount: 'Email y contraseña',
    changePassword: 'Cambiar contraseña',
    logout: 'Cerrar sesión',
    backToHome: 'Volver al inicio',
    memberSince: 'Miembro desde',
    languageSettings: 'Idioma de la interfaz',
    languageDescription: 'Elige el idioma de visualización de la aplicación',
    french: 'Français',
    english: 'English',
    spanish: 'Español',
  },
};

function ProfileContent() {
  const { user, profile, signOut, loading } = useAuth();
  const { language } = useLanguage();
  const { isAdmin, isViewer, isViewerLevel2, hasAdminAccess, isReadOnly, isAuditor, auditorExpired, canSeeDocs, canSeeAlgos, canSeeFinances, canSeeUsers, canSeeIntelligence, loading: adminLoading } = useAdmin();
  const { isAgencyPro, balance, planType } = useCredits();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = translations[language];
  const [showCreditModal, setShowCreditModal] = useState(false);
  

  const initialTab = searchParams.get('tab') || 'tracking';
  const isProUser = isAgencyPro || isAdmin;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // When auditor session expires, force-redirect away from admin tab
  useEffect(() => {
    if (auditorExpired && !isAdmin && !isViewer && !isViewerLevel2) {
      // Pure auditor whose session expired — kick out of admin
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
        <main className="flex-1 container mx-auto px-4 py-2 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >


            <FreeTrialBanner />
            <Tabs defaultValue={initialTab} className="space-y-2">
              <TabsList className="w-full flex my-0 py-0">
                {isProUser && (
                  <TabsTrigger value="wallet" className="flex-1 gap-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    <span className="hidden sm:inline font-semibold bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(30,90%,55%)] bg-clip-text text-transparent">
                      {planType === 'agency_premium' ? 'Pro Agency +' : 'Pro Agency'}
                    </span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="tracking" className="flex-1 gap-2">
                  <Radar className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.tracking}</span>
                </TabsTrigger>
                <TabsTrigger value="action-plans" className="flex-1 gap-2">
                  <CheckSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.actionPlans}</span>
                </TabsTrigger>
                <TabsTrigger value="corrective-codes" className="flex-1 gap-2">
                  <span className="hidden sm:inline">{t.correctiveCodes}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="crawls"
                  className="flex-1 gap-2"
                  disabled={!isProUser}
                >
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden sm:inline">Crawls</span>
                  {!isProUser && <Lock className="h-3 w-3 text-muted-foreground" />}
                </TabsTrigger>
                {isProUser && (
                  <TabsTrigger
                    value="gmb"
                    className="flex-1 gap-2"
                  >
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span className="hidden sm:inline">GMB</span>
                  </TabsTrigger>
                )}
                {isProUser && (
                  <TabsTrigger
                    value="reports-tab"
                    className="flex-1 gap-2"
                  >
                    <FileBox className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.myReports}</span>
                  </TabsTrigger>
                )}
                {isAdmin && (
                  <TabsTrigger
                    value="bundle"
                    className="flex-1 gap-2"
                  >
                    <Blocks className="h-4 w-4 text-orange-500" />
                    <span className="hidden sm:inline">Bundle</span>
                  </TabsTrigger>
                )}
                {!isProUser && (
                  <TabsTrigger value="reports" className="flex-1 gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.myReports}</span>
                  </TabsTrigger>
                )}
                {!isProUser && (
                  <TabsTrigger value="wallet" className="flex-1 gap-2">
                    <Wallet className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.wallet}</span>
                  </TabsTrigger>
                )}
                <div className="ml-auto" />
                {!isProUser && (
                  <TabsTrigger value="settings" className="gap-2">
                    <Settings className="h-4 w-4" />
                  </TabsTrigger>
                )}
                {hasAdminAccess && (
                  <TabsTrigger value="admin" className="gap-2 text-primary">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.creator}</span>
                  </TabsTrigger>
                )}
              </TabsList>

              <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                <TabsContent value="wallet">
                  <MyWallet />
                </TabsContent>

                <TabsContent value="tracking">
                  <MyTracking />
                </TabsContent>

                {!isProUser && (
                  <TabsContent value="settings">
                    <ProfileSettings />
                  </TabsContent>
                )}

                <TabsContent value="reports">
                  <MyReports />
                </TabsContent>

                <TabsContent value="action-plans">
                  <MyActionPlans />
                </TabsContent>

                <TabsContent value="corrective-codes">
                  <MyCorrectiveCodes />
                </TabsContent>

                {isProUser && (
                  <TabsContent value="crawls">
                    <MyCrawls />
                  </TabsContent>
                )}

                {isProUser && (
                  <TabsContent value="gmb">
                    <GMBDashboard />
                  </TabsContent>
                )}

                {isProUser && (
                  <TabsContent value="reports-tab">
                    <MyReportsTab />
                  </TabsContent>
                )}

                {isAdmin && (
                  <TabsContent value="bundle">
                    <BundleOptionTab />
                  </TabsContent>
                )}

                {hasAdminAccess && (
                  <TabsContent value="admin">
                    <AdminDashboard readOnly={isReadOnly} canSeeDocs={canSeeDocs} canSeeAlgos={canSeeAlgos} canSeeFinances={canSeeFinances} canSeeUsers={canSeeUsers} canSeeIntelligence={canSeeIntelligence} isAuditor={isAuditor} />
                  </TabsContent>
                )}
              </Suspense>
            </Tabs>

          </motion.div>
        </main>
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
