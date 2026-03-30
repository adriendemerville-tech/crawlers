import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExternalLink, Loader2, ShieldCheck, CheckCircle2, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CmsConnectionDialog } from './CmsConnectionDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const translations = {
  fr: {
    title: 'API Externes',
    description: 'Connectez vos services tiers pour automatiser les actions SEO.',
    analyticsTitle: 'Analytics & Search',
    cmsTitle: 'CMS — Connexion API REST',
    seoToolsTitle: 'Outils SEO WordPress',
    seoToolsDesc: 'Connectez vos plugins SEO WordPress pour piloter les optimisations directement depuis Crawlers.',
    comingSoon: 'Bientôt',
    connected: 'Connecté',
    configure: 'Configurer',
    connecting: 'Connexion…',
    rankMathTitle: 'Connecter Rank Math',
    rankMathDesc: 'Autorisez Crawlers.fr à envoyer des instructions SEO directement dans Rank Math sur votre site WordPress : meta titles, meta descriptions, focus keywords, canonical URLs.',
    rankMathPermissions: 'Permissions demandées :',
    rankMathPerm1: 'Lecture des meta SEO Rank Math (title, description, focus keyword, score)',
    rankMathPerm2: 'Écriture des meta SEO Rank Math (title, description, focus keyword, canonical)',
    rankMathPerm3: 'Lecture en masse des scores SEO de vos pages',
    rankMathRequires: 'Prérequis : connexion WordPress active avec le plugin Rank Math installé.',
    authorize: 'Autoriser la connexion',
    noWpConnection: 'Aucune connexion WordPress active trouvée. Connectez d\'abord WordPress dans la section CMS ci-dessus.',
    rankMathSuccess: 'Rank Math connecté ! Crawlers peut maintenant piloter vos meta SEO.',
    rankMathError: 'Erreur de connexion Rank Math. Vérifiez que le plugin est bien installé.',
  },
  en: {
    title: 'External APIs',
    description: 'Connect your third-party services to automate SEO actions.',
    analyticsTitle: 'Analytics & Search',
    cmsTitle: 'CMS — REST API Connection',
    seoToolsTitle: 'WordPress SEO Tools',
    seoToolsDesc: 'Connect your WordPress SEO plugins to manage optimizations directly from Crawlers.',
    comingSoon: 'Coming soon',
    connected: 'Connected',
    configure: 'Configure',
    connecting: 'Connecting…',
    rankMathTitle: 'Connect Rank Math',
    rankMathDesc: 'Authorize Crawlers.fr to send SEO instructions directly to Rank Math on your WordPress site: meta titles, meta descriptions, focus keywords, canonical URLs.',
    rankMathPermissions: 'Requested permissions:',
    rankMathPerm1: 'Read Rank Math SEO meta (title, description, focus keyword, score)',
    rankMathPerm2: 'Write Rank Math SEO meta (title, description, focus keyword, canonical)',
    rankMathPerm3: 'Bulk read SEO scores for your pages',
    rankMathRequires: 'Prerequisite: active WordPress connection with Rank Math plugin installed.',
    authorize: 'Authorize connection',
    noWpConnection: 'No active WordPress connection found. Connect WordPress first in the CMS section above.',
    rankMathSuccess: 'Rank Math connected! Crawlers can now manage your SEO meta.',
    rankMathError: 'Rank Math connection error. Verify the plugin is installed.',
  },
  es: {
    title: 'APIs Externas',
    description: 'Conecte sus servicios de terceros para automatizar acciones SEO.',
    analyticsTitle: 'Analítica y búsqueda',
    cmsTitle: 'CMS — Conexión API REST',
    seoToolsTitle: 'Herramientas SEO WordPress',
    seoToolsDesc: 'Conecte sus plugins SEO de WordPress para gestionar optimizaciones directamente desde Crawlers.',
    comingSoon: 'Próximamente',
    connected: 'Conectado',
    configure: 'Configurar',
    connecting: 'Conectando…',
    rankMathTitle: 'Conectar Rank Math',
    rankMathDesc: 'Autorice a Crawlers.fr a enviar instrucciones SEO directamente a Rank Math en su sitio WordPress.',
    rankMathPermissions: 'Permisos solicitados:',
    rankMathPerm1: 'Lectura de meta SEO Rank Math (title, description, focus keyword, score)',
    rankMathPerm2: 'Escritura de meta SEO Rank Math (title, description, focus keyword, canonical)',
    rankMathPerm3: 'Lectura masiva de scores SEO de sus páginas',
    rankMathRequires: 'Requisito: conexión WordPress activa con el plugin Rank Math instalado.',
    authorize: 'Autorizar conexión',
    noWpConnection: 'No se encontró conexión WordPress activa. Conecte WordPress primero en la sección CMS arriba.',
    rankMathSuccess: '¡Rank Math conectado! Crawlers ahora puede gestionar sus meta SEO.',
    rankMathError: 'Error de conexión Rank Math. Verifique que el plugin está instalado.',
  },
};

