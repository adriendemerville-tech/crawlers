import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const i18n = {
  fr: {
    title: 'Connectez vos services Google',
    desc: 'Crawlers a besoin d\'accéder à Search Console, GA4, Google Business, Ads et Tag Manager. Vous pouvez tout connecter en une fois ou choisir module par module.',
    privacy: 'Une seule autorisation Google couvre tous les services sélectionnés. Les données sont anonymisées, jamais cédées à des tiers, déconnexion possible à tout moment.',
    selectAll: 'Tout sélectionner',
    deselectAll: 'Tout désélectionner',
    connectN: (n: number) => n === 1 ? 'Connecter ce service' : `Connecter les ${n} services sélectionnés`,
    connectNone: 'Sélectionnez au moins un service',
    connected: 'Déjà connecté',
    connecting: 'Connexion…',
    errorConnect: 'Erreur de connexion',
    alreadyConnected: 'Déjà connecté',
  },
  en: {
    title: 'Connect your Google services',
    desc: 'Crawlers needs access to Search Console, GA4, Google Business, Ads and Tag Manager. Connect all at once or pick module by module.',
    privacy: 'A single Google authorization covers all selected services. Data is anonymized, never shared, disconnection possible anytime.',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    connectN: (n: number) => n === 1 ? 'Connect this service' : `Connect ${n} selected services`,
    connectNone: 'Select at least one service',
    connected: 'Already connected',
    connecting: 'Connecting…',
    errorConnect: 'Connection error',
    alreadyConnected: 'Already connected',
  },
  es: {
    title: 'Conecte sus servicios Google',
    desc: 'Crawlers necesita acceso a Search Console, GA4, Google Business, Ads y Tag Manager. Conecte todo a la vez o módulo por módulo.',
    privacy: 'Una sola autorización Google cubre todos los servicios seleccionados. Datos anonimizados, nunca cedidos, desconexión posible en cualquier momento.',
    selectAll: 'Seleccionar todo',
    deselectAll: 'Deseleccionar todo',
    connectN: (n: number) => n === 1 ? 'Conectar este servicio' : `Conectar los ${n} servicios seleccionados`,
    connectNone: 'Seleccione al menos un servicio',
    connected: 'Ya conectado',
    connecting: 'Conectando…',
    errorConnect: 'Error de conexión',
    alreadyConnected: 'Ya conectado',
  },
};

type ModuleKey = 'gsc' | 'ga4' | 'gbp' | 'ads' | 'gtm';

const GOOGLE_SERVICES: Array<{ key: ModuleKey; name: string; logo: string }> = [
  { key: 'gsc', name: 'Search Console', logo: 'https://www.gstatic.com/images/branding/product/1x/search_console_48dp.png' },
  { key: 'ga4', name: 'Analytics 4', logo: 'https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg' },
  { key: 'gbp', name: 'Google Business', logo: 'https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg' },
  { key: 'ads', name: 'Google Ads', logo: 'https://fonts.gstatic.com/s/i/productlogos/ads_round/v4/24px.svg' },
  { key: 'gtm', name: 'Tag Manager', logo: 'https://www.gstatic.com/analytics-suite/header/suite/v2/ic_tag_manager.svg' },
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
  const [connectedServices, setConnectedServices] = useState<Set<ModuleKey>>(new Set());
  const [selected, setSelected] = useState<Set<ModuleKey>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    const check = async () => {
      const connected = new Set<ModuleKey>();
      const gscOk = !!profile?.gsc_access_token;

      // Single source of truth: google_connections (unifié depuis 2026-04-27)
      const { data: conns } = await supabase
        .from('google_connections_public' as any)
        .select('id, ga4_property_id, gsc_site_urls, gmb_account_id, ads_customer_id, scopes')
        .eq('user_id', user.id);

      if (conns?.length) {
        for (const c of conns as any[]) {
          if (c.ga4_property_id) connected.add('ga4');
          if (c.gsc_site_urls && (c.gsc_site_urls as any[]).length > 0) connected.add('gsc');
          if (c.gmb_account_id) connected.add('gbp');
          if (c.ads_customer_id) connected.add('ads');
          // GTM : déduit des scopes
          const scopes: string[] = c.scopes || [];
          if (scopes.some(s => s.includes('tagmanager'))) connected.add('gtm');
        }
      }
      if (gscOk) connected.add('gsc');

      setConnectedServices(connected);
      // Pré-sélection : tout sauf ce qui est déjà connecté
      setSelected(new Set(GOOGLE_SERVICES.filter(s => !connected.has(s.key)).map(s => s.key)));
    };
    check();
  }, [open, user, profile]);

  const allConnected = GOOGLE_SERVICES.every(s => connectedServices.has(s.key));

  const toggle = (key: ModuleKey) => {
    if (connectedServices.has(key)) return; // already connected, no-op
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const remaining = GOOGLE_SERVICES.filter(s => !connectedServices.has(s.key)).map(s => s.key);
    setSelected(new Set(remaining));
  };
  const deselectAll = () => setSelected(new Set());

  const handleConnect = async () => {
    if (!user || selected.size === 0) return;
    setConnecting(true);
    try {
      const modules = Array.from(selected);
      const { data, error } = await supabase.functions.invoke('gsc-auth', {
        body: {
          action: 'login',
          user_id: user.id,
          frontend_origin: window.location.origin,
          modules,
        },
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

  const remainingCount = GOOGLE_SERVICES.filter(s => !connectedServices.has(s.key)).length;

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

          {/* Select / Deselect helpers */}
          {!allConnected && remainingCount > 1 && (
            <div className="flex items-center gap-3 text-[11px]">
              <button
                onClick={selectAll}
                className="text-white/60 hover:text-white/90 transition-colors underline-offset-2 hover:underline"
              >
                {t.selectAll}
              </button>
              <span className="text-white/15">·</span>
              <button
                onClick={deselectAll}
                className="text-white/60 hover:text-white/90 transition-colors underline-offset-2 hover:underline"
              >
                {t.deselectAll}
              </button>
            </div>
          )}

          {/* Service cards with checkboxes */}
          <div className="grid grid-cols-1 gap-2">
            {GOOGLE_SERVICES.map((service) => {
              const isConnected = connectedServices.has(service.key);
              const isSelected = selected.has(service.key);
              return (
                <label
                  key={service.key}
                  htmlFor={`gs-${service.key}`}
                  className={`relative flex items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                    isConnected
                      ? 'border-emerald-500/30 bg-emerald-500/5 cursor-default'
                      : isSelected
                      ? 'border-white/20 bg-white/[0.04] cursor-pointer'
                      : 'border-white/8 bg-white/[0.02] cursor-pointer hover:bg-white/[0.04]'
                  }`}
                >
                  {!isConnected && (
                    <Checkbox
                      id={`gs-${service.key}`}
                      checked={isSelected}
                      onCheckedChange={() => toggle(service.key)}
                      className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white"
                    />
                  )}
                  <img
                    src={service.logo}
                    alt={service.name}
                    className="h-5 w-5 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white/85 truncate">{service.name}</p>
                  </div>
                  {isConnected && (
                    <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/80">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t.alreadyConnected}
                    </span>
                  )}
                </label>
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
              disabled={connecting || selected.size === 0}
              variant="outline"
              className="w-full gap-2 border-white/15 hover:border-white/30 hover:bg-white/[0.04] text-white font-medium shadow-none disabled:opacity-40"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {connecting ? t.connecting : selected.size === 0 ? t.connectNone : t.connectN(selected.size)}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
