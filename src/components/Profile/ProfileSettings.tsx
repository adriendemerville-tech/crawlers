import { useState, useEffect } from 'react';
import { User, Save, Loader2, Globe, Music, X, Sun, Moon, RefreshCw, CheckCircle2, Search, EyeOff, Eye, Unplug, Link2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
    playlistTitle: 'Playlist d\'audit',
    playlistDescription: 'Branchez votre propre playlist Spotify pour les audits',
    playlistPlaceholder: 'https://open.spotify.com/playlist/...',
    playlistSave: 'Enregistrer',
    playlistSaved: 'Playlist enregistrée !',
    playlistInvalid: 'Lien Spotify invalide (playlist ou album)',
    playlistReset: 'Utiliser la playlist Crawlers par défaut',
    playlistCurrent: 'Playlist personnalisée active',
    playlistDefault: 'Playlist Crawlers (par défaut)',
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
    playlistTitle: 'Audit Playlist',
    playlistDescription: 'Connect your own Spotify playlist for audits',
    playlistPlaceholder: 'https://open.spotify.com/playlist/...',
    playlistSave: 'Save',
    playlistSaved: 'Playlist saved!',
    playlistInvalid: 'Invalid Spotify link (playlist or album)',
    playlistReset: 'Use default Crawlers playlist',
    playlistCurrent: 'Custom playlist active',
    playlistDefault: 'Crawlers Playlist (default)',
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
    playlistTitle: 'Playlist de auditoría',
    playlistDescription: 'Conecta tu propia playlist de Spotify para las auditorías',
    playlistPlaceholder: 'https://open.spotify.com/playlist/...',
    playlistSave: 'Guardar',
    playlistSaved: '¡Playlist guardada!',
    playlistInvalid: 'Enlace de Spotify inválido (playlist o álbum)',
    playlistReset: 'Usar playlist Crawlers por defecto',
    playlistCurrent: 'Playlist personalizada activa',
    playlistDefault: 'Playlist Crawlers (por defecto)',
  },
};

