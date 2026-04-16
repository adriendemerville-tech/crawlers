import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Crown, CheckCircle2, Loader2, Building2, MessageCircle,
  Infinity, Users, Server, Database, Shield, Headphones
} from 'lucide-react';

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'en' ? en : lang === 'es' ? es : fr;

interface PricingPlansSectionProps {
  title?: string;
  subtitle?: string;
  embedded?: boolean;
}

export function PricingPlansSection({ title, subtitle, embedded }: PricingPlansSectionProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingPlus, setLoadingPlus] = useState(false);

  const defaultTitle = t3(language,
    'Choisissez votre formule Pro',
    'Choose your Pro plan',
    'Elija su plan Pro'
  );
  const defaultSubtitle = t3(language,
    'Trois offres taillées pour trois réalités de terrain.',
    'Three plans tailored for three different realities.',
    'Tres ofertas adaptadas a tres realidades diferentes.'
  );

  const handleSubscribe = async () => {
    if (!user) {
      sessionStorage.setItem('download_pending', 'pro_agency_subscribe');
      sessionStorage.setItem('download_return_path', window.location.pathname);
      window.location.href = '/auth';
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', { body: { action: 'subscription' } });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank', 'noopener');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribePlus = async () => {
    if (!user) {
      sessionStorage.setItem('download_pending', 'pro_agency_plus_subscribe');
      sessionStorage.setItem('download_return_path', window.location.pathname);
      window.location.href = '/auth';
      return;
    }
    setLoadingPlus(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', { body: { action: 'subscription_premium' } });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank', 'noopener');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoadingPlus(false);
    }
  };

  const proFeatures = [
    t3(language, '5 000 pages crawlées/mois', '5,000 pages/month', '5 000 páginas/mes'),
    t3(language, '10 pages par scan', '10 pages per scan', '10 páginas por escaneo'),
    t3(language, 'Audits & codes correctifs illimités', 'Unlimited audits & corrective code', 'Auditorías y código ilimitados'),
    t3(language, 'Benchmark visibilité LLM', 'LLM Visibility Benchmark', 'Benchmark visibilidad LLM'),
    t3(language, 'Google Business (GBP/GMB)', 'Google Business (GBP/GMB)', 'Google Business (GBP/GMB)'),
    t3(language, 'Marque blanche + 2 comptes', 'White label + 2 accounts', 'Marca blanca + 2 cuentas'),
    t3(language, 'Benchmark rank SERP', 'SERP Rank Benchmark', 'Benchmark rank SERP'),
  ];

  const plusFeatures = [
    // Common with Pro Agency (upgraded)
    t3(language, '50 000 pages crawlées/mois', '50,000 pages/month', '50 000 páginas/mes'),
    t3(language, '50 pages par scan', '50 pages per scan', '50 páginas por escaneo'),
    t3(language, 'Audits & codes correctifs illimités', 'Unlimited audits & corrective code', 'Auditorías y código ilimitados'),
    t3(language, 'Benchmark LLM & Profondeur LLM illimités', 'Unlimited LLM Benchmark & Depth', 'Benchmark LLM y Profundidad LLM ilimitados'),
    t3(language, 'Google Business (GBP/GMB)', 'Google Business (GBP/GMB)', 'Google Business (GBP/GMB)'),
    t3(language, 'Marque blanche + 3 comptes', 'White label + 3 accounts', 'Marca blanca + 3 cuentas'),
    t3(language, 'Benchmark rank SERP', 'SERP Rank Benchmark', 'Benchmark rank SERP'),
    // Extras Pro Agency+
    'Conversion Optimizer',
    t3(language, 'API Marina', 'Marina API', 'API Marina'),
    t3(language, 'Analyse des logs', 'Log analysis', 'Análisis de logs'),
    t3(language, 'Stratégie concurrentielle', 'Competitive strategy', 'Estrategia competitiva'),
  ];

  const enterpriseFeatures = [
    t3(language, 'Tout illimité, sans restriction', 'Everything unlimited, no restrictions', 'Todo ilimitado, sin restricciones'),
    t3(language, 'Nombre d\'utilisateurs sur mesure', 'Custom number of users', 'Número de usuarios a medida'),
    t3(language, 'Serveur dédié & isolé', 'Dedicated & isolated server', 'Servidor dedicado y aislado'),
    t3(language, 'Données dupliquées & isolées', 'Duplicated & isolated data', 'Datos duplicados y aislados'),
    t3(language, 'SLA garanti', 'Guaranteed SLA', 'SLA garantizado'),
    t3(language, 'Protocole auth SSO SAML', 'SSO SAML authentication', 'Autenticación SSO SAML'),
    t3(language, 'Onboarding personnalisé', 'Personalized onboarding', 'Onboarding personalizado'),
    t3(language, 'Rôle admin / auditeur / éditeur', 'Admin / auditor / editor roles', 'Rol admin / auditor / editor'),
    t3(language, 'Fonctionnalités sur mesure', 'Custom features', 'Funcionalidades a medida'),
    t3(language, 'Accompagnement et formation', 'Support & training', 'Acompañamiento y formación'),
    t3(language, 'Paramètres DSI', 'IT department settings', 'Parámetros DSI'),
  ];

  const enterpriseIcons = [Infinity, Users, Server, Database, Shield, Headphones, Users, Shield, Headphones, Server];

  const cards = (
    <>
      {/* Pro Agency — Violet */}
      <div className="relative rounded-2xl border-2 border-violet-500/40 bg-card p-8 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="h-7 w-7 text-violet-500" />
          <h3 className="text-2xl font-bold text-foreground">Pro Agency</h3>
        </div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-4xl font-extrabold text-foreground">29€</span>
          <span className="text-lg text-muted-foreground">/mois</span>
        </div>
        <p className="text-xs font-medium text-violet-500 mb-4">
          {t3(language, 'Sans engagement', 'No commitment', 'Sin compromiso')}
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          {t3(language, 'Freelances, consultants, petites agences (1-5 clients)', 'Freelancers, consultants, small agencies (1-5 clients)', 'Freelancers, consultores, pequeñas agencias (1-5 clientes)')}
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground mb-8 flex-1">
          {proFeatures.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" /> {f}
            </li>
          ))}
        </ul>
        <Button
          size="lg"
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white font-semibold px-[20px]"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
          {t3(language, 'S\'abonner', 'Subscribe', 'Suscribirse')}
        </Button>
      </div>

      {/* Pro Agency + — Gold */}
      <div className="relative rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-950/20 via-card to-card p-8 flex flex-col shadow-lg shadow-amber-500/5">
        <div className="absolute -top-3 right-6">
          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-xs px-3 py-1 border-0">
            ⚡ {t3(language, 'Volume', 'Volume', 'Volumen')}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center">
            <Crown className="h-5 w-5 text-black" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">Pro Agency +</h3>
        </div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-4xl font-extrabold text-foreground">79€</span>
          <span className="text-lg text-muted-foreground">/mois</span>
        </div>
        <p className="text-xs font-medium text-amber-500 mb-4">
          {t3(language, 'Sans engagement', 'No commitment', 'Sin compromiso')}
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          {t3(language, 'Agences structurées, équipes internes SEO (10+ clients)', 'Structured agencies, in-house SEO teams (10+ clients)', 'Agencias estructuradas, equipos internos SEO (10+ clientes)')}
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground mb-8 flex-1">
          {plusFeatures.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" /> {f}
            </li>
          ))}
        </ul>
        <Button
          size="lg"
          onClick={handleSubscribePlus}
          disabled={loadingPlus}
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold shadow-lg shadow-amber-500/20"
        >
          {loadingPlus ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Crown className="h-5 w-5 mr-2" />}
          {t3(language, 'S\'abonner', 'Subscribe', 'Suscribirse')}
        </Button>
      </div>

      {/* Enterprise — Green */}
      <div className="relative rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 via-card to-card p-8 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">Enterprise</h3>
        </div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-3xl font-extrabold bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
            {t3(language, 'Sur demande', 'Custom pricing', 'Bajo demanda')}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {t3(language, 'Grands comptes, organisations, équipes 20+', 'Large accounts, organizations, 20+ teams', 'Grandes cuentas, organizaciones, equipos 20+')}
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground mb-8 flex-1">
          {enterpriseFeatures.map((f, i) => {
            const Icon = enterpriseIcons[i] || CheckCircle2;
            return (
              <li key={i} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-emerald-500 shrink-0" /> {f}
              </li>
            );
          })}
        </ul>
        <Button
          size="lg"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('felix-enterprise-contact'));
          }}
          className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white font-bold shadow-lg shadow-emerald-500/20"
        >
          <MessageCircle className="h-5 w-5 mr-2" />
          {t3(language, 'Contactez-nous', 'Contact us', 'Contáctenos')}
        </Button>
      </div>
    </>
  );

  if (embedded) {
    return <div className="grid gap-6 md:grid-cols-3">{cards}</div>;
  }

  return (
    <section className="border-y border-border bg-muted/20 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{title || defaultTitle}</h2>
          <p className="mt-3 text-muted-foreground">{subtitle || defaultSubtitle}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">{cards}</div>
      </div>
    </section>
  );
}
