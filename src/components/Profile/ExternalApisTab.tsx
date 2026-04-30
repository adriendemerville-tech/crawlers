import { useState, useEffect } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExternalLink, Loader2, ShieldCheck, CheckCircle2, BarChart3, MapPin, Server, Upload, Terminal, Globe, Cloud, HardDrive, FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CmsConnectionDialog } from './CmsConnectionDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';

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
  {
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

// Log connector services
interface LogServiceButton {
  id: string;
  type: 'cloudflare' | 'agent' | 'upload' | 'wpengine' | 'kinsta' | 'sftp' | 'aws' | 'vercel' | 'wordpress_plugin';
  name: string;
  logoSvg: string;
  description: { fr: string; en: string; es: string };
}

const logServices: LogServiceButton[] = [
  {
    id: 'log-cloudflare', type: 'cloudflare', name: 'Cloudflare',
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#F6821F" d="M16.51 15.86l.62-2.14c.12-.42.07-.81-.15-1.1-.2-.26-.52-.42-.88-.44l-8.73-.12c-.07 0-.12-.03-.15-.08-.03-.05-.03-.11 0-.16.04-.08.11-.14.2-.15l8.82-.12c.87-.04 1.8-.75 2.12-1.64l.41-1.13c.03-.07.03-.15.01-.22A5.5 5.5 0 0013.5 5 5.49 5.49 0 008.24 8.5a3.42 3.42 0 00-5.37 3.35A4.24 4.24 0 004.25 20h12a2.13 2.13 0 002.09-1.73l.23-.8c.07-.24.05-.46-.06-.61z"/><path fill="#FBAD41" d="M18.61 11.27c-.05 0-.1 0-.16.01l-.11-.38c-.12-.42-.5-.72-.94-.74l-1.18-.02c-.07 0-.12-.03-.15-.08-.03-.05-.03-.11 0-.16.04-.08.11-.14.2-.15l1.24-.02c.41-.02.85-.35 1-.76l.18-.5c.01-.04.02-.08.01-.12A3.3 3.3 0 0015.5 7a3.3 3.3 0 00-3.06 2.07h.01c.3.28.52.63.64 1.03l.49 1.7c.07.24.05.46-.06.61-.1.15-.27.24-.46.25l-8.74.12c-.01 0-.03 0-.04.01A4.24 4.24 0 004.25 20H18.6a2.4 2.4 0 100-4.8 2.4 2.4 0 000-3.93z"/></svg>`,
    description: { fr: 'Webhook Logpush', en: 'Logpush Webhook', es: 'Webhook Logpush' },
  },
  {
    id: 'log-wpengine', type: 'wpengine', name: 'WP Engine',
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#0ECAD4" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-11l4 3-4 3V9z"/></svg>`,
    description: { fr: 'Sync API horaire', en: 'Hourly API sync', es: 'Sync API por hora' },
  },
  {
    id: 'log-kinsta', type: 'kinsta', name: 'Kinsta',
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#5333ED" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15a5 5 0 110-10 5 5 0 010 10z"/></svg>`,
    description: { fr: 'Sync API horaire', en: 'Hourly API sync', es: 'Sync API por hora' },
  },
  {
    id: 'log-sftp', type: 'sftp', name: 'SFTP / SSH',
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#607D8B" d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/><path fill="#607D8B" d="M7 8l2.5 2L7 12v-1.5L8.5 10 7 9.5V8zm5 4h4v1h-4v-1z"/></svg>`,
    description: { fr: 'OVH, o2switch, Infomaniak…', en: 'OVH, o2switch, Infomaniak…', es: 'OVH, o2switch, Infomaniak…' },
  },
  {
    id: 'log-aws', type: 'aws', name: 'AWS CloudFront',
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#FF9900" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path fill="#FF9900" d="M8 11h8v2H8z"/><path fill="#232F3E" d="M12 7l-4 4h3v4h2v-4h3l-4-4z"/></svg>`,
    description: { fr: 'Logs S3 CloudFront', en: 'CloudFront S3 Logs', es: 'Logs S3 CloudFront' },
  },
  {
    id: 'log-vercel', type: 'vercel', name: 'Vercel',
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M12 2L2 19.5h20L12 2z"/></svg>`,
    description: { fr: 'Webhook Log Drain', en: 'Log Drain Webhook', es: 'Webhook Log Drain' },
  },
  {
    id: 'log-wordpress', type: 'wordpress_plugin', name: 'Plugin WordPress',
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#21759B" d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm-1.246 15.172L6.25 7.588A8.033 8.033 0 0112 4.028c1.676 0 3.234.514 4.524 1.392l-.532.472A7.963 7.963 0 0012 4.028c-1.907 0-3.657.67-5.032 1.784l4.77 13.846L12 19.44l-.754.268-.492-.536z"/></svg>`,
    description: { fr: 'Capture bots PHP', en: 'PHP Bot Capture', es: 'Captura bots PHP' },
  },
  {
    id: 'log-agent', type: 'agent', name: 'Agent Bash',
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#4CAF50" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM7 15l-2-2 2-2 1.41 1.41L7.83 13l.58.59L7 15zm4.59 1L10 16l4-8 1.59 0-4 8zM17 15l-1.41-1.41.58-.59-.58-.59L17 11l2 2-2 2z"/></svg>`,
    description: { fr: 'Script tail -F', en: 'tail -F script', es: 'Script tail -F' },
  },
  {
    id: 'log-upload', type: 'upload', name: 'Upload fichier',
    logoSvg: `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#2196F3" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15.01l1.41 1.41L11 14.84V19h2v-4.16l1.59 1.59L16 15.01 12.01 11 8 15.01z"/></svg>`,
    description: { fr: 'access.log manuel', en: 'Manual access.log', es: 'access.log manual' },
  },
];

export function ExternalApisTab({ onConnectionChange }: { onConnectionChange?: (hasAny: boolean) => void } = {}) {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const t = translations[language] || translations.fr;
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [cmsDialogOpen, setCmsDialogOpen] = useState(false);
  const [cmsDialogType, setCmsDialogType] = useState<'wordpress' | 'drupal' | 'shopify' | 'webflow' | 'wix' | 'odoo' | 'prestashop'>('wordpress');
  const [rankMathDialogOpen, setRankMathDialogOpen] = useState(false);
  const [rankMathLoading, setRankMathLoading] = useState(false);
  const [wpConnection, setWpConnection] = useState<{ id: string; site_url: string } | null>(null);
  const [rankMathConnected, setRankMathConnected] = useState(false);
  const [fullGoogleAccess, setFullGoogleAccess] = useState(false);
  const [gadsConsentOpen, setGadsConsentOpen] = useState(false);

  // Google API connection states
  const [gscConnected, setGscConnected] = useState(false);
  const [ga4Connected, setGa4Connected] = useState(false);
  const [adsConnected, setAdsConnected] = useState(false);
  const [cmsConnectedIds, setCmsConnectedIds] = useState<Set<string>>(new Set());

  // GBP state
  const [gbpConnected, setGbpConnected] = useState(false);
  const [gbpEmail, setGbpEmail] = useState<string | null>(null);
  const [gbpDisconnecting, setGbpDisconnecting] = useState(false);

  // Disconnect confirmation dialog state
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; name: string } | null>(null);
  const [disconnectStep, setDisconnectStep] = useState<'ask' | 'confirm'>('ask');
  const [disconnecting, setDisconnecting] = useState(false);

  // Matomo state
  const [matomoDialogOpen, setMatomoDialogOpen] = useState(false);
  const [matomoLoading, setMatomoLoading] = useState(false);
  const [matomoConnected, setMatomoConnected] = useState(false);
  const [matomoForm, setMatomoForm] = useState({ matomo_url: '', token_auth: '', site_id: '', tracked_site_id: '' });
  const [trackedSites, setTrackedSites] = useState<{ id: string; domain: string }[]>([]);

  // Log connectors state
  const [logConnectedTypes, setLogConnectedTypes] = useState<Set<string>>(new Set());
  const [logConnectorDialogOpen, setLogConnectorDialogOpen] = useState(false);
  const [selectedLogService, setSelectedLogService] = useState<LogServiceButton | null>(null);
  const [logConnectorLoading, setLogConnectorLoading] = useState(false);
  const [logTrackedSiteId, setLogTrackedSiteId] = useState('');
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);

  const { isAdmin } = useAdmin();
  // Check if user has Pro Agency+ plan (admin = premium)
  const isPremium = isAdmin || profile?.plan_type === 'agency_premium' || profile?.plan_type === 'agency_pro';

  // Check GSC/GA4/Ads/CMS connection status
  useEffect(() => {
    const checkApiConnections = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check GSC & GA4 from profiles first
      const { data: profile } = await supabase
        .from('profiles')
        .select('gsc_refresh_token, ga4_property_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      let gscOk = !!profile?.gsc_refresh_token;
      let ga4Ok = !!profile?.ga4_property_id;

      // Also check google_connections (primary source of truth)
      if (!ga4Ok || !gscOk) {
        const { data: conns } = await supabase
          .from('google_connections_public' as any)
          .select('id, ga4_property_id, gsc_site_urls')
          .eq('user_id', user.id);
        if (conns && (conns as any[]).length > 0) {
          gscOk = gscOk || (conns as any[]).some(c => c.gsc_site_urls && (c.gsc_site_urls as any[]).length > 0);
          ga4Ok = ga4Ok || (conns as any[]).some(c => !!c.ga4_property_id);
        }
      }

      setGscConnected(gscOk);
      setGa4Connected(ga4Ok);

      // Check Google Ads
      const { data: adsData } = await (supabase as any)
        .from('google_ads_connections_public')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      setAdsConnected(!!adsData);

      // Check CMS connections
      const { data: cmsData } = await supabase
        .from('cms_connections_public' as any)
        .select('platform')
        .eq('user_id', user.id)
        .eq('status', 'active');
      if (cmsData && (cmsData as any[]).length > 0) {
        setCmsConnectedIds(new Set((cmsData as any[]).map(c => c.platform)));
      }
    };
    checkApiConnections();
  }, [cmsDialogOpen]);

  // Notify parent of connection changes
  useEffect(() => {
    const hasAny = gscConnected || ga4Connected || adsConnected || gbpConnected || matomoConnected || rankMathConnected || cmsConnectedIds.size > 0;
    onConnectionChange?.(hasAny);
  }, [gscConnected, ga4Connected, adsConnected, gbpConnected, matomoConnected, rankMathConnected, cmsConnectedIds, onConnectionChange]);

  useEffect(() => {
    const checkWpConnection = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('cms_connections_public' as any)
        .select('id, site_url, capabilities')
        .eq('user_id', user.id)
        .eq('platform', 'wordpress')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setWpConnection({ id: d.id, site_url: d.site_url });
        const caps = d.capabilities as Record<string, unknown> | null;
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
        .eq('key', 'full_google_access_auth')
        .maybeSingle();
      if (data?.value && typeof data.value === 'object' && data.value.active === true) {
        setFullGoogleAccess(true);
      }
    };
    checkGoogleAccess();
  }, []);

  // Load tracked sites + check existing Matomo connection
  useEffect(() => {
    const loadMatomoData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [sitesRes, matomoRes] = await Promise.all([
        supabase.from('tracked_sites').select('id, domain').eq('user_id', user.id).order('domain'),
        supabase.from('matomo_connections_public' as any).select('id, tracked_site_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle(),
      ]);
      setTrackedSites((sitesRes.data || []) as { id: string; domain: string }[]);
      if (matomoRes.data) setMatomoConnected(true);
    };
    loadMatomoData();
  }, [matomoDialogOpen]);

  // Check GBP connection status
  useEffect(() => {
    const checkGbpStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const { data, error } = await supabase.functions.invoke('gbp-auth', {
          body: { action: 'status', user_id: user.id },
        });
        if (!error && data?.connected) {
          setGbpConnected(true);
          setGbpEmail(data.email || null);
        } else {
          setGbpConnected(false);
          setGbpEmail(null);
        }
      } catch { /* ignore */ }
    };
    checkGbpStatus();
  }, []);

  // Check log connectors status
  useEffect(() => {
    const checkLogConnectors = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from('log_connectors')
        .select('type')
        .eq('user_id', user.id);
      if (data && data.length > 0) {
        setLogConnectedTypes(new Set(data.map((c: any) => c.type)));
      }
    };
    checkLogConnectors();
  }, [logConnectorDialogOpen]);


  const analyticsServices = services.filter(s => {
    if (s.category !== 'analytics') return false;
    return true;
  });
  const cmsServices = services.filter(s => s.category === 'cms');
  const selfHostedServices = services.filter(s => s.category === 'self_hosted');

  const handleLogServiceClick = (service: LogServiceButton) => {
    setSelectedLogService(service);
    setLogTrackedSiteId('');
    setGeneratedApiKey(null);
    setLogConnectorDialogOpen(true);
  };

  const handleLogConnectorCreate = async () => {
    if (!selectedLogService || !logTrackedSiteId) {
      toast.error(language === 'fr' ? 'Sélectionnez un site' : 'Select a site');
      return;
    }
    setLogConnectorLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const needsApiKey = ['agent', 'upload', 'wordpress_plugin', 'cloudflare', 'vercel'].includes(selectedLogService.type);
      let apiKeyHash: string | null = null;
      let plainApiKey: string | null = null;

      if (needsApiKey) {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        plainApiKey = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(plainApiKey));
        apiKeyHash = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
      }

      const { data: existing } = await (supabase as any)
        .from('log_connectors')
        .select('id')
        .eq('user_id', user.id)
        .eq('tracked_site_id', logTrackedSiteId)
        .eq('type', selectedLogService.type)
        .maybeSingle();

      if (existing) {
        toast.info(language === 'fr' ? 'Ce connecteur existe déjà pour ce site' : 'This connector already exists for this site');
        setLogConnectorDialogOpen(false);
        setLogConnectorLoading(false);
        return;
      }

      const { error } = await (supabase as any)
        .from('log_connectors')
        .insert({
          user_id: user.id,
          tracked_site_id: logTrackedSiteId,
          type: selectedLogService.type,
          status: 'pending',
          api_key_hash: apiKeyHash,
        });

      if (error) throw error;

      setLogConnectedTypes(prev => new Set([...prev, selectedLogService.type]));

      if (plainApiKey) {
        setGeneratedApiKey(plainApiKey);
        toast.success(language === 'fr' ? 'Connecteur créé !' : 'Connector created!');
      } else {
        setLogConnectorDialogOpen(false);
        toast.success(language === 'fr' ? 'Connecteur créé !' : 'Connector created!');
      }
    } catch (err: any) {
      console.error('[ExternalApis] Log connector error:', err);
      toast.error(err.message || 'Error creating connector');
    } finally {
      setLogConnectorLoading(false);
    }
  };


  const handleServiceClick = async (service: ServiceButton) => {
    if (!service.available || connectingId) return;

    // If already connected → open disconnect dialog
    const isConnected = getServiceConnected(service.id);
    if (isConnected) {
      setDisconnectTarget({ id: service.id, name: service.name });
      setDisconnectStep('ask');
      return;
    }

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
      setGadsConsentOpen(true);
      return;
    }

    if (service.id === 'gmb') {
      setConnectingId(service.id);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.functions.invoke('gbp-auth', {
          body: { action: 'login', user_id: user?.id, frontend_origin: window.location.origin },
        });
        if (error) throw error;
        if (data?.auth_url) window.location.href = data.auth_url;
        else throw new Error('No auth URL returned');
      } catch (err) {
        console.error('[ExternalApis] GBP auth error:', err);
        toast.error(language === 'fr' ? 'Erreur de connexion Google Business Profile' : language === 'es' ? 'Error de conexión Google Business Profile' : 'Google Business Profile connection error');
      } finally {
        setConnectingId(null);
      }
      return;
    }

    if (service.id === 'matomo') {
      setMatomoDialogOpen(true);
      return;
    }

    if (['wordpress', 'drupal', 'shopify', 'webflow', 'wix', 'odoo', 'prestashop'].includes(service.id)) {
      setCmsDialogType(service.id as 'wordpress' | 'drupal' | 'shopify' | 'webflow' | 'wix' | 'odoo' | 'prestashop');
      setCmsDialogOpen(true);
    }
  };

  const handleMatomoConnect = async () => {
    const { matomo_url, token_auth, site_id, tracked_site_id } = matomoForm;
    if (!matomo_url || !token_auth || !site_id || !tracked_site_id) {
      toast.error(language === 'fr' ? 'Remplissez tous les champs' : 'Fill all fields');
      return;
    }
    setMatomoLoading(true);
    try {
      // Test connection
      const { data, error } = await supabase.functions.invoke('matomo-connector', {
        body: { action: 'test_connection', matomo_url, token_auth, site_id: parseInt(site_id) },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Connection failed');

      // Save connection
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('matomo_connections').upsert({
        user_id: user.id,
        tracked_site_id,
        matomo_url,
        auth_token: token_auth,
        site_id: parseInt(site_id),
        is_active: true,
      } as any, { onConflict: 'tracked_site_id' });

      setMatomoConnected(true);
      setMatomoDialogOpen(false);
      toast.success(language === 'fr' ? 'Matomo connecté !' : language === 'es' ? '¡Matomo conectado!' : 'Matomo connected!');
    } catch (err: any) {
      console.error('[ExternalApis] Matomo error:', err);
      toast.error(err.message || 'Matomo connection error');
    } finally {
      setMatomoLoading(false);
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
        .from('cms_connections_public' as any)
        .select('capabilities')
        .eq('id', wpConnection.id)
        .maybeSingle();

      const currentCaps = ((conn as any)?.capabilities as Record<string, unknown>) || {};
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

  const handleGbpDisconnect = async () => {
    setGbpDisconnecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('gbp-auth', {
        body: { action: 'disconnect', user_id: user.id },
      });
      if (error) throw error;
      setGbpConnected(false);
      setGbpEmail(null);
      toast.success(language === 'fr' ? 'Google Business Profile déconnecté' : language === 'es' ? 'Google Business Profile desconectado' : 'Google Business Profile disconnected');
    } catch (err) {
      console.error('[ExternalApis] GBP disconnect error:', err);
      toast.error(language === 'fr' ? 'Erreur de déconnexion' : 'Disconnect error');
    } finally {
      setGbpDisconnecting(false);
    }
  };

  const getServiceConnected = (id: string): boolean => {
    if (id === 'gsc') return gscConnected;
    if (id === 'ga4') return ga4Connected;
    if (id === 'google-ads') return adsConnected;
    if (id === 'gmb') return gbpConnected;
    if (id === 'matomo') return matomoConnected;
    if (cmsConnectedIds.has(id)) return true;
    return false;
  };

  const renderServiceCard = (service: ServiceButton) => {
    const isConnecting = connectingId === service.id;
    const isActive = getServiceConnected(service.id);

    return (
      <div key={service.id} className="relative">
        <button
          disabled={!service.available || isConnecting}
          onClick={() => handleServiceClick(service)}
          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full ${
            isActive
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : service.available
                ? 'border-border hover:border-violet-500/40 hover:bg-violet-500/5 cursor-pointer'
                : 'border-border/50 opacity-50 cursor-not-allowed'
          }`}
        >
          <div
            className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0"
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
                ) : isActive ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {t.connected}
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
      </div>
    );
  };

  const getDisconnectWarning = (id: string): string => {
    const warnings: Record<string, Record<string, string>> = {
      gsc: {
        fr: 'La déconnexion supprimera les données Search Console importées et les tokens OAuth associés.',
        en: 'Disconnecting will remove imported Search Console data and associated OAuth tokens.',
        es: 'La desconexión eliminará los datos importados de Search Console y los tokens OAuth asociados.',
      },
      ga4: {
        fr: 'La déconnexion supprimera les données Analytics importées et les tokens OAuth associés.',
        en: 'Disconnecting will remove imported Analytics data and associated OAuth tokens.',
        es: 'La desconexión eliminará los datos importados de Analytics y los tokens OAuth asociados.',
      },
      'google-ads': {
        fr: 'La déconnexion supprimera les données Google Ads (mots-clés, CPC, campagnes) et révoquera l\'accès OAuth.',
        en: 'Disconnecting will remove Google Ads data (keywords, CPC, campaigns) and revoke OAuth access.',
        es: 'La desconexión eliminará los datos de Google Ads (palabras clave, CPC, campañas) y revocará el acceso OAuth.',
      },
      gmb: {
        fr: 'La déconnexion supprimera les données Google Business Profile (avis, statistiques, fiches) et révoquera l\'accès OAuth.',
        en: 'Disconnecting will remove Google Business Profile data (reviews, stats, listings) and revoke OAuth access.',
        es: 'La desconexión eliminará los datos de Google Business Profile (reseñas, estadísticas, fichas) y revocará el acceso OAuth.',
      },
      matomo: {
        fr: 'La déconnexion supprimera la connexion Matomo et les métriques de trafic associées.',
        en: 'Disconnecting will remove the Matomo connection and associated traffic metrics.',
        es: 'La desconexión eliminará la conexión Matomo y las métricas de tráfico asociadas.',
      },
    };
    return warnings[id]?.[language] || warnings[id]?.fr || (language === 'fr' ? 'Cette action est irréversible.' : 'This action is irreversible.');
  };

  const handleDisconnectConfirm = async () => {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (disconnectTarget.id === 'gsc' || disconnectTarget.id === 'ga4') {
        const { error } = await supabase.functions.invoke('gsc-auth', {
          body: { action: 'disconnect', user_id: user.id, service: disconnectTarget.id },
        });
        if (error) throw error;
        if (disconnectTarget.id === 'gsc') setGscConnected(false);
        else setGa4Connected(false);
      } else if (disconnectTarget.id === 'google-ads') {
        const { error } = await supabase.functions.invoke('google-ads-connector', {
          body: { action: 'disconnect', user_id: user.id },
        });
        if (error) throw error;
        setAdsConnected(false);
      } else if (disconnectTarget.id === 'gmb') {
        const { error } = await supabase.functions.invoke('gbp-auth', {
          body: { action: 'disconnect', user_id: user.id },
        });
        if (error) throw error;
        setGbpConnected(false);
        setGbpEmail(null);
      } else if (disconnectTarget.id === 'matomo') {
        await supabase.from('matomo_connections').update({ is_active: false } as any).eq('user_id', user.id);
        setMatomoConnected(false);
      }

      toast.success(
        language === 'fr' ? `${disconnectTarget.name} déconnecté` :
        language === 'es' ? `${disconnectTarget.name} desconectado` :
        `${disconnectTarget.name} disconnected`
      );
      setDisconnectTarget(null);
    } catch (err) {
      console.error('[ExternalApis] Disconnect error:', err);
      toast.error(language === 'fr' ? 'Erreur de déconnexion' : 'Disconnect error');
    } finally {
      setDisconnecting(false);
    }
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cmsServices.map(renderServiceCard)}
          </div>
        </CardContent>
      </Card>

      {/* Log Analysis — Pro Agency+ */}
      {/* Log Analysis — visible to all, gated for non-premium */}
      <Card className={!isPremium ? 'opacity-60' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4" />
            {language === 'fr' ? 'Analyse des logs' : language === 'es' ? 'Análisis de logs' : 'Log Analysis'}
            {!isPremium && (
              <Badge className="text-[10px] py-0 px-2 bg-amber-500/20 text-amber-600 border-amber-500/30 font-semibold">
                Pro Agency +
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            {language === 'fr'
              ? 'Connectez vos sources de logs serveur pour analyser l\'activité des bots et le budget de crawl.'
              : language === 'es'
                ? 'Conecte sus fuentes de logs del servidor para analizar la actividad de bots y el presupuesto de crawl.'
                : 'Connect your server log sources to analyze bot activity and crawl budget.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {logServices.map(service => {
              const isActive = logConnectedTypes.has(service.type);
              return (
                <button
                  key={service.id}
                  onClick={() => isPremium && handleLogServiceClick(service)}
                  disabled={!isPremium}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full ${
                    !isPremium
                      ? 'border-border opacity-50 cursor-not-allowed grayscale'
                      : isActive
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0"
                    dangerouslySetInnerHTML={{ __html: service.logoSvg }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{service.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5 block">
                      {service.description[language] || service.description.fr}
                    </span>
                  </div>
                </button>
              );
            })}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <button
              onClick={() => setRankMathDialogOpen(true)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full ${
                rankMathConnected
                  ? 'border-green-500/40 bg-green-500/5'
                  : 'border-border hover:border-amber-500/40 hover:bg-amber-500/5 cursor-pointer'
              }`}
            >
              <div
                className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0"
                dangerouslySetInnerHTML={{ __html: RANK_MATH_LOGO }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Rank Math SEO</span>
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

      {/* Self-Hosted Analytics */}
      {selfHostedServices.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {language === 'fr' ? 'Analytics auto-hébergé' : language === 'es' ? 'Analítica auto-alojada' : 'Self-Hosted Analytics'}
            </CardTitle>
            <CardDescription className="text-xs">
              {language === 'fr'
                ? 'Connectez votre instance Matomo pour importer les métriques de trafic.'
                : language === 'es'
                  ? 'Conecte su instancia Matomo para importar métricas de tráfico.'
                  : 'Connect your Matomo instance to import traffic metrics.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {selfHostedServices.map(s => {
                const isMatomoConnected = s.id === 'matomo' && matomoConnected;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleServiceClick(s)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full ${
                      isMatomoConnected
                        ? 'border-green-500/40 bg-green-500/5'
                        : 'border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0"
                      dangerouslySetInnerHTML={{ __html: s.logoSvg }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{s.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <ExternalLink className="w-3 h-3" />
                        {isMatomoConnected ? t.configure : language === 'fr' ? 'Connecter' : language === 'es' ? 'Conectar' : 'Connect'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}



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

      {/* Matomo Connection Dialog */}
      <Dialog open={matomoDialogOpen} onOpenChange={setMatomoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#3152A0]" />
              {language === 'fr' ? 'Connecter Matomo' : language === 'es' ? 'Conectar Matomo' : 'Connect Matomo'}
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              {language === 'fr'
                ? 'Matomo est une alternative open-source à Google Analytics que vous hébergez vous-même. En la connectant à Crawlers, vous synchronisez les métriques de trafic de votre site sans dépendre des cookies Google.'
                : language === 'es'
                  ? 'Matomo es una alternativa open-source a Google Analytics que usted aloja. Al conectarla a Crawlers, sincroniza las métricas de tráfico de su sitio sin depender de las cookies de Google.'
                  : 'Matomo is a self-hosted open-source alternative to Google Analytics. Connecting it to Crawlers syncs your site\'s traffic metrics without relying on Google cookies.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Étapes pédagogiques */}
            <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-1">
              <p className="text-[12px] font-semibold text-foreground">
                {language === 'fr' ? 'Comment trouver vos identifiants ?' : language === 'es' ? '¿Cómo encontrar sus credenciales?' : 'How to find your credentials?'}
              </p>
              <ol className="text-[11px] text-muted-foreground leading-snug list-decimal list-inside space-y-0.5">
                <li>{language === 'fr'
                  ? 'Connectez-vous à votre instance Matomo (l\'URL ressemble à https://analytics.votre-domaine.com).'
                  : language === 'es'
                    ? 'Inicie sesión en su instancia Matomo (la URL se parece a https://analytics.su-dominio.com).'
                    : 'Sign in to your Matomo instance (URL looks like https://analytics.your-domain.com).'}
                </li>
                <li>{language === 'fr'
                  ? 'Cliquez sur votre avatar (haut droite) → Personnel → Sécurité → « Tokens d\'authentification API » → Créer un nouveau token. Copiez la valeur.'
                  : language === 'es'
                    ? 'Haga clic en su avatar (arriba derecha) → Personal → Seguridad → "Tokens de autenticación API" → Crear nuevo token. Copie el valor.'
                    : 'Click your avatar (top right) → Personal → Security → "Auth tokens" → Create new token. Copy the value.'}
                </li>
                <li>{language === 'fr'
                  ? 'L\'ID du site se trouve en haut à gauche de Matomo (ex : « Site #1 ») ou dans Administration → Sites web → colonne ID.'
                  : language === 'es'
                    ? 'El ID del sitio aparece arriba a la izquierda en Matomo (ej. "Sitio #1") o en Administración → Sitios web → columna ID.'
                    : 'The site ID appears top-left in Matomo (e.g. "Site #1") or in Administration → Websites → ID column.'}
                </li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {language === 'fr' ? 'Site suivi (chez Crawlers)' : language === 'es' ? 'Sitio rastreado (en Crawlers)' : 'Tracked site (in Crawlers)'}
              </label>
              <select
                value={matomoForm.tracked_site_id}
                onChange={e => setMatomoForm(f => ({ ...f, tracked_site_id: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{language === 'fr' ? 'Sélectionner un site…' : 'Select a site…'}</option>
                {trackedSites.map(s => (
                  <option key={s.id} value={s.id}>{s.domain}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {language === 'fr' ? 'URL de votre instance Matomo' : language === 'es' ? 'URL de su instancia Matomo' : 'Your Matomo instance URL'}
              </label>
              <Input
                placeholder="https://example.com"
                value={matomoForm.matomo_url}
                onChange={e => setMatomoForm(f => ({ ...f, matomo_url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {language === 'fr' ? 'Token d\'authentification API' : language === 'es' ? 'Token de autenticación API' : 'API auth token'}
              </label>
              <Input
                type="password"
                placeholder={language === 'fr' ? 'clé' : language === 'es' ? 'clave' : 'key'}
                value={matomoForm.token_auth}
                onChange={e => setMatomoForm(f => ({ ...f, token_auth: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {language === 'fr' ? 'ID du site Matomo (numérique)' : language === 'es' ? 'ID del sitio Matomo (numérico)' : 'Matomo site ID (numeric)'}
              </label>
              <Input
                type="number"
                placeholder={language === 'fr' ? 'ex : 1' : language === 'es' ? 'ej. 1' : 'e.g. 1'}
                value={matomoForm.site_id}
                onChange={e => setMatomoForm(f => ({ ...f, site_id: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleMatomoConnect}
              disabled={matomoLoading || !matomoForm.matomo_url || !matomoForm.token_auth || !matomoForm.site_id || !matomoForm.tracked_site_id}
              className="w-full"
            >
              {matomoLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {language === 'fr' ? 'Tester et connecter' : language === 'es' ? 'Probar y conectar' : 'Test & connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Connector Dialog */}
      <Dialog open={logConnectorDialogOpen} onOpenChange={setLogConnectorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              {selectedLogService?.name || 'Log Connector'}
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              {language === 'fr'
                ? 'Sélectionnez le site à connecter pour l\'analyse des logs serveur.'
                : language === 'es'
                  ? 'Seleccione el sitio a conectar para el análisis de logs del servidor.'
                  : 'Select the site to connect for server log analysis.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {language === 'fr' ? 'Site suivi' : language === 'es' ? 'Sitio rastreado' : 'Tracked site'}
              </label>
              <select
                value={logTrackedSiteId}
                onChange={e => setLogTrackedSiteId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{language === 'fr' ? 'Sélectionner un site…' : 'Select a site…'}</option>
                {trackedSites.map(s => (
                  <option key={s.id} value={s.id}>{s.domain}</option>
                ))}
              </select>
            </div>

            {selectedLogService && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  {selectedLogService.description[language] || selectedLogService.description.fr}
                </p>
                {['agent', 'upload', 'wordpress_plugin'].includes(selectedLogService.type) && (
                  <p>{language === 'fr' ? 'Une clé API sera générée et copiée automatiquement.' : 'An API key will be generated and copied automatically.'}</p>
                )}
                {['cloudflare', 'vercel'].includes(selectedLogService.type) && (
                  <p>{language === 'fr' ? 'Configurez le webhook dans votre dashboard externe.' : 'Configure the webhook in your external dashboard.'}</p>
                )}
                {['wpengine', 'kinsta', 'sftp', 'aws'].includes(selectedLogService.type) && (
                  <p>{language === 'fr' ? 'La synchronisation se fera automatiquement toutes les heures.' : 'Sync will happen automatically every hour.'}</p>
                )}
              </div>
            )}
          </div>

          {generatedApiKey ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                <p className="text-xs font-medium text-foreground">
                  {language === 'fr' ? 'Votre clé API (à copier maintenant, elle ne sera plus affichée) :' : 'Your API key (copy now, it won\'t be shown again):'}
                </p>
                <code className="block w-full p-2 rounded bg-background border border-border text-xs font-mono break-all select-all text-foreground">
                  {generatedApiKey}
                </code>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(generatedApiKey).then(() => {
                    toast.success(language === 'fr' ? 'Clé copiée !' : 'Key copied!');
                  }).catch(() => {});
                }}
              >
                {language === 'fr' ? 'Copier la clé' : 'Copy key'}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => { setGeneratedApiKey(null); setLogConnectorDialogOpen(false); }}
              >
                {language === 'fr' ? 'Fermer' : 'Close'}
              </Button>
            </div>
          ) : (
            <DialogFooter>
              <Button
                onClick={handleLogConnectorCreate}
                disabled={logConnectorLoading || !logTrackedSiteId}
                className="w-full"
              >
                {logConnectorLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {language === 'fr' ? 'Créer le connecteur' : language === 'es' ? 'Crear conector' : 'Create connector'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Google Ads Scope Consent Dialog ── */}
      <Dialog open={gadsConsentOpen} onOpenChange={setGadsConsentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {language === 'fr' ? 'Connexion Google Ads — Accès sécurisé' :
               language === 'es' ? 'Conexión Google Ads — Acceso seguro' :
               'Google Ads Connection — Secure Access'}
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>
                {language === 'fr'
                  ? "Crawlers se connecte à votre compte Google Ads via le scope standard (adwords). Ce scope est le seul proposé par Google — il n'existe pas d'alternative en lecture seule. Toutefois, notre application n'utilise que des opérations de consultation (reports, métriques, mots-clés)."
                  : language === 'es'
                  ? "Crawlers se conecta a su cuenta de Google Ads mediante el scope estándar (adwords). Es el único scope que ofrece Google — no existe alternativa de solo lectura. Sin embargo, nuestra aplicación solo utiliza operaciones de consulta (informes, métricas, palabras clave)."
                  : "Crawlers connects to your Google Ads account via the standard scope (adwords). This is the only scope Google offers — there is no read-only alternative. However, our application only uses read operations (reports, metrics, keywords)."}
              </p>
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  {language === 'fr' ? '🔒 Ce que nous faisons concrètement :' :
                   language === 'es' ? '🔒 Lo que hacemos concretamente:' :
                   '🔒 What we concretely do:'}
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{language === 'fr' ? 'Consultation des mots-clés et volumes de recherche' : language === 'es' ? 'Consulta de palabras clave y volúmenes de búsqueda' : 'Query keywords and search volumes'}</li>
                  <li>{language === 'fr' ? 'Consultation des CPC et dépenses par campagne' : language === 'es' ? 'Consulta de CPC y gastos por campaña' : 'Query CPC and campaign spend'}</li>
                  <li>{language === 'fr' ? 'Consultation des impressions, clics et conversions' : language === 'es' ? 'Consulta de impresiones, clics y conversiones' : 'Query impressions, clicks and conversions'}</li>
                </ul>
                <p className="font-medium text-foreground pt-1">
                  {language === 'fr' ? '🚫 Ce que nous ne faisons JAMAIS :' :
                   language === 'es' ? '🚫 Lo que NUNCA hacemos:' :
                   '🚫 What we NEVER do:'}
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{language === 'fr' ? 'Modifier ou supprimer vos campagnes' : language === 'es' ? 'Modificar o eliminar campañas' : 'Modify or delete your campaigns'}</li>
                  <li>{language === 'fr' ? 'Créer des annonces ou ajuster des enchères' : language === 'es' ? 'Crear anuncios o ajustar pujas' : 'Create ads or adjust bids'}</li>
                  <li>{language === 'fr' ? 'Accéder à vos informations de facturation' : language === 'es' ? 'Acceder a su información de facturación' : 'Access your billing information'}</li>
                </ul>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  {language === 'fr' ? '⏱ Conservation des données :' : language === 'es' ? '⏱ Retención de datos:' : '⏱ Data retention:'}
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>{language === 'fr' ? 'Tokens OAuth : supprimés dès la déconnexion' : language === 'es' ? 'Tokens OAuth: eliminados al desconectar' : 'OAuth tokens: deleted on disconnect'}</li>
                  <li>{language === 'fr' ? 'Données mots-clés : 90 jours puis suppression auto' : language === 'es' ? 'Datos palabras clave: 90 días, luego eliminación auto' : 'Keyword data: 90 days then auto-deleted'}</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'fr'
                  ? "Vous pouvez révoquer cet accès à tout moment depuis cette page ou depuis votre compte Google."
                  : language === 'es'
                  ? "Puede revocar este acceso en cualquier momento desde esta página o desde su cuenta de Google."
                  : "You can revoke this access at any time from this page or your Google account."}
                {' '}
                <a href="/api-integrations#google-ads" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">
                  {language === 'fr' ? 'Politique de confidentialité complète' : language === 'es' ? 'Política de privacidad completa' : 'Full privacy policy'}
                </a>
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setGadsConsentOpen(false)}>
              {language === 'fr' ? 'Annuler' : language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              onClick={async () => {
                setGadsConsentOpen(false);
                setConnectingId('google-ads');
                try {
                  const { data, error } = await supabase.functions.invoke('google-ads-connector', {
                    body: { action: 'login', frontend_origin: window.location.origin },
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
              }}
              className="gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              {language === 'fr' ? 'J\'ai compris, continuer' : language === 'es' ? 'Entendido, continuar' : 'I understand, continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Disconnect Confirmation Dialog ── */}
      <Dialog open={!!disconnectTarget} onOpenChange={(open) => { if (!open) { setDisconnectTarget(null); setDisconnectStep('ask'); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              {language === 'fr' ? `Êtes-vous sûr de vouloir déconnecter l'API ${disconnectTarget?.name} ?` :
               language === 'es' ? `¿Está seguro de querer desconectar la API ${disconnectTarget?.name}?` :
               `Are you sure you want to disconnect the ${disconnectTarget?.name} API?`}
            </DialogTitle>
            <DialogDescription className="pt-2">
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
                {disconnectTarget && getDisconnectWarning(disconnectTarget.id)}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            {disconnectStep === 'ask' ? (
              <>
                <Button variant="outline" onClick={() => { setDisconnectTarget(null); setDisconnectStep('ask'); }}>
                  {language === 'fr' ? 'Non' : language === 'es' ? 'No' : 'No'}
                </Button>
                <Button variant="outline" onClick={() => setDisconnectStep('confirm')}>
                  {language === 'fr' ? 'Oui, déconnecter' : language === 'es' ? 'Sí, desconectar' : 'Yes, disconnect'}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={handleDisconnectConfirm}
                disabled={disconnecting}
                className="w-full"
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {language === 'fr' ? 'Confirmer la déconnexion' : language === 'es' ? 'Confirmar desconexión' : 'Confirm disconnect'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