export function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const t = translations[language];

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { playlistUri, savePlaylist, clearPlaylist } = useCustomPlaylist();
  const [playlistInput, setPlaylistInput] = useState('');
  const [gscConnecting, setGscConnecting] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<Record<string, { account_name: string | null; status: string }>>({});
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialConnecting, setSocialConnecting] = useState<string | null>(null);
  const [socialDisconnecting, setSocialDisconnecting] = useState<string | null>(null);

  // Fetch all social accounts
  useEffect(() => {
    if (!user) return;
    setSocialLoading(true);
    supabase
      .from('social_accounts' as any)
      .select('platform, account_name, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .then(({ data }: any) => {
        const map: Record<string, { account_name: string | null; status: string }> = {};
        (data || []).forEach((a: any) => { map[a.platform] = { account_name: a.account_name, status: a.status }; });
        setSocialAccounts(map);
        setSocialLoading(false);
      });
  }, [user]);

  const handleSocialConnect = async (platform: string) => {
    if (!user) return;
    setSocialConnecting(platform);
    try {
      const { data, error } = await supabase.functions.invoke('social-oauth-init', {
        body: { platform },
      });
      if (error) throw error;
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      console.error(`Social connect error (${platform}):`, err);
      toast.error(language === 'fr' ? 'Erreur de connexion' : language === 'es' ? 'Error de conexión' : 'Connection error');
    } finally {
      setSocialConnecting(null);
    }
  };

  const handleSocialDisconnect = async (platforms: string[]) => {
    if (!user) return;
    const key = platforms[0];
    setSocialDisconnecting(key);
    try {
      await supabase
        .from('social_accounts' as any)
        .update({ status: 'revoked' } as any)
        .eq('user_id', user.id)
        .in('platform', platforms);
      setSocialAccounts(prev => {
        const next = { ...prev };
        platforms.forEach(p => delete next[p]);
        return next;
      });
      toast.success(language === 'fr' ? 'Compte déconnecté' : language === 'es' ? 'Cuenta desconectada' : 'Account disconnected');
    } catch (err) {
      console.error('Social disconnect error:', err);
      toast.error(language === 'fr' ? 'Erreur lors de la déconnexion' : 'Disconnection error');
    } finally {
      setSocialDisconnecting(null);
    }
  };

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

  const handleUpdateGscConnection = async () => {
    if (!user) return;
    setGscConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-auth', {
        body: { action: 'login', user_id: user.id, frontend_origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      console.error('GSC update error:', err);
      toast.error(language === 'fr' ? 'Erreur de connexion' : language === 'es' ? 'Error de conexión' : 'Connection error');
    } finally {
      setGscConnecting(false);
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
          <Button onClick={handleSaveProfile} disabled={isSaving} variant="outline" className="gap-2 bg-transparent border-border rounded-sm">
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

      {/* Google Search Console & Analytics Connection */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Google Search Console & Analytics
          </CardTitle>
          <CardDescription>
            {language === 'fr'
              ? 'Connectez ou mettez à jour votre accès Google pour synchroniser Search Console et Google Analytics (GA4).'
              : language === 'es'
                ? 'Conecte o actualice su acceso a Google para sincronizar Search Console y Google Analytics (GA4).'
                : 'Connect or update your Google access to sync Search Console and Google Analytics (GA4).'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              {gscConnected ? (
                <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium text-sm">
                  {gscConnected
                    ? (language === 'fr' ? 'Compte Google connecté' : language === 'es' ? 'Cuenta Google conectada' : 'Google account connected')
                    : (language === 'fr' ? 'Non connecté' : language === 'es' ? 'No conectado' : 'Not connected')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {gscConnected
                    ? (language === 'fr'
                        ? 'Mettez à jour pour activer de nouvelles permissions (ex : GA4).'
                        : language === 'es'
                          ? 'Actualice para activar nuevos permisos (ej: GA4).'
                          : 'Update to enable new permissions (e.g. GA4).')
                    : (language === 'fr'
                        ? 'Connectez votre compte Google pour accéder aux données Search Console et Analytics.'
                        : language === 'es'
                          ? 'Conecte su cuenta Google para acceder a los datos de Search Console y Analytics.'
                          : 'Connect your Google account to access Search Console and Analytics data.')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0 bg-transparent border-border rounded-sm"
              disabled={gscConnecting}
              onClick={handleUpdateGscConnection}
            >
              {gscConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : gscConnected ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {gscConnected
                ? (language === 'fr' ? 'Mettre à jour' : language === 'es' ? 'Actualizar' : 'Update')
                : (language === 'fr' ? 'Connecter' : language === 'es' ? 'Conectar' : 'Connect')}
            </Button>
          </div>
          {gscConnected && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {language === 'fr'
                ? 'La reconnexion conserve vos données existantes et ajoute les nouvelles permissions.'
                : language === 'es'
                  ? 'La reconexión conserva sus datos existentes y agrega los nuevos permisos.'
                  : 'Reconnecting preserves your existing data and adds new permissions.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Meta (Facebook / Instagram) Connection */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.93 3.78-3.93 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 008.44-9.9c0-5.53-4.5-10.02-10-10.02z"/></svg>
            Meta
          </CardTitle>
          <CardDescription>
            {language === 'fr'
              ? 'Statut de connexion de votre compte Meta (Facebook / Instagram).'
              : language === 'es'
                ? 'Estado de conexión de su cuenta Meta (Facebook / Instagram).'
                : 'Connection status of your Meta account (Facebook / Instagram).'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              {metaLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : metaAccount ? (
                <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <Unplug className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium text-sm">
                  {metaLoading
                    ? (language === 'fr' ? 'Chargement...' : language === 'es' ? 'Cargando...' : 'Loading...')
                    : metaAccount
                      ? (language === 'fr' ? 'Compte Meta connecté' : language === 'es' ? 'Cuenta Meta conectada' : 'Meta account connected')
                      : (language === 'fr' ? 'Non connecté' : language === 'es' ? 'No conectado' : 'Not connected')}
                </p>
                {!metaLoading && metaAccount?.account_name && (
                  <p className="text-xs text-muted-foreground">{metaAccount.account_name}</p>
                )}
                {!metaLoading && !metaAccount && (
                  <p className="text-xs text-muted-foreground">
                    {language === 'fr'
                      ? 'Connectez votre compte depuis le module Social.'
                      : language === 'es'
                        ? 'Conecte su cuenta desde el módulo Social.'
                        : 'Connect your account from the Social module.'}
                  </p>
                )}
              </div>
            </div>
            {!metaLoading && metaAccount && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0 bg-transparent border-border rounded-sm text-destructive hover:text-destructive"
                    disabled={metaDisconnecting}
                  >
                    {metaDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    {language === 'fr' ? 'Déconnecter' : language === 'es' ? 'Desconectar' : 'Disconnect'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {language === 'fr' ? 'Déconnecter le compte Meta ?' : language === 'es' ? 'Desconectar la cuenta Meta?' : 'Disconnect Meta account?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {language === 'fr'
                        ? 'Cette action révoquera l\'accès à Facebook et Instagram. Vous pourrez reconnecter votre compte ultérieurement.'
                        : language === 'es'
                          ? 'Esta acción revocará el acceso a Facebook e Instagram. Podrá reconectar su cuenta más tarde.'
                          : 'This will revoke access to Facebook and Instagram. You can reconnect your account later.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-transparent border-border rounded-sm">
                      {language === 'fr' ? 'Annuler' : language === 'es' ? 'Cancelar' : 'Cancel'}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm"
                      onClick={async () => {
                        if (!user) return;
                        setMetaDisconnecting(true);
                        try {
                          await supabase
                            .from('social_accounts' as any)
                            .update({ status: 'revoked' } as any)
                            .eq('user_id', user.id)
                            .in('platform', ['facebook', 'instagram']);
                          setMetaAccount(null);
                          toast.success(language === 'fr' ? 'Compte Meta déconnecté' : language === 'es' ? 'Cuenta Meta desconectada' : 'Meta account disconnected');
                        } catch (err) {
                          console.error('Meta disconnect error:', err);
                          toast.error(language === 'fr' ? 'Erreur lors de la déconnexion' : 'Disconnection error');
                        } finally {
                          setMetaDisconnecting(false);
                        }
                      }}
                    >
                      {language === 'fr' ? 'Déconnecter' : language === 'es' ? 'Desconectar' : 'Disconnect'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            {t.playlistTitle}
          </CardTitle>
          <CardDescription>{t.playlistDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {playlistUri ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t.playlistCurrent}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { clearPlaylist(); toast.success(t.playlistDefault); }}
                className="gap-1 text-xs text-muted-foreground"
              >
                <X className="h-3 w-3" />
                {t.playlistReset}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.playlistDefault}</p>
          )}
          <div className="flex gap-2">
            <Input
              placeholder={t.playlistPlaceholder}
              value={playlistInput}
              onChange={(e) => setPlaylistInput(e.target.value)}
              className="text-sm"
            />
            <Button
              variant="outline"
              onClick={() => {
                if (savePlaylist(playlistInput)) {
                  toast.success(t.playlistSaved);
                  setPlaylistInput('');
                } else {
                  toast.error(t.playlistInvalid);
                }
              }}
              disabled={!playlistInput.trim()}
              className="shrink-0"
            >
              {t.playlistSave}
            </Button>
          </div>
        </CardContent>
      </Card>


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
            <Button variant="outline" onClick={() => setLanguage('fr')} className={`gap-2 rounded-sm bg-transparent border-border ${language === 'fr' ? 'border-foreground font-semibold' : ''}`}>
              <span>🇫🇷</span> {t.french}
            </Button>
            <Button variant="outline" onClick={() => setLanguage('en')} className={`gap-2 rounded-sm bg-transparent border-border ${language === 'en' ? 'border-foreground font-semibold' : ''}`}>
              <span>🇬🇧</span> {t.english}
            </Button>
            <Button variant="outline" onClick={() => setLanguage('es')} className={`gap-2 rounded-sm bg-transparent border-border ${language === 'es' ? 'border-foreground font-semibold' : ''}`}>
              <span>🇪🇸</span> {t.spanish}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <ThemeSettingsCard />

      {/* Ticker Settings */}
      <TickerSettingsCard />
    </div>
  );
}

function ThemeSettingsCard() {
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();
  const labels = {
    fr: { title: 'Apparence', desc: 'Choisissez le thème d\'affichage', light: 'Clair', dark: 'Sombre' },
    en: { title: 'Appearance', desc: 'Choose your display theme', light: 'Light', dark: 'Dark' },
    es: { title: 'Apariencia', desc: 'Elige el tema de visualización', light: 'Claro', dark: 'Oscuro' },
  };
  const l = labels[language] || labels.fr;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          {l.title}
        </CardTitle>
        <CardDescription>{l.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTheme('light')} className={`gap-2 rounded-sm bg-transparent border-border ${theme !== 'dark' ? 'border-foreground font-semibold' : ''}`}>
            <Sun className="h-4 w-4" /> {l.light}
          </Button>
          <Button variant="outline" onClick={() => setTheme('dark')} className={`gap-2 rounded-sm bg-transparent border-border ${theme === 'dark' ? 'border-foreground font-semibold' : ''}`}>
            <Moon className="h-4 w-4" /> {l.dark}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TickerSettingsCard() {
  const { language } = useLanguage();
  const [tickerHidden, setTickerHidden] = useState(() => localStorage.getItem('ticker_hidden_default') === '1');

  const labels = {
    fr: { title: 'Bandeau d\'alertes', desc: 'Masquer par défaut le bandeau défilant GA4 / GSC dans la console', hide: 'Masqué par défaut', show: 'Visible par défaut' },
    en: { title: 'Alerts ticker', desc: 'Hide the scrolling GA4 / GSC news ticker by default in the console', hide: 'Hidden by default', show: 'Visible by default' },
    es: { title: 'Cinta de alertas', desc: 'Ocultar por defecto la cinta de noticias GA4 / GSC en la consola', hide: 'Oculto por defecto', show: 'Visible por defecto' },
  };
  const l = labels[language] || labels.fr;

  const toggle = () => {
    const next = !tickerHidden;
    setTickerHidden(next);
    localStorage.setItem('ticker_hidden_default', next ? '1' : '0');
    toast.success(next ? l.hide : l.show);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {tickerHidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          {l.title}
        </CardTitle>
        <CardDescription>{l.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button variant="outline" onClick={toggle} className={`gap-2 rounded-sm bg-transparent border-border ${!tickerHidden ? 'border-foreground font-semibold' : ''}`}>
            <Eye className="h-4 w-4" /> {l.show}
          </Button>
          <Button variant="outline" onClick={toggle} className={`gap-2 rounded-sm bg-transparent border-border ${tickerHidden ? 'border-foreground font-semibold' : ''}`}>
            <EyeOff className="h-4 w-4" /> {l.hide}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}