interface ServiceButton {
  id: string;
  name: string;
  logoSvg: string;
  available: boolean;
  category: 'analytics' | 'cms' | 'self_hosted';
}

const services: ServiceButton[] = [
  {
    id: 'gsc', name: 'Google Search Console', category: 'analytics', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`,
  },
  {
    id: 'ga4', name: 'Google Analytics 4', category: 'analytics', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#F9AB00" d="M20.17 2.88a3.12 3.12 0 00-4.41 0l-2.62 2.62a3.12 3.12 0 000 4.41l.8.8a3.12 3.12 0 004.41 0l2.62-2.62a3.12 3.12 0 000-4.41l-.8-.8z"/><path fill="#E37400" d="M12.94 10.11l-.8-.8a3.12 3.12 0 00-4.41 0L5.11 11.93a3.12 3.12 0 000 4.41l.8.8a3.12 3.12 0 004.41 0l2.62-2.62a3.12 3.12 0 000-4.41z"/><circle fill="#E37400" cx="6.5" cy="19.5" r="2.5"/></svg>`,
  },
  {
    id: 'google-ads', name: 'Google Ads', category: 'analytics', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#FBBC04" d="M3.2 15.3l4.9-8.5c.6-1 1.9-1.4 2.9-.8l4.9 2.8c1 .6 1.4 1.9.8 2.9l-4.9 8.5c-.6 1-1.9 1.4-2.9.8L4 18.2c-1-.6-1.4-1.9-.8-2.9z"/><path fill="#4285F4" d="M12.9 9.7l4.9-8.5c.6-1 1.9-1.4 2.9-.8.5.3.8.7 1 1.2.1.5.1 1-.2 1.5L16.6 12c-.3-.4-.6-.7-1-.9l-2.7-1.4z"/><circle fill="#34A853" cx="5.5" cy="19.5" r="3"/></svg>`,
  },
  {
    id: 'gmb', name: 'Google My Business', category: 'analytics', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#4285F4" d="M22 12l-4-4v3H8V8l-4 4 4 4v-3h10v3z"/><path fill="#34A853" d="M12 22c5.523 0 10-4.477 10-10h-4a6 6 0 01-6 6v4z"/><path fill="#FBBC05" d="M2 12c0 5.523 4.477 10 10 10v-4a6 6 0 01-6-6H2z"/><path fill="#EA4335" d="M12 2C6.477 2 2 6.477 2 12h4a6 6 0 016-6V2z"/><path fill="#4285F4" d="M22 12c0-5.523-4.477-10-10-10v4a6 6 0 016 6h4z"/></svg>`,
  },
  {
    id: 'matomo', name: 'Matomo', category: 'self_hosted' as const, available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#3152A0" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 14.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-4.5-3c-.83 0-1.5-.67-1.5-1.5S11.17 10.5 12 10.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-4.5-3C6.67 10.5 6 9.83 6 9s.67-1.5 1.5-1.5S9 8.17 9 9s-.67 1.5-1.5 1.5z"/></svg>`,
  },

    id: 'wordpress', name: 'WordPress', category: 'cms', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#21759B" d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm-1.246 15.172L6.25 7.588A8.033 8.033 0 0112 4.028c1.676 0 3.234.514 4.524 1.392l-.532.472A7.963 7.963 0 0012 4.028c-1.907 0-3.657.67-5.032 1.784l4.77 13.846L12 19.44l-.754.268-.492-.536zM12 20c-1.34 0-2.608-.33-3.72-.912l3.952-11.476 4.048 11.09A8.002 8.002 0 0112 20zm7.2-8c0 1.39-.357 2.698-.984 3.838l-3.65-9.99A7.966 7.966 0 0119.2 12z"/></svg>`,
  },
  {
    id: 'shopify', name: 'Shopify', category: 'cms', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#96BF48" d="M15.337 3.318s-.266-.07-.578-.109a6.3 6.3 0 00-.586-.04l-.806-1.255c-.18-.29-.53-.386-.742-.386H12.5s-.104-.014-.16 0c-.048-.07-.12-.146-.22-.21-.332-.216-.74-.32-1.15-.316-.076 0-.15.004-.226.012a.744.744 0 00-.134-.158C10.236.54 9.738.388 9.16.486c-1.218.208-2.434 1.568-3.378 3.758-.664 1.54-.97 2.762-1.086 3.484-.898.278-1.526.472-1.536.476-.452.142-.466.156-.524.584C2.596 9.086.5 22.456.5 22.456l12.266 2.116V3.318h2.57zm-3.816-.972c-.494.154-1.032.32-1.59.494.306-1.176.884-2.368 1.59-3.148v2.654z"/><path fill="#5E8E3E" d="M12.766 3.318v21.254L21.5 22.5s-3.672-12.29-3.726-12.484c-.054-.194-.14-.286-.14-.286s-.378-.088-.826-.176a9.987 9.987 0 00-.376-.07l-.806-1.255c-.18-.29-.53-.386-.742-.386h-.118s-.104-.014-.16 0c.044.03.08.062.12.1.068.064.134.15.186.258L15.337 3.318h-2.57z"/></svg>`,
  },
  {
    id: 'webflow', name: 'Webflow', category: 'cms', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#4353FF" d="M17.802 8.712s-2.596 7.956-2.746 8.436c-.02-.518-.982-8.436-.982-8.436A4.672 4.672 0 009.7 5.148s2.796 8.756 2.972 9.324c.202.652.354 1.384.354 1.892 0 .276-.024.508-.068.692A4.65 4.65 0 008.5 20.86l4.416-13.824a4.584 4.584 0 014.492-3.524c.08 0 .158.004.236.008l-4.498 14.072s.976-.028 1.458-.028a4.558 4.558 0 004.058-2.468l3.338-10.16c-.266-.034-.54-.052-.818-.052a4.58 4.58 0 00-3.38 1.828z"/></svg>`,
  },
  {
    id: 'drupal', name: 'Drupal', category: 'cms', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#0678BE" d="M12 2c-.7.7-1.6 1.2-2.5 1.7C8.3 4.5 7 5.2 5.8 6.4 3.5 8.8 2 12.2 2 15.3 2 19.6 6.5 23 12 23s10-3.4 10-7.7c0-3.1-1.5-6.5-3.8-8.9-1.2-1.2-2.5-1.9-3.7-2.7C13.6 3.2 12.7 2.7 12 2zm-.2 4.3c.4.4 1 .8 1.6 1.1 1 .6 2.1 1.3 3 2.2 1.8 1.9 2.9 4.5 2.9 6.7 0 3.2-3.4 5.8-7.3 5.8S4.7 19.5 4.7 16.3c0-2.2 1.1-4.8 2.9-6.7.9-.9 2-1.6 3-2.2.6-.3 1.2-.7 1.6-1.1h-.4zm-4 9.5c-.4 0-.7.3-.7.7s.3.7.7.7.7-.3.7-.7-.3-.7-.7-.7z"/></svg>`,
  },
  {
    id: 'wix', name: 'Wix', category: 'cms', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#0C6EFC" d="M4.206 7.092c-.488.36-.702 1.146-.702 1.146L1.5 16.908l-.996-4.836s-.186-1.05-.666-1.524c-.378-.372-.762-.504-.762-.504s.312-.246.81-.246c.498 0 .852.258 1.134.684.216.33.414.888.414.888l1.176 5.388 2.1-6.87s.282-.786.762-1.11c.366-.246.738-.282.738-.282s-.072.126-.072.408c0 .282.186.834.186.834l1.596 5.004L9.894 8.28s.204-.762.69-1.11c.372-.264.756-.294.756-.294s-.084.15-.084.444c0 .282.216.9.216.9l2.316 8.688 2.004-6.666s.18-.684.618-1.032c.438-.348.864-.414.864-.414s-.204.204-.204.546c0 .258.12.642.12.642L18.51 16.9l1.818-5.76s.258-.93.756-1.314c.498-.384 1.068-.444 1.068-.444s-.264.246-.264.636c0 .39.138.786.138.786l1.974 6.102-1.98-2.424-.912 2.424-1.776-5.958-1.962 6.54-2.61-9.018-1.914 6.372-2.64-8.73z"/></svg>`,
  },
  {
    id: 'odoo', name: 'Odoo', category: 'cms', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#714B67" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
  },
  {
    id: 'prestashop', name: 'PrestaShop', category: 'cms', available: true,
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#DF0067" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.5 14.5h-7v-2h7v2zm1-4h-9v-2h9v2zm0-4h-9v-2h9v2z"/></svg>`,
  },
];

