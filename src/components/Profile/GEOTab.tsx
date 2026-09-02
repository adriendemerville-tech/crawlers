/**
 * GEOTab — onglet « GEO » de la Console
 * Regroupe les modules dédiés à la visibilité IA / GEO :
 * - Profondeur LLM (LLMDepthCard)
 * - Benchmark LLM (LLMVisibilityDashboard)
 * - Analyse des logs bots (BotLogAnalysisCard)
 *
 * Auto-sélectionne le 1er site suivi quand aucun n'est passé en prop.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LLMDepthCard } from '@/components/Profile/LLMDepthCard';
import { AuditScoresBanner } from '@/components/Profile/AuditScoresBanner';
import { LLMVisibilityDashboard } from '@/components/Profile/LLMVisibilityDashboard';
import { BotLogAnalysisCard } from '@/components/Profile/BotLogAnalysisCard';
import { GeoKpiBanner } from '@/components/Profile/geo/GeoKpiBanner';
import { GeoQualityCard } from '@/components/Profile/geo/GeoQualityCard';
import { GeoFanOutClustersCard } from '@/components/Profile/geo/GeoFanOutClustersCard';
import { GeoDropDetectorCard } from '@/components/Profile/geo/GeoDropDetectorCard';
import { GeoBotMixCard } from '@/components/Profile/geo/GeoBotMixCard';
import { ShieldStatusCard } from '@/components/Profile/geo/ShieldStatusCard';
import { AICrawlActivityCard } from '@/components/Profile/geo/AICrawlActivityCard';
import { AIAttributionCard } from '@/components/Profile/geo/AIAttributionCard';
import { ShieldOnboardingBanner } from '@/components/Profile/geo/ShieldOnboardingBanner';
import { Loader2, Sparkles } from 'lucide-react';
import { MachineLayerCTA } from '@/components/MachineLayer/MachineLayerCTA';

interface GEOTabProps {
  externalSiteId?: string | null;
  externalDomain?: string | null;
}

interface TrackedSite {
  id: string;
  domain: string;
  site_name?: string;
}

const T = {
  fr: {
    title: 'GEO',
    description: 'Visibilité dans les moteurs IA — profondeur, benchmark et analyse des logs bots.',
    noSites: 'Aucun site suivi. Ajoutez d\'abord un site dans l\'onglet SEO pour voir vos métriques GEO.',
    loading: 'Chargement…',
    proRequired: 'Module Pro Agency requis',
    proRequiredDesc: 'L\'analyse des logs bots est réservée aux abonnés Pro Agency et Pro Agency+.',
  },
  en: {
    title: 'GEO',
    description: 'AI engine visibility — LLM depth, benchmark and bot log analysis.',
    noSites: 'No tracked sites yet. Add a site in the SEO tab first to view your GEO metrics.',
    loading: 'Loading…',
    proRequired: 'Pro Agency module required',
    proRequiredDesc: 'Bot log analysis is reserved for Pro Agency and Pro Agency+ subscribers.',
  },
  es: {
    title: 'GEO',
    description: 'Visibilidad en motores IA — profundidad LLM, benchmark y análisis de logs de bots.',
    noSites: 'Sin sitios rastreados. Agregue un sitio en la pestaña SEO primero.',
    loading: 'Cargando…',
    proRequired: 'Módulo Pro Agency requerido',
    proRequiredDesc: 'El análisis de logs está reservado a los suscriptores Pro Agency y Pro Agency+.',
  },
};

import { DeferredCard, CardSkeleton } from './geo/DeferredCard';

export function GEOTab({ externalSiteId, externalDomain }: GEOTabProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isAgencyPro } = useCredits();
  const { isAdmin } = useAdmin();
  const t = T[language as keyof typeof T] || T.fr;

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSite, setCurrentSite] = useState<TrackedSite | null>(null);
  const [simulatedDataEnabled, setSimulatedDataEnabled] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('tracked_sites')
      .select('id, domain, site_name')
      .eq('user_id', user.id)
      .order('domain')
      .then(({ data }) => {
        if (cancelled) return;
        const list = (data as TrackedSite[]) || [];
        setSites(list);
        // Resolve current site: external prop > first
        const target =
          (externalSiteId && list.find((s) => s.id === externalSiteId)) ||
          (externalDomain && list.find((s) => s.domain === externalDomain)) ||
          list[0] ||
          null;
        setCurrentSite(target);
        setLoading(false);
      })
      .then(undefined, () => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, externalSiteId, externalDomain]);

  // Read simulated data flag (admin global config)
  useEffect(() => {
    supabase
      .from('admin_dashboard_config')
      .select('card_order')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.card_order && typeof data.card_order === 'object' && !Array.isArray(data.card_order)) {
          const cfg = data.card_order as Record<string, unknown>;
          setSimulatedDataEnabled(cfg.simulated_data_enabled !== false);
        }
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <CardSkeleton lines={2} />
        <CardSkeleton lines={3} />
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!currentSite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.noSites}</p>
        </CardContent>
      </Card>
    );
  }


  const showLogs = isAgencyPro || isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              {t.title}
            </h1>
            <p className="text-sm text-muted-foreground">{t.description}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{currentSite.domain}</p>
        </div>
        <MachineLayerCTA
          domain={currentSite.domain}
          source="console_geo_header"
          variant="header-button"
          className="mt-1 shrink-0"
        />
      </div>

      <AuditScoresBanner domain={currentSite.domain} showTechnical={false} />

      {/* Onboarding Shield si non déployé */}
      <ShieldOnboardingBanner trackedSiteId={currentSite.id} domain={currentSite.domain} />

      {/* Bandeau 7 KPIs GEO */}
      <GeoKpiBanner trackedSiteId={currentSite.id} />

      {/* Sprint 2 — Shield / Crawl bots IA / Attribution humaine */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ShieldStatusCard trackedSiteId={currentSite.id} />
        <DeferredCard><AICrawlActivityCard trackedSiteId={currentSite.id} /></DeferredCard>
        <DeferredCard><AIAttributionCard trackedSiteId={currentSite.id} /></DeferredCard>
      </div>

      {/* Cartes : qualité contenu + fan-out */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DeferredCard><GeoQualityCard trackedSiteId={currentSite.id} /></DeferredCard>
        <DeferredCard><GeoFanOutClustersCard trackedSiteId={currentSite.id} /></DeferredCard>
      </div>

      {/* Drop Detector + Mix LLM */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DeferredCard><GeoDropDetectorCard trackedSiteId={currentSite.id} /></DeferredCard>
        <DeferredCard><GeoBotMixCard trackedSiteId={currentSite.id} /></DeferredCard>
      </div>

      {/* Profondeur LLM */}
      <DeferredCard lines={5}>
        <LLMDepthCard
          trackedSiteId={currentSite.id}
          domain={currentSite.domain}
          userId={user?.id || ''}
        />
      </DeferredCard>

      {/* Benchmark LLM */}
      <DeferredCard lines={5}>
        <LLMVisibilityDashboard
          trackedSiteId={currentSite.id}
          domain={currentSite.domain}
          userId={user?.id || ''}
        />
      </DeferredCard>

      {/* Analyse des logs bots — Pro Agency+ */}
      {showLogs ? (
        <DeferredCard lines={6}>
          <BotLogAnalysisCard
            trackedSiteId={currentSite.id}
            domain={currentSite.domain}
            simulatedDataEnabled={simulatedDataEnabled}
          />
        </DeferredCard>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.proRequired}</CardTitle>
            <CardDescription>{t.proRequiredDesc}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
