import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const i18n = {
  fr: {
    title: 'Connectez vos services Google',
    desc: 'Pour pouvoir vous servir efficacement, Crawlers a besoin d\'accéder aux données de Google Business, GA4, Ads et Tag Manager.',
    privacy: 'Les données sont anonymisées, ne sont pas cédées à des tiers. La déconnexion est possible à tout moment dans les paramètres.',
    connect: 'Connecter mes services',
    connected: 'Déjà connecté',
    connecting: 'Connexion…',
    errorConnect: 'Erreur de connexion',
  },
  en: {
    title: 'Connect your Google services',
    desc: 'To serve you effectively, Crawlers needs access to Google Business, GA4, Ads and Tag Manager data.',
    privacy: 'Data is anonymized and not shared with third parties. You can disconnect at any time in settings.',
    connect: 'Connect my services',
    connected: 'Already connected',
    connecting: 'Connecting…',
    errorConnect: 'Connection error',
  },
  es: {
    title: 'Conecte sus servicios Google',
    desc: 'Para servirle eficazmente, Crawlers necesita acceder a los datos de Google Business, GA4, Ads y Tag Manager.',
    privacy: 'Los datos son anonimizados y no se ceden a terceros. La desconexión es posible en cualquier momento en los ajustes.',
    connect: 'Conectar mis servicios',
    connected: 'Ya conectado',
    connecting: 'Conectando…',
    errorConnect: 'Error de conexión',
  },
};

const GOOGLE_SERVICES = [
  {
    key: 'gbp',
    name: 'Google Business',
    logo: 'https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg',
    color: '#4285F4',
  },
  {
    key: 'ga4',
    name: 'Google Analytics 4',
    logo: 'https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg',
    color: '#E37400',
  },
  {
    key: 'ads',
    name: 'Google Ads',
    logo: 'https://fonts.gstatic.com/s/i/productlogos/ads_round/v4/24px.svg',
    color: '#4285F4',
  },
  {
    key: 'gtm',
    name: 'Tag Manager',
    logo: 'https://www.gstatic.com/analytics-suite/header/suite/v2/ic_tag_manager.svg',
    color: '#4285F4',
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleServicesOnboardingModal({ open, onOpenChange }: Props) {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const t = i18n[language] || i18n.fr;
  const [connecting, setConnecting] = useState(false);
  const [connectedServices, setConnectedServices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    const check = async () => {
      const connected = new Set<string>();
      const gscOk = !!profile?.gsc_access_token;

      const { data: conns } = await supabase
        .from('google_connections')
        .select('id, ga4_property_id, gsc_site_urls')
        .eq('user_id', user.id);
      if (conns?.length) {
        if (conns.some(c => !!c.ga4_property_id)) connected.add('ga4');
        if (conns.some(c => c.gsc_site_urls && (c.gsc_site_urls as any[]).length > 0)) connected.add('gsc');
      }
      if (gscOk) connected.add('gsc');

      // Check Ads
      const { data: adsData } = await (supabase as any)
        .from('google_ads_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (adsData) connected.add('ads');

      // Check GBP via google_connections gmb fields
      const { data: gbpConns } = await supabase
        .from('google_connections')
        .select('id, gmb_account_id')
        .eq('user_id', user.id);
      if (gbpConns?.some(c => !!(c as any).gmb_account_id)) connected.add('gbp');

      // GTM: check via profiles or assume connected with GSC (same OAuth)
      if (gscOk) connected.add('gtm');

      setConnectedServices(connected);
    };
    check();
  }, [open, user, profile]);

  const allConnected = GOOGLE_SERVICES.every(s => connectedServices.has(s.key));

  const handleConnect = async () => {
    if (!user) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-auth', {
        body: { action: 'login', user_id: user.id, frontend_origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      console.error('Google services connect error:', err);
      toast.error(t.errorConnect);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#1c1c1e] border-[#2c2c2e] text-white p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 space-y-4">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-semibold text-white/95 tracking-tight">
              {t.title}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed text-white/50">
              {t.desc}
            </DialogDescription>
          </DialogHeader>

          {/* Service cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {GOOGLE_SERVICES.map((service) => {
              const isConnected = connectedServices.has(service.key);
              return (
                <div
                  key={service.key}
                  className={`relative flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors ${
                    isConnected
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-white/8 bg-white/[0.02]'
                  }`}
                >
                  <img
                    src={service.logo}
                    alt={service.name}
                    className="h-6 w-6 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white/85 truncate">{service.name}</p>
                  </div>
                  {isConnected && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Privacy notice */}
          <div className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] border border-white/6 px-3.5 py-3">
            <Shield className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-white/40">
              {t.privacy}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/6 bg-white/[0.01]">
          {allConnected ? (
            <Badge className="w-full justify-center gap-2 py-2.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {t.connected}
            </Badge>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full gap-2 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white border border-white/10 font-medium shadow-none"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {connecting ? t.connecting : t.connect}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
