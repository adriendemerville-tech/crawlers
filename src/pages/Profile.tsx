import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { User, Settings, FileText, ArrowLeft, LogOut, Save, Loader2, Globe, ClipboardList, Code2, Wallet, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MyReports } from '@/components/Profile/MyReports';
import { MyActionPlans } from '@/components/Profile/MyActionPlans';
import { MyCorrectiveCodes } from '@/components/Profile/MyCorrectiveCodes';
import { MyWallet } from '@/components/Profile/MyWallet';
import { AdminDashboard } from '@/components/Admin';
import { ReportProblemButton } from '@/components/Support';

const translations = {
  fr: {
    pageTitle: 'Mon Profil - Crawlers AI',
    title: 'Mon Profil',
    identity: 'Mes infos',
    settings: 'Paramètres',
    myReports: 'Mes Rapports',
    actionPlans: 'Plans d\'Action',
    correctiveCodes: 'Codes Correctifs',
    wallet: 'Portefeuille',
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
    pageTitle: 'My Profile - Crawlers AI',
    title: 'My Profile',
    identity: 'My Info',
    settings: 'Settings',
    myReports: 'My Reports',
    actionPlans: 'Action Plans',
    correctiveCodes: 'Corrective Codes',
    wallet: 'Wallet',
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
    pageTitle: 'Mi Perfil - Crawlers AI',
    title: 'Mi Perfil',
    identity: 'Mis datos',
    settings: 'Configuración',
    myReports: 'Mis Informes',
    actionPlans: 'Planes de Acción',
    correctiveCodes: 'Códigos Correctivos',
    wallet: 'Billetera',
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
  const { user, profile, signOut, refreshProfile, loading } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = translations[language];

  // Get initial tab from URL or default to 'identity'
  const initialTab = searchParams.get('tab') || 'identity';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
      })
      .eq('user_id', user.id);

    setIsSaving(false);

    if (error) {
      toast.error('Erreur lors de la sauvegarde');
    } else {
      toast.success(t.saved);
      await refreshProfile();
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const isGoogleUser = user?.app_metadata?.provider === 'google';
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';

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
        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              {t.backToHome}
            </Link>

            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold">{t.title}</h1>
                <p className="text-muted-foreground">{t.memberSince} {memberSince}</p>
              </div>
              <div className="flex items-center gap-2">
                <ReportProblemButton />
                <Button variant="outline" onClick={handleLogout} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  {t.logout}
                </Button>
              </div>
            </div>

            <Tabs defaultValue={initialTab} className="space-y-6">
              <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-7' : 'grid-cols-6'}`}>
                <TabsTrigger value="identity" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.identity}</span>
                </TabsTrigger>
                <TabsTrigger value="wallet" className="gap-2">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.wallet}</span>
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.myReports}</span>
                </TabsTrigger>
                <TabsTrigger value="action-plans" className="gap-2">
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.actionPlans}</span>
                </TabsTrigger>
                <TabsTrigger value="corrective-codes" className="gap-2">
                  <Code2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.correctiveCodes}</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.settings}</span>
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="admin" className="gap-2 text-primary">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="identity">
                <Card>
                  <CardHeader>
                    <CardTitle>{t.identity}</CardTitle>
                    <CardDescription>
                      {language === 'fr' ? 'Gérez vos informations personnelles' : 
                       language === 'es' ? 'Administra tu información personal' :
                       'Manage your personal information'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">{t.firstName}</Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">{t.lastName}</Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t.email}</Label>
                      <Input
                        id="email"
                        value={user.email || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {isSaving ? t.saving : t.saveChanges}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wallet">
                <MyWallet />
              </TabsContent>

              <TabsContent value="settings">
                <div className="space-y-6">
                  {/* Language Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        {t.languageSettings}
                      </CardTitle>
                      <CardDescription>
                        {t.languageDescription}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={language === 'fr' ? 'default' : 'outline'}
                          onClick={() => setLanguage('fr')}
                          className="gap-2"
                        >
                          <span>🇫🇷</span>
                          {t.french}
                        </Button>
                        <Button
                          variant={language === 'en' ? 'default' : 'outline'}
                          onClick={() => setLanguage('en')}
                          className="gap-2"
                        >
                          <span>🇬🇧</span>
                          {t.english}
                        </Button>
                        <Button
                          variant={language === 'es' ? 'default' : 'outline'}
                          onClick={() => setLanguage('es')}
                          className="gap-2"
                        >
                          <span>🇪🇸</span>
                          {t.spanish}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Login Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t.loginSettings}</CardTitle>
                      <CardDescription>
                        {language === 'fr' ? 'Gérez vos paramètres de connexion' : 
                         language === 'es' ? 'Administra tu configuración de inicio de sesión' :
                         'Manage your login settings'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                        <div>
                          <p className="font-medium">{t.connectedWith}</p>
                          <p className="text-sm text-muted-foreground">
                            {isGoogleUser ? t.googleAccount : t.emailAccount}
                          </p>
                        </div>
                        {isGoogleUser ? (
                          <svg className="h-6 w-6" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="currentColor"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="currentColor"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="currentColor"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                        ) : (
                          <Button variant="outline" size="sm">
                            {t.changePassword}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="reports">
                <MyReports />
              </TabsContent>

              <TabsContent value="action-plans">
                <MyActionPlans />
              </TabsContent>

              <TabsContent value="corrective-codes">
                <MyCorrectiveCodes />
              </TabsContent>

              {isAdmin && (
                <TabsContent value="admin">
                  <AdminDashboard language={language} />
                </TabsContent>
              )}
            </Tabs>
          </motion.div>
        </main>
        <Footer />
      </div>
    </>
  );
}
