import { useEffect, lazy, Suspense, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Settings, FileText, ArrowLeft, LogOut, Loader2, CheckSquare, Code2, Wallet, Shield, Radar, Crown, Bug, Lock, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));
import { MyReports } from '@/components/Profile/MyReports';
import { MyActionPlans } from '@/components/Profile/MyActionPlans';
import { MyCorrectiveCodes } from '@/components/Profile/MyCorrectiveCodes';
import { MyWallet } from '@/components/Profile/MyWallet';
import { MyTracking } from '@/components/Profile/MyTracking';
import { MyCrawls } from '@/components/Profile/MyCrawls';
import { AdminDashboard } from '@/components/Admin';
import { ProfileSettings } from '@/components/Profile/ProfileSettings';
import { useAdmin } from '@/hooks/useAdmin';
import { useCredits } from '@/contexts/CreditsContext';
import { FreeTrialBanner } from '@/components/Profile/FreeTrialBanner';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';

const translations = {
  fr: {
    pageTitle: 'Console - Crawlers AI',
    title: 'Console',
    identity: 'Mes infos',
    settings: 'Paramètres',
    myReports: 'Rapports',
    actionPlans: 'Plans d\'Action',
    correctiveCodes: 'Codes Correctifs',
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
    correctiveCodes: 'Corrective Codes',
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
    correctiveCodes: 'Códigos Correctivos',
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

export default function Profile() {
  const { user, profile, signOut, loading } = useAuth();
  const { language } = useLanguage();
  const { isAdmin, hasAdminAccess, isReadOnly, canSeeDocs, canSeeAlgos, loading: adminLoading } = useAdmin();
  const { isAgencyPro, balance } = useCredits();
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
      <Helmet>
        <title>{t.pageTitle}</title>
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-4 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >

            {/* Header with Cocoon button */}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">{t.title}</h1>
              {isProUser && (
                <Button variant="outline" asChild className="gap-2 border-amber-500/30 hover:bg-amber-500/10">
                  <Link to="/cocoon">
                    <Network className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">BETA</span>
                    <span className="text-amber-500 font-semibold">Cocoon</span>
                  </Link>
                </Button>
              )}
            </div>

            <FreeTrialBanner />
            <Tabs defaultValue={initialTab} className="space-y-6">
              <TabsList className="w-full flex">
                {isProUser && (
                  <TabsTrigger value="wallet" className="flex-1 gap-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    <span className="hidden sm:inline text-yellow-500 font-semibold">Pro Agency</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="tracking" className="flex-1 gap-2">
                  <Radar className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.tracking}</span>
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex-1 gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.myReports}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="crawls"
                  className="flex-1 gap-2"
                  disabled={!isProUser}
                >
                  <Bug className="h-4 w-4 text-purple-500" />
                  <span className="hidden sm:inline">Crawls</span>
                  {!isProUser && <Lock className="h-3 w-3 text-muted-foreground" />}
                </TabsTrigger>
                <TabsTrigger value="action-plans" className="flex-1 gap-2">
                  <CheckSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.actionPlans}</span>
                </TabsTrigger>
                <TabsTrigger value="corrective-codes" className="flex-1 gap-2">
                  <Code2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.correctiveCodes}</span>
                </TabsTrigger>
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
                    <span className="hidden sm:inline">Créateur</span>
                  </TabsTrigger>
                )}
              </TabsList>


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


              {hasAdminAccess && (
                <TabsContent value="admin">
                  <AdminDashboard readOnly={isReadOnly} canSeeDocs={canSeeDocs} canSeeAlgos={canSeeAlgos} />
                </TabsContent>
              )}
            </Tabs>

            <div className="flex justify-end mt-8">
              <Button variant="outline" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                {t.logout}
              </Button>
            </div>
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
