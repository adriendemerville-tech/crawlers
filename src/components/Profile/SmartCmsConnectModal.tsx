import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Download,
  KeyRound,
  ExternalLink,
  Zap,
  RefreshCw,
  PlugZap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { handleWPIntegration } from '@/utils/wpIntegration';
import { cn } from '@/lib/utils';

// Domains routed to the custom_rest Bearer flow (cms-register-api-key edge fn).
const CUSTOM_REST_PLATFORMS: Array<{ match: (d: string) => boolean; platform: string; label: string; keyPrefix: string; keyHelpUrl?: string }> = [
  {
    match: (d) => d.toLowerCase().includes('dictadevi'),
    platform: 'dictadevi',
    label: 'Dictadevi',
    keyPrefix: 'dk_',
    keyHelpUrl: 'https://dictadevi.io/admin/blog-api',
  },
];

type Lang = 'fr' | 'en' | 'es';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  siteDomain: string;
  siteApiKey: string;
}

type Path = 'magic_link' | 'rest_api' | 'plugin_manual' | 'gtm_widget';

interface DetectionResult {
  isWordPress: boolean;
  wpVersion: string | null;
  detectedPlugins: string[];
  restOpen: boolean;
  pluginInstalled: boolean;
  wafBlocking: boolean;
  wafName?: string | null;
  recommended: Path;
  reason: string;
}

const t3 = (l: Lang, fr: string, en: string, es: string) =>
  l === 'en' ? en : l === 'es' ? es : fr;