const RANK_MATH_LOGO = `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#E44B36" d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.18L18.82 7.5 12 10.82 5.18 7.5 12 4.18zM5 8.82l6 3.33v7.03l-6-3.33V8.82zm8 10.36v-7.03l6-3.33v7.03l-6 3.33z"/></svg>`;

export function ExternalApisTab() {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [cmsDialogOpen, setCmsDialogOpen] = useState(false);
  const [cmsDialogType, setCmsDialogType] = useState<'wordpress' | 'drupal' | 'shopify' | 'webflow' | 'wix' | 'odoo' | 'prestashop'>('wordpress');
  const [rankMathDialogOpen, setRankMathDialogOpen] = useState(false);
  const [rankMathLoading, setRankMathLoading] = useState(false);
  const [wpConnection, setWpConnection] = useState<{ id: string; site_url: string } | null>(null);
  const [rankMathConnected, setRankMathConnected] = useState(false);
  const [fullGoogleAccess, setFullGoogleAccess] = useState(false);

  useEffect(() => {
    const checkWpConnection = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('cms_connections')
        .select('id, site_url, capabilities')
        .eq('user_id', user.id)
        .eq('platform', 'wordpress')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (data) {
        setWpConnection({ id: data.id, site_url: data.site_url });
        const caps = data.capabilities as Record<string, unknown> | null;
        if (caps?.rankmath_authorized) setRankMathConnected(true);
      }
    };
    checkWpConnection();
  }, [cmsDialogOpen]);

  // Check if full Google access is enabled (admin toggle)
  useEffect(() => {
    const checkGoogleAccess = async () => {
      const { data } = await (supabase as any)
        .from('system_config')
        .select('value')
        .eq('config_key', 'full_google_access_auth')
        .maybeSingle();
      if (data?.value && typeof data.value === 'object' && data.value.active === true) {
        setFullGoogleAccess(true);
      }
    };
    checkGoogleAccess();
  }, []);

  // Filter analytics services: Google Ads only visible when full access is on
  // GA4 and GMB use gsc-auth which handles scopes server-side, so always show them
  const analyticsServices = services.filter(s => {
    if (s.category !== 'analytics') return false;
    if (s.id === 'google-ads' && !fullGoogleAccess) return false;
    return true;
  });
  const cmsServices = services.filter(s => s.category === 'cms');

  const handleServiceClick = async (service: ServiceButton) => {
    if (!service.available || connectingId) return;

    if (service.id === 'gsc' || service.id === 'ga4') {
      setConnectingId(service.id);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.functions.invoke('gsc-auth', {
          body: { action: 'login', user_id: user?.id, frontend_origin: window.location.origin },
        });
        if (error) throw error;
        if (data?.auth_url) window.location.href = data.auth_url;
        else throw new Error('No auth URL returned');
      } catch (err) {
        console.error(`[ExternalApis] ${service.id} auth error:`, err);
        toast.error(language === 'fr' ? 'Erreur de connexion' : language === 'es' ? 'Error de conexión' : 'Connection error');
      } finally {
        setConnectingId(null);
      }
      return;
    }

    if (service.id === 'google-ads') {
      setConnectingId(service.id);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.functions.invoke('google-ads-connector', {
          body: { action: 'login', user_id: user?.id, frontend_origin: window.location.origin },
        });
        if (error) throw error;
        if (data?.auth_url) window.location.href = data.auth_url;
        else throw new Error('No auth URL returned');
      } catch (err) {
        console.error('[ExternalApis] Google Ads auth error:', err);
        toast.error(language === 'fr' ? 'Erreur de connexion Google Ads' : language === 'es' ? 'Error de conexión Google Ads' : 'Google Ads connection error');
      } finally {
        setConnectingId(null);
      }
      return;
    }

    if (service.id === 'gmb') {
      setConnectingId(service.id);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.functions.invoke('gsc-auth', {
          body: { action: 'login', user_id: user?.id, frontend_origin: window.location.origin },
        });
        if (error) throw error;
        if (data?.auth_url) window.location.href = data.auth_url;
        else throw new Error('No auth URL returned');
      } catch (err) {
        console.error('[ExternalApis] GMB auth error:', err);
        toast.error(language === 'fr' ? 'Erreur de connexion GMB' : language === 'es' ? 'Error de conexión GMB' : 'GMB connection error');
      } finally {
        setConnectingId(null);
      }
      return;
    }

    if (['wordpress', 'drupal', 'shopify', 'webflow', 'wix', 'odoo', 'prestashop'].includes(service.id)) {
      setCmsDialogType(service.id as 'wordpress' | 'drupal' | 'shopify' | 'webflow' | 'wix' | 'odoo' | 'prestashop');
      setCmsDialogOpen(true);
    }
  };

  const handleRankMathAuthorize = async () => {
    if (!wpConnection) return;
    setRankMathLoading(true);
    try {
      // Step 1: Test Rank Math access via WordPress REST API
      const { data, error } = await supabase.functions.invoke('rankmath-actions', {
        body: {
          action: 'bulk-get-seo',
          connection_id: wpConnection.id,
          post_type: 'posts',
          per_page: 1,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Rank Math inaccessible');

      // Step 2: Persist authorization in cms_connections.capabilities
      const { data: conn } = await supabase
        .from('cms_connections')
        .select('capabilities')
        .eq('id', wpConnection.id)
        .maybeSingle();

      const currentCaps = (conn?.capabilities as Record<string, unknown>) || {};
      await supabase
        .from('cms_connections')
        .update({
          capabilities: {
            ...currentCaps,
            rankmath_authorized: true,
            rankmath_authorized_at: new Date().toISOString(),
            rankmath_permissions: ['read_meta', 'write_meta', 'bulk_read'],
          } as any,
        })
        .eq('id', wpConnection.id);

      setRankMathConnected(true);
      toast.success(t.rankMathSuccess);
      setRankMathDialogOpen(false);
    } catch (err) {
      console.error('[ExternalApis] Rank Math authorization error:', err);
      toast.error(t.rankMathError);
    } finally {
      setRankMathLoading(false);
    }
  };

  const renderServiceCard = (service: ServiceButton) => {
    const isConnecting = connectingId === service.id;
    return (
      <button
        key={service.id}
        disabled={!service.available || isConnecting}
        onClick={() => handleServiceClick(service)}
        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left w-full ${
          service.available
            ? 'border-border hover:border-violet-500/40 hover:bg-violet-500/5 cursor-pointer'
            : 'border-border/50 opacity-50 cursor-not-allowed'
        }`}
      >
        <div
          className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0"
          dangerouslySetInnerHTML={{ __html: service.logoSvg }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{service.name}</span>
            {!service.available && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-muted-foreground/30">
                {t.comingSoon}
              </Badge>
            )}
          </div>
          {service.available && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              {isConnecting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t.connecting}
                </>
              ) : (
                <>
                  <ExternalLink className="w-3 h-3" />
                  {t.configure}
                </>
              )}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6 pt-4">
      <div>
        <h3 className="text-lg font-semibold">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>

      {/* Analytics & Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.analyticsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {analyticsServices.map(renderServiceCard)}
          </div>
        </CardContent>
      </Card>

      {/* CMS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.cmsTitle}</CardTitle>
          <CardDescription className="text-xs">
            {language === 'fr'
              ? 'Connectez votre CMS pour automatiser les corrections SEO, le maillage interne et les redirections.'
              : language === 'es'
                ? 'Conecte su CMS para automatizar las correcciones SEO, el enlazado interno y las redirecciones.'
                : 'Connect your CMS to automate SEO fixes, internal linking and redirections.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cmsServices.map(renderServiceCard)}
          </div>
        </CardContent>
      </Card>

      {/* SEO Tools — Rank Math */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.seoToolsTitle}</CardTitle>
          <CardDescription className="text-xs">{t.seoToolsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setRankMathDialogOpen(true)}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left w-full ${
                rankMathConnected
                  ? 'border-green-500/40 bg-green-500/5'
                  : 'border-border hover:border-amber-500/40 hover:bg-amber-500/5 cursor-pointer'
              }`}
            >
              <div
                className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0"
                dangerouslySetInnerHTML={{ __html: RANK_MATH_LOGO }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Rank Math SEO</span>
                  {rankMathConnected && (
                    <Badge className="text-[10px] py-0 px-1.5 bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {t.connected}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <ExternalLink className="w-3 h-3" />
                  {rankMathConnected ? t.configure : language === 'fr' ? 'Connecter' : language === 'es' ? 'Conectar' : 'Connect'}
                </span>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* CMS Connection Dialog */}
      <CmsConnectionDialog open={cmsDialogOpen} onOpenChange={setCmsDialogOpen} cmsType={cmsDialogType} />

      {/* Rank Math Authorization Dialog */}
      <Dialog open={rankMathDialogOpen} onOpenChange={setRankMathDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div dangerouslySetInnerHTML={{ __html: RANK_MATH_LOGO }} />
              {t.rankMathTitle}
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">{t.rankMathDesc}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground">{t.rankMathPermissions}</p>
            <ul className="space-y-2">
              {[t.rankMathPerm1, t.rankMathPerm2, t.rankMathPerm3].map((perm, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{perm}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground/70 italic">{t.rankMathRequires}</p>

            {!wpConnection && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {t.noWpConnection}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleRankMathAuthorize}
              disabled={!wpConnection || rankMathLoading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {rankMathLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              {t.authorize}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
