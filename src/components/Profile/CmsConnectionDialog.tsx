import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface TrackedSite {
  id: string;
  domain: string;
}

interface CmsConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cmsType: 'wordpress' | 'drupal';
}

const translations = {
  fr: {
    title: 'Connexion API',
    selectSite: 'Sélectionnez un site',
    noSites: 'Aucun site suivi. Ajoutez un site dans "Mes Sites" d\'abord.',
    siteUrl: 'URL du site',
    authMethod: 'Méthode d\'authentification',
    basicAuth: 'Basic Auth',
    oauth: 'OAuth 2.0',
    apiKey: 'Clé API / Application Password',
    username: 'Nom d\'utilisateur',
    password: 'Mot de passe',
    testConnection: 'Tester la connexion',
    save: 'Enregistrer',
    testing: 'Test en cours…',
    saving: 'Enregistrement…',
    testSuccess: 'Connexion réussie !',
    testFailed: 'Échec de la connexion',
    saved: 'Connexion enregistrée !',
    wpHelp: 'Utilisez un "Application Password" WordPress (Utilisateurs → Profil → Mots de passe d\'application).',
    drupalHelp: 'Utilisez Basic Auth ou configurez le module Simple OAuth pour OAuth 2.0.',
  },
  en: {
    title: 'API Connection',
    selectSite: 'Select a site',
    noSites: 'No tracked sites. Add a site in "My Sites" first.',
    siteUrl: 'Site URL',
    authMethod: 'Authentication method',
    basicAuth: 'Basic Auth',
    oauth: 'OAuth 2.0',
    apiKey: 'API Key / Application Password',
    username: 'Username',
    password: 'Password',
    testConnection: 'Test connection',
    save: 'Save',
    testing: 'Testing…',
    saving: 'Saving…',
    testSuccess: 'Connection successful!',
    testFailed: 'Connection failed',
    saved: 'Connection saved!',
    wpHelp: 'Use a WordPress "Application Password" (Users → Profile → Application Passwords).',
    drupalHelp: 'Use Basic Auth or configure the Simple OAuth module for OAuth 2.0.',
  },
  es: {
    title: 'Conexión API',
    selectSite: 'Seleccione un sitio',
    noSites: 'No hay sitios rastreados. Añada un sitio en "Mis Sitios" primero.',
    siteUrl: 'URL del sitio',
    authMethod: 'Método de autenticación',
    basicAuth: 'Basic Auth',
    oauth: 'OAuth 2.0',
    apiKey: 'Clave API / Application Password',
    username: 'Nombre de usuario',
    password: 'Contraseña',
    testConnection: 'Probar conexión',
    save: 'Guardar',
    testing: 'Probando…',
    saving: 'Guardando…',
    testSuccess: '¡Conexión exitosa!',
    testFailed: 'Conexión fallida',
    saved: '¡Conexión guardada!',
    wpHelp: 'Use un "Application Password" de WordPress (Usuarios → Perfil → Contraseñas de aplicación).',
    drupalHelp: 'Use Basic Auth o configure el módulo Simple OAuth para OAuth 2.0.',
  },
};

export function CmsConnectionDialog({ open, onOpenChange, cmsType }: CmsConnectionDialogProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [authMethod, setAuthMethod] = useState<'basic_auth' | 'oauth'>('basic_auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('tracked_sites')
        .select('id, domain')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setSites(data);
    })();
  }, [open]);

  useEffect(() => {
    if (selectedSiteId) {
      const site = sites.find(s => s.id === selectedSiteId);
      if (site) {
        setSiteUrl(`https://${site.domain}`);
      }
    }
    setTestResult(null);
  }, [selectedSiteId, sites]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const fnName = cmsType === 'wordpress' ? 'wpsync' : 'drupal-actions';
      const body: Record<string, string> = { action: 'test-connection', site_url: siteUrl };

      if (cmsType === 'drupal') {
        body.auth_method = authMethod;
        if (authMethod === 'basic_auth') {
          body.basic_user = username;
          body.basic_pass = password;
        }
      } else {
        // WordPress: test via REST API
        body.auth_method = 'basic_auth';
        body.basic_user = username;
        body.basic_pass = password;
      }

      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      if (data?.success || data?.status === 'ok') {
        setTestResult('success');
        toast.success(t.testSuccess);
      } else {
        setTestResult('failed');
        toast.error(data?.error || t.testFailed);
      }
    } catch (err: any) {
      setTestResult('failed');
      toast.error(err.message || t.testFailed);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('cms_connections').upsert({
        user_id: user.id,
        tracked_site_id: selectedSiteId,
        platform: cmsType,
        site_url: siteUrl,
        auth_method: authMethod,
        basic_auth_user: authMethod === 'basic_auth' ? username : null,
        basic_auth_pass: authMethod === 'basic_auth' ? password : null,
        status: testResult === 'success' ? 'active' : 'pending',
      }, { onConflict: 'tracked_site_id,platform' });

      if (error) throw error;
      toast.success(t.saved);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const canTest = siteUrl && username && password;
  const canSave = selectedSiteId && siteUrl && username && password;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title} — {cmsType === 'wordpress' ? 'WordPress' : 'Drupal'}</DialogTitle>
          <DialogDescription className="text-xs">
            {cmsType === 'wordpress' ? t.wpHelp : t.drupalHelp}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Site selection */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.selectSite}</Label>
            {sites.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.noSites}</p>
            ) : (
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger><SelectValue placeholder={t.selectSite} /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.domain}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Site URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.siteUrl}</Label>
            <Input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com" />
          </div>

          {/* Auth method (Drupal only shows both options) */}
          {cmsType === 'drupal' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t.authMethod}</Label>
              <Select value={authMethod} onValueChange={(v) => setAuthMethod(v as 'basic_auth' | 'oauth')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic_auth">{t.basicAuth}</SelectItem>
                  <SelectItem value="oauth">{t.oauth}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Credentials */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.username}</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{cmsType === 'wordpress' ? t.apiKey : t.password}</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 text-xs ${testResult === 'success' ? 'text-green-500' : 'text-destructive'}`}>
              {testResult === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {testResult === 'success' ? t.testSuccess : t.testFailed}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleTest} disabled={!canTest || testing}>
            {testing ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />{t.testing}</> : t.testConnection}
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />{t.saving}</> : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}