export function SmartCmsConnectModal({
  open,
  onOpenChange,
  siteId,
  siteDomain,
  siteApiKey,
}: Props) {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { language } = useLanguage();
  const lang = (language || 'fr') as Lang;

  const customRest = CUSTOM_REST_PLATFORMS.find((p) => p.match(siteDomain)) || null;

  const [step, setStep] = useState<'idle' | 'detecting' | 'recommend' | 'manual' | 'already_connected' | 'custom_rest'>('idle');
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [working, setWorking] = useState(false);

  // Manual REST API form
  const [appUser, setAppUser] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [savingRest, setSavingRest] = useState(false);

  // Custom REST (Bearer) form — Dictadevi & co.
  const [bearerKey, setBearerKey] = useState('');
  const [savingBearer, setSavingBearer] = useState(false);
  const [adminKeyAvailable, setAdminKeyAvailable] = useState(false);

  // Existing CMS connections (loaded on open)
  const [existingConnections, setExistingConnections] = useState<
    Array<{ id: string; platform: string; status: string; managed_by: string | null; created_at: string }>
  >([]);
  const [checkingExisting, setCheckingExisting] = useState(false);

  const reset = () => {
    setStep('idle');
    setDetection(null);
    setWorking(false);
    setAppUser('');
    setAppPassword('');
    setBearerKey('');
    setExistingConnections([]);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  // ─── On open: check if a CMS connection already exists ───
  useEffect(() => {
    if (!open || !siteId) return;
    let cancelled = false;
    (async () => {
      setCheckingExisting(true);
      try {
        const { data, error } = await supabase
          .from('cms_connections')
          .select('id, platform, status, managed_by, created_at')
          .eq('tracked_site_id', siteId)
          .eq('status', 'active')
          .order('created_at', { ascending: true });
        if (cancelled) return;
        if (error) throw error;
        const rows = (data || []) as Array<{ id: string; platform: string; status: string; managed_by: string | null; created_at: string }>;
        setExistingConnections(rows);
        if (rows.length > 0) {
          setStep('already_connected');
        } else if (customRest) {
          // Domain matches a known custom_rest CMS (e.g. Dictadevi) → skip WP detection.
          setStep('custom_rest');
        }
      } catch (e) {
        console.warn('[SmartCmsConnectModal] cms_connections check failed', e);
      } finally {
        if (!cancelled) setCheckingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, siteId, customRest]);

  // ─── Probe parmenion_targets for an admin-managed key (only for admins) ───
  useEffect(() => {
    if (!open || !customRest || !isAdmin || step !== 'custom_rest') return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_parmenion_target_api_key', { p_domain: siteDomain });
        if (cancelled) return;
        if (!error && typeof data === 'string' && data.startsWith(customRest.keyPrefix)) {
          setAdminKeyAvailable(true);
        }
      } catch (_) { /* best effort */ }
    })();
    return () => { cancelled = true; };
  }, [open, customRest, isAdmin, step, siteDomain]);

  // ─── Save bearer key via cms-register-api-key edge function ───
  const saveBearerKey = async (mode: 'manual' | 'reuse_admin') => {
    if (!user || !customRest) return;
    if (mode === 'manual' && (!bearerKey || !bearerKey.startsWith(customRest.keyPrefix))) {
      toast.error(t3(
        lang,
        `La clé doit commencer par "${customRest.keyPrefix}"`,
        `Key must start with "${customRest.keyPrefix}"`,
        `La clave debe empezar con "${customRest.keyPrefix}"`,
      ));
      return;
    }
    setSavingBearer(true);
    try {
      const { data, error } = await supabase.functions.invoke('cms-register-api-key', {
        body: {
          tracked_site_id: siteId,
          platform: customRest.platform,
          mode,
          ...(mode === 'manual' ? { api_key: bearerKey } : {}),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      toast.success(t3(
        lang,
        `${customRest.label} branché — clé vérifiée et enregistrée.`,
        `${customRest.label} connected — key verified and saved.`,
        `${customRest.label} conectado — clave verificada y guardada.`,
      ));
      handleClose(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setSavingBearer(false);
    }
  };

  // ─── Step 1 — Auto-detection ───
  const runDetection = async () => {
    setStep('detecting');
    const url = `https://${siteDomain}`;

    try {
      // Cross-origin probes wrapped in safeProbe — CORS errors throw BEFORE
      // .then(), so we must catch on the fetch itself, not just the response.
      const safeProbe = (target: string) =>
        fetch(target, { mode: 'no-cors' })
          .then(() => ({ ok: true, status: 200 }))
          .catch(() => ({ ok: false, status: 0 }));

      // Use allSettled so a single failed leg never breaks the whole detection
      const results = await Promise.allSettled([
        supabase.functions.invoke('scan-wp', { body: { url } }),
        supabase.functions.invoke('diagnose-waf', { body: { url } }),
        safeProbe(`${url}/wp-json/wp/v2/`),
        safeProbe(`${url}/wp-json/crawlers/v1/`),
      ]);

      const scan = results[0].status === 'fulfilled' ? results[0].value : { data: null };
      const waf = results[1].status === 'fulfilled' ? results[1].value : { data: null };
      const restProbe = results[2].status === 'fulfilled' ? results[2].value : { ok: false, status: 0 };
      const pluginProbe = results[3].status === 'fulfilled' ? results[3].value : { ok: false, status: 0 };

      const scanData = scan.data?.data || {};
      const wafData = waf.data?.data || waf.data || {};

      const isWordPress = !!scanData.isWordPress;
      const wpVersion = scanData.wpVersion || null;
      const detectedPlugins: string[] = scanData.detectedPlugins || [];
      const restOpen = restProbe.ok;
      const pluginInstalled = pluginProbe.ok;

      // WAF detection
      const wafName: string | null =
        wafData?.detectedWaf ||
        wafData?.waf ||
        (wafData?.verdict?.waf as string) ||
        null;
      const wafBlocking =
        !restOpen &&
        (wafName !== null ||
          (wafData?.verdict?.blocking === true) ||
          (Array.isArray(wafData?.recommendations) &&
            wafData.recommendations.some((r: string) =>
              /waf|whitelist|block|cloudflare|sucuri/i.test(r),
            )));

      // Decision tree
      let recommended: Path;
      let reason: string;

      if (!isWordPress) {
        recommended = 'gtm_widget';
        reason = t3(
          lang,
          'WordPress non détecté. Le widget GTM/script léger est compatible avec tous les CMS.',
          'WordPress not detected. The GTM/script widget works with all CMS.',
          'WordPress no detectado. El widget GTM/script es compatible con todos los CMS.',
        );
      } else if (pluginInstalled) {
        recommended = 'magic_link';
        reason = t3(
          lang,
          'Plugin Crawlers déjà installé — connexion en 1 clic via Magic Link.',
          'Crawlers plugin already installed — 1-click connection via Magic Link.',
          'Plugin Crawlers ya instalado — conexión de 1 clic vía Magic Link.',
        );
      } else if (restOpen && !wafBlocking) {
        recommended = 'rest_api';
        reason = t3(
          lang,
          'API REST WordPress accessible. Connectez-vous avec un Application Password (2 minutes).',
          'WordPress REST API accessible. Connect with an Application Password (2 minutes).',
          'API REST WordPress accesible. Conéctese con una Application Password (2 minutos).',
        );
      } else if (wafBlocking) {
        recommended = 'plugin_manual';
        reason = t3(
          lang,
          `Pare-feu détecté${wafName ? ` (${wafName})` : ''} bloquant l'API. Installation du plugin requise.`,
          `Firewall detected${wafName ? ` (${wafName})` : ''} blocking the API. Plugin install required.`,
          `Firewall detectado${wafName ? ` (${wafName})` : ''} bloqueando la API. Se requiere instalar el plugin.`,
        );
      } else {
        recommended = 'plugin_manual';
        reason = t3(
          lang,
          'API REST inaccessible. Installation du plugin recommandée.',
          'REST API not accessible. Plugin install recommended.',
          'API REST no accesible. Se recomienda instalar el plugin.',
        );
      }

      setDetection({
        isWordPress,
        wpVersion,
        detectedPlugins,
        restOpen,
        pluginInstalled,
        wafBlocking,
        wafName,
        recommended,
        reason,
      });
      setStep('recommend');
    } catch (e: any) {
      toast.error(
        t3(lang, 'Détection impossible', 'Detection failed', 'Detección imposible'),
      );
      console.error(e);
      setStep('idle');
    }
  };

  // ─── Step 2 — Execute recommended path ───
  const executePath = async (path: Path) => {
    setWorking(true);
    try {
      if (path === 'magic_link') {
        // Garde-fou : Magic Link nécessite le plugin Crawlers côté WordPress
        if (detection && !detection.pluginInstalled) {
          toast.error(
            t3(
              lang,
              'Le plugin Crawlers n\'est pas encore installé sur ce site. Téléchargez-le et activez-le dans WordPress avant d\'utiliser le Magic Link.',
              'The Crawlers plugin is not installed on this site yet. Download and activate it in WordPress before using Magic Link.',
              'El plugin Crawlers aún no está instalado en este sitio. Descárguelo y actívelo en WordPress antes de usar el Magic Link.',
            ),
            { duration: 8000 },
          );
          setWorking(false);
          return;
        }
        await handleWPIntegration('magic_link', {
          siteId,
          domain: siteDomain,
          apiKey: siteApiKey,
          userId: user?.id,
          language: lang,
        });
        handleClose(false);
      } else if (path === 'plugin_manual') {
        await handleWPIntegration('download', {
          siteId,
          domain: siteDomain,
          apiKey: siteApiKey,
          userId: user?.id,
          language: lang,
        });
        // Stay open so user can chain with magic link after install
      } else if (path === 'rest_api') {
        setStep('manual');
      } else if (path === 'gtm_widget') {
        const snippet = `<script async src="https://crawlers.fr/widget.js" data-key="${siteApiKey}"></script>`;
        await navigator.clipboard.writeText(snippet);
        toast.success(
          t3(
            lang,
            'Snippet GTM copié — collez-le dans <head> de votre site.',
            'GTM snippet copied — paste in your site <head>.',
            'Snippet GTM copiado — péguelo en el <head> de su sitio.',
          ),
        );
      }
    } finally {
      setWorking(false);
    }
  };

  // ─── Step 3 — Save REST API credentials ───
  const saveRestApi = async () => {
    if (!user || !appUser || !appPassword) return;
    setSavingRest(true);
    try {
      // Test first
      const test = await supabase.functions.invoke('wpsync', {
        body: {
          action: 'test-connection',
          site_url: `https://${siteDomain}`,
          auth_method: 'basic_auth',
          basic_user: appUser,
          basic_pass: appPassword,
        },
      });

      const ok = test.data?.success || test.data?.status === 'ok';
      if (!ok) {
        toast.error(
          test.data?.error ||
            t3(
              lang,
              'Identifiants invalides',
              'Invalid credentials',
              'Credenciales inválidas',
            ),
        );
        return;
      }

      const { error } = await supabase.from('cms_connections').upsert(
        {
          user_id: user.id,
          tracked_site_id: siteId,
          platform: 'wordpress',
          site_url: `https://${siteDomain}`,
          auth_method: 'basic_auth',
          basic_auth_user: appUser,
          basic_auth_pass: appPassword,
          status: 'active',
        } as any,
        { onConflict: 'tracked_site_id,platform' },
      );

      if (error) throw error;

      toast.success(
        t3(lang, 'CMS branché avec succès', 'CMS connected', 'CMS conectado'),
      );
      handleClose(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingRest(false);
    }
  };

  // ─── UI ───
  const pathLabels: Record<Path, { title: string; cta: string; icon: any }> = {
    magic_link: {
      title: t3(lang, 'Magic Link', 'Magic Link', 'Magic Link'),
      cta: t3(lang, 'Brancher en 1 clic', '1-click connect', 'Conectar en 1 clic'),
      icon: Zap,
    },
    rest_api: {
      title: t3(lang, 'API REST WordPress', 'WordPress REST API', 'API REST WordPress'),
      cta: t3(lang, 'Saisir mes identifiants', 'Enter credentials', 'Ingresar credenciales'),
      icon: KeyRound,
    },
    plugin_manual: {
      title: t3(lang, 'Plugin WordPress', 'WordPress Plugin', 'Plugin WordPress'),
      cta: t3(lang, 'Télécharger le plugin', 'Download plugin', 'Descargar plugin'),
      icon: Download,
    },
    gtm_widget: {
      title: t3(lang, 'Widget GTM / Script', 'GTM / Script Widget', 'Widget GTM / Script'),
      cta: t3(lang, 'Copier le snippet', 'Copy snippet', 'Copiar snippet'),
      icon: ExternalLink,
    },
  };

  const allPaths: Path[] = ['magic_link', 'rest_api', 'plugin_manual', 'gtm_widget'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            {t3(lang, 'Brancher mon CMS', 'Connect my CMS', 'Conectar mi CMS')}
          </DialogTitle>
          <DialogDescription>
            {siteDomain}
            {detection?.wpVersion && (
              <Badge variant="outline" className="ml-2">
                WP {detection.wpVersion}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Checking existing ─── */}
        {checkingExisting && step === 'idle' && (
          <div className="space-y-3 py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {t3(lang, 'Vérification des connexions existantes…', 'Checking existing connections…', 'Comprobando conexiones existentes…')}
            </p>
          </div>
        )}

        {/* ─── Step already_connected ─── */}
        {step === 'already_connected' && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <PlugZap className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {t3(
                    lang,
                    `CMS déjà branché (${existingConnections.length} canal${existingConnections.length > 1 ? 'aux' : ''} actif${existingConnections.length > 1 ? 's' : ''})`,
                    `CMS already connected (${existingConnections.length} active channel${existingConnections.length > 1 ? 's' : ''})`,
                    `CMS ya conectado (${existingConnections.length} canal${existingConnections.length > 1 ? 'es' : ''} activo${existingConnections.length > 1 ? 's' : ''})`,
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t3(
                  lang,
                  "L'édition et la publication d'articles sont actives. Inutile de coller le widget.js dans GTM — celui-ci ne sert qu'au tracking, pas à l'écriture CMS.",
                  'Editing and publishing are active. No need to paste widget.js in GTM — that script is only for tracking, not CMS write access.',
                  'La edición y publicación están activas. No es necesario pegar widget.js en GTM — ese script solo sirve para tracking, no para escritura en el CMS.',
                )}
              </p>
              <div className="space-y-1.5 pt-1">
                {existingConnections.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded border border-emerald-500/20 bg-background"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-medium">{c.platform}</span>
                      {c.managed_by && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {c.managed_by}
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {t3(
                  lang,
                  'Vous voulez ajouter un canal supplémentaire (ex: tracking widget pour analytics) ?',
                  'Want to add an additional channel (e.g. tracking widget for analytics)?',
                  '¿Desea añadir un canal adicional (ej: widget de tracking para analytics)?',
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setStep('idle');
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {t3(lang, 'Ajouter un autre canal', 'Add another channel', 'Añadir otro canal')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleClose(false)}
                >
                  {t3(lang, 'Fermer', 'Close', 'Cerrar')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step custom_rest (Bearer dk_… for Dictadevi & co.) ─── */}
        {step === 'custom_rest' && customRest && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {t3(lang, `Brancher ${customRest.label} (API REST)`, `Connect ${customRest.label} (REST API)`, `Conectar ${customRest.label} (API REST)`)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t3(
                  lang,
                  `Collez votre clé API ${customRest.label} (préfixe « ${customRest.keyPrefix} »). Elle sera testée auprès de l'API puis enregistrée chiffrée côté serveur.`,
                  `Paste your ${customRest.label} API key (prefix "${customRest.keyPrefix}"). It will be tested against the API and stored server-side.`,
                  `Pegue su clave API ${customRest.label} (prefijo "${customRest.keyPrefix}"). Será probada y almacenada en el servidor.`,
                )}
              </p>
              {customRest.keyHelpUrl && (
                <a
                  href={customRest.keyHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t3(lang, 'Générer une clé', 'Generate a key', 'Generar una clave')}
                </a>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bearer-key">
                {t3(lang, 'Clé API', 'API key', 'Clave API')} ({customRest.keyPrefix}…)
              </Label>
              <Input
                id="bearer-key"
                type="password"
                value={bearerKey}
                onChange={(e) => setBearerKey(e.target.value)}
                placeholder={`${customRest.keyPrefix}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
                autoComplete="off"
              />
            </div>

            {isAdmin && adminKeyAvailable && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {t3(
                    lang,
                    'Clé admin déjà présente côté autopilote — vous pouvez la réutiliser pour ce compte.',
                    'Admin key already stored for the autopilot — you can reuse it on this account.',
                    'Clave admin ya almacenada para el autopiloto — puede reutilizarla en esta cuenta.',
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => saveBearerKey('reuse_admin')}
                  disabled={savingBearer}
                >
                  {savingBearer && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <PlugZap className="h-3.5 w-3.5" />
                  {t3(lang, 'Utiliser la clé existante (admin)', 'Use existing admin key', 'Usar clave admin existente')}
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('idle')}
                className="flex-1"
              >
                {t3(lang, 'Autres méthodes', 'Other methods', 'Otros métodos')}
              </Button>
              <Button
                variant="outline"
                onClick={() => saveBearerKey('manual')}
                disabled={!bearerKey || savingBearer}
                className="flex-1 gap-2"
              >
                {savingBearer && <Loader2 className="h-4 w-4 animate-spin" />}
                {t3(lang, 'Tester & enregistrer', 'Test & save', 'Probar y guardar')}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step idle ─── */}
        {step === 'idle' && !checkingExisting && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t3(
                lang,
                "L'assistant détecte votre CMS, teste l'API, identifie les pare-feux et choisit la voie de connexion la plus rapide.",
                'The wizard detects your CMS, tests the API, identifies firewalls and picks the fastest connection path.',
                'El asistente detecta su CMS, prueba la API, identifica firewalls y elige la vía de conexión más rápida.',
              )}
            </p>
            <Button
              onClick={runDetection}
              variant="outline"
              className="w-full gap-2 h-11"
            >
              <Wand2 className="h-4 w-4" />
              {t3(
                lang,
                'Lancer la détection automatique',
                'Run auto-detection',
                'Iniciar detección automática',
              )}
            </Button>
          </div>
        )}

        {/* ─── Step detecting ─── */}
        {step === 'detecting' && (
          <div className="space-y-3 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t3(
                lang,
                'Analyse du site, des en-têtes HTTP, du WAF et de l\'API REST…',
                'Analyzing site, HTTP headers, WAF and REST API…',
                'Analizando sitio, encabezados HTTP, WAF y API REST…',
              )}
            </p>
          </div>
        )}

        {/* ─── Step recommend ─── */}
        {step === 'recommend' && detection && (
          <div className="space-y-4 py-2">
            {/* Detection summary */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <DetectionRow
                label="WordPress"
                ok={detection.isWordPress}
                detail={detection.wpVersion || undefined}
              />
              <DetectionRow
                label={t3(lang, 'API REST', 'REST API', 'API REST')}
                ok={detection.restOpen}
              />
              <DetectionRow
                label={t3(lang, 'Plugin Crawlers', 'Crawlers plugin', 'Plugin Crawlers')}
                ok={detection.pluginInstalled}
              />
              <DetectionRow
                label="WAF"
                ok={!detection.wafBlocking}
                detail={detection.wafName || undefined}
                invertWarn
              />
            </div>

            {/* Recommendation */}
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {t3(lang, 'Voie recommandée', 'Recommended path', 'Vía recomendada')}{' '}
                  : {pathLabels[detection.recommended].title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{detection.reason}</p>
              {detection.recommended === 'magic_link' && !detection.pluginInstalled && (
                <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                  {t3(
                    lang,
                    '⚠ Le plugin Crawlers doit être installé et activé sur WordPress avant d\'utiliser le Magic Link. Utilisez d\'abord « Télécharger le plugin ».',
                    '⚠ The Crawlers plugin must be installed and activated on WordPress before using Magic Link. Use "Download plugin" first.',
                    '⚠ El plugin Crawlers debe estar instalado y activado en WordPress antes de usar el Magic Link. Use primero "Descargar plugin".',
                  )}
                </div>
              )}
              <Button
                onClick={() => executePath(detection.recommended)}
                disabled={working || (detection.recommended === 'magic_link' && !detection.pluginInstalled)}
                variant="outline"
                className="w-full gap-2 mt-2"
              >
                {working ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {pathLabels[detection.recommended].cta}
              </Button>
            </div>

            {/* Alternative paths */}
            <Separator />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {t3(
                  lang,
                  'Voir les autres méthodes',
                  'Show other methods',
                  'Ver otros métodos',
                )}
              </summary>
              <div className="grid gap-2 mt-3">
                {allPaths
                  .filter((p) => p !== detection.recommended)
                  .map((p) => {
                    const meta = pathLabels[p];
                    const Icon = meta.icon;
                    return (
                      <Button
                        key={p}
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2"
                        onClick={() => executePath(p)}
                        disabled={working}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs">
                          {meta.title} — {meta.cta}
                        </span>
                      </Button>
                    );
                  })}
              </div>
            </details>

            <Button
              variant="ghost"
              size="sm"
              onClick={runDetection}
              className="w-full gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t3(lang, 'Relancer la détection', 'Re-run detection', 'Reiniciar detección')}
            </Button>
          </div>
        )}

        {/* ─── Step manual REST API ─── */}
        {step === 'manual' && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">
                {t3(
                  lang,
                  'Comment obtenir un Application Password ?',
                  'How to get an Application Password?',
                  '¿Cómo obtener una Application Password?',
                )}
              </p>
              <p>
                WP Admin → {t3(lang, 'Utilisateurs', 'Users', 'Usuarios')} →{' '}
                {t3(lang, 'Profil', 'Profile', 'Perfil')} →{' '}
                {t3(
                  lang,
                  "Mots de passe d'application",
                  'Application Passwords',
                  'Contraseñas de aplicación',
                )}
              </p>
              <a
                href={`https://${siteDomain}/wp-admin/profile.php#application-passwords-section`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t3(lang, 'Ouvrir mon WP Admin', 'Open my WP Admin', 'Abrir mi WP Admin')}
              </a>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wp-user">
                {t3(lang, "Nom d'utilisateur WP", 'WP Username', 'Nombre de usuario WP')}
              </Label>
              <Input
                id="wp-user"
                value={appUser}
                onChange={(e) => setAppUser(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wp-pass">Application Password</Label>
              <Input
                id="wp-pass"
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('recommend')}
                className="flex-1"
              >
                {t3(lang, 'Retour', 'Back', 'Atrás')}
              </Button>
              <Button
                variant="outline"
                onClick={saveRestApi}
                disabled={!appUser || !appPassword || savingRest}
                className="flex-1 gap-2"
              >
                {savingRest && <Loader2 className="h-4 w-4 animate-spin" />}
                {t3(lang, 'Tester & enregistrer', 'Test & save', 'Probar y guardar')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetectionRow({
  label,
  ok,
  detail,
  invertWarn,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  invertWarn?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded border',
        ok
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : invertWarn
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-muted bg-muted/20',
      )}
    >
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
      ) : invertWarn ? (
        <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="font-medium">{label}</span>
      {detail && <span className="text-muted-foreground ml-auto">{detail}</span>}
    </div>
  );
}
