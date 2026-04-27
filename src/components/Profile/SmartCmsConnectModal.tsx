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
  Unplug,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { handleWPIntegration } from '@/utils/wpIntegration';
import { cn } from '@/lib/utils';

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
  const { language } = useLanguage();
  const lang = (language || 'fr') as Lang;

  const [step, setStep] = useState<'idle' | 'detecting' | 'recommend' | 'manual'>('idle');
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [working, setWorking] = useState(false);

  // Manual REST API form
  const [appUser, setAppUser] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [savingRest, setSavingRest] = useState(false);

  const reset = () => {
    setStep('idle');
    setDetection(null);
    setWorking(false);
    setAppUser('');
    setAppPassword('');
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
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

        {/* ─── Step idle ─── */}
        {step === 'idle' && (
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
              <Button
                onClick={() => executePath(detection.recommended)}
                disabled={working}
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
