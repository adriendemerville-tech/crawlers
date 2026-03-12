import { useState, useEffect } from 'react';
import { User, Save, Loader2, Globe, Music, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WordPressIntegrationCard } from '@/components/Profile/WordPressIntegrationCard';
import { useCustomPlaylist, parseSpotifyUri } from '@/hooks/useCustomPlaylist';

const translations = {
  fr: {
    identity: 'Mes infos',
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
    languageSettings: 'Langue de l\'interface',
    languageDescription: 'Choisissez la langue d\'affichage de l\'application',
    french: 'Français',
    english: 'English',
    spanish: 'Español',
    managePersonalInfo: 'Gérez vos informations personnelles',
    manageLoginSettings: 'Gérez vos paramètres de connexion',
  },
  en: {
    identity: 'My Info',
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
    languageSettings: 'Interface Language',
    languageDescription: 'Choose the display language for the application',
    french: 'Français',
    english: 'English',
    spanish: 'Español',
    managePersonalInfo: 'Manage your personal information',
    manageLoginSettings: 'Manage your login settings',
  },
  es: {
    identity: 'Mis datos',
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
    languageSettings: 'Idioma de la interfaz',
    languageDescription: 'Elige el idioma de visualización de la aplicación',
    french: 'Français',
    english: 'English',
    spanish: 'Español',
    managePersonalInfo: 'Administra tu información personal',
    manageLoginSettings: 'Administra tu configuración de inicio de sesión',
  },
};

export function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const t = translations[language];

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      .update({ first_name: firstName, last_name: lastName })
      .eq('user_id', user.id);
    setIsSaving(false);
    if (error) {
      toast.error(language === 'fr' ? 'Erreur lors de la sauvegarde' : language === 'es' ? 'Error al guardar' : 'Error saving');
    } else {
      toast.success(t.saved);
      await refreshProfile();
    }
  };

  const isGoogleUser = user?.app_metadata?.provider === 'google';

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t.identity}
          </CardTitle>
          <CardDescription>{t.managePersonalInfo}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t.firstName}</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t.lastName}</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t.email}</Label>
            <Input id="email" value={user.email || ''} disabled className="bg-muted" />
          </div>
          <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? t.saving : t.saveChanges}
          </Button>
        </CardContent>
      </Card>

      {/* Login Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t.loginSettings}</CardTitle>
          <CardDescription>{t.manageLoginSettings}</CardDescription>
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
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            ) : (
              <Button variant="outline" size="sm">{t.changePassword}</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* WordPress Integration */}
      <WordPressIntegrationCard />

      {/* Language Settings — at the bottom */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t.languageSettings}
          </CardTitle>
          <CardDescription>{t.languageDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant={language === 'fr' ? 'default' : 'outline'} onClick={() => setLanguage('fr')} className="gap-2">
              <span>🇫🇷</span> {t.french}
            </Button>
            <Button variant={language === 'en' ? 'default' : 'outline'} onClick={() => setLanguage('en')} className="gap-2">
              <span>🇬🇧</span> {t.english}
            </Button>
            <Button variant={language === 'es' ? 'default' : 'outline'} onClick={() => setLanguage('es')} className="gap-2">
              <span>🇪🇸</span> {t.spanish}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
