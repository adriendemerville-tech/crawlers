import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAnalyticsProvider } from '@/contexts/AdminAnalyticsContext';
import { Users, FileText, BarChart3, MessageCircle, BookOpen, Globe, FlaskConical, Link2, Cpu, ShieldAlert, AlertTriangle, Brain, EyeOff, Eye, Code2, ScanSearch, Wallet, Syringe, ClipboardList, Package, Bot, Shield, Anchor, PenLine, Award, Plug, MessageSquare, Share2, Map } from 'lucide-react';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { UserManagement } from './UserManagement';
import { BlogManagement } from './BlogManagement';
import { SupportManagement } from './SupportManagement';
import { SavDashboard } from './SavDashboard';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { BrowserlessAlert } from './BrowserlessAlert';
import { ApiGatewayFallbackAlert } from './ApiGatewayFallbackAlert';
import { BackendDocumentation } from './BackendDocumentation';
import { CrawlManagement } from './CrawlManagement';
import { DemoModeToggle } from './DemoModeToggle';
import { GA4OAuthToggle } from './GA4OAuthToggle';
import { CiTestsDashboard } from './CiTestsDashboard';
import { AffiliateManagement } from './AffiliateManagement';
import { IntelligenceHub } from './IntelligenceHub';
import { ScriptKillSwitches } from './ScriptKillSwitches';
import { SilentErrorsRegistry } from './SilentErrorsRegistry';
import { AlgoTrainingDashboard } from './AlgoTrainingDashboard';
import { ScannedUrlsRegistry } from './ScannedUrlsRegistry';
import { FunctionsManagement } from './FunctionsManagement';
import { FinancesDashboard } from './FinancesDashboard';
import { InjectionErrorsRegistry } from './InjectionErrorsRegistry';
import { MatrixErrorsRegistry } from './MatrixErrorsRegistry';
import { BundleManagement } from './BundleManagement';
import { SurveyManagement } from './SurveyManagement';
import { ParmenionDashboard } from './ParmenionDashboard';
import { WorkbenchAdmin } from './WorkbenchAdmin';
import { EeatScoringAdmin } from './EeatScoringAdmin';
import { MarinaDashboard } from './MarinaDashboard';
import { ProspectPipelineDashboard } from './ProspectPipelineDashboard';
import { SocialContentDashboard } from './SocialContentDashboard';
import { SitemapMonitorWidget } from './SitemapMonitorWidget';
import { ReadOnlyBanner } from './ReadOnlyBanner';
const CocoonContentArchitectModal = lazy(() =>
  import('@/components/Cocoon/CocoonContentArchitectModal').then(m => ({ default: m.CocoonContentArchitectModal }))
);
import { AdminProvider } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

const adminTranslations = {
  fr: {
    monitoring: 'Monitoring',
    analytics: 'Statistiques',
    finances: 'Finances',
    intelligence: 'Intelligence',
    silentErrors: 'Erreurs silenc.',
    injectionErrors: 'Erreurs inject.',
    scannedUrls: 'URLs scannées',
    ciTests: 'CI Tests',
    contentUsers: 'Contenu & Users',
    users: 'Utilisateurs',
    cms: 'CMS',
    support: 'SAV',
    affiliates: 'Perks',
    technical: 'Technique',
    crawls: 'Crawls',
    scripts: 'Scripts',
    algos: 'Algos ML',
    documentation: 'Documentation',
    docs: 'Docs',
    functions: 'Functions',
    surveys: 'Surveys',
    bundle: 'Bundle',
    hideDocsForViewers: 'Masquer docs aux viewers',
    showDocsForViewers: 'Docs visibles aux viewers',
  },
  en: {
    monitoring: 'Monitoring',
    analytics: 'Analytics',
    finances: 'Finances',
    intelligence: 'Intelligence',
    silentErrors: 'Silent Errors',
    injectionErrors: 'Injection Errors',
    scannedUrls: 'Scanned URLs',
    ciTests: 'CI Tests',
    contentUsers: 'Content & Users',
    users: 'Users',
    cms: 'CMS',
    support: 'Support',
    affiliates: 'Perks',
    technical: 'Technical',
    crawls: 'Crawls',
    scripts: 'Scripts',
    algos: 'ML Algos',
    documentation: 'Documentation',
    docs: 'Docs',
    functions: 'Functions',
    surveys: 'Surveys',
    bundle: 'Bundle',
    hideDocsForViewers: 'Hide docs from viewers',
    showDocsForViewers: 'Docs visible to viewers',
  },
  es: {
    monitoring: 'Monitoreo',
    analytics: 'Estadísticas',
    finances: 'Finanzas',
    intelligence: 'Inteligencia',
    silentErrors: 'Errores silenc.',
    injectionErrors: 'Errores inject.',
    scannedUrls: 'URLs escaneadas',
    ciTests: 'CI Tests',
    contentUsers: 'Contenido & Usuarios',
    users: 'Usuarios',
    cms: 'CMS',
    support: 'Soporte',
    affiliates: 'Perks',
    technical: 'Técnico',
    crawls: 'Crawls',
    scripts: 'Scripts',
    algos: 'Algos ML',
    documentation: 'Documentación',
    docs: 'Docs',
    functions: 'Functions',
    surveys: 'Surveys',
    bundle: 'Bundle',
    hideDocsForViewers: 'Ocultar docs de viewers',
    showDocsForViewers: 'Docs visibles para viewers',
  },
};

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  group: string;
  notifKey?: keyof ReturnType<typeof useAdminNotifications>['notifications'];
}

interface AdminDashboardProps {
  readOnly?: boolean;
  canSeeDocs?: boolean;
  canSeeAlgos?: boolean;
  canSeeFinances?: boolean;
  canSeeUsers?: boolean;
  canSeeIntelligence?: boolean;
  isAuditor?: boolean;
  onSimulatedDataChange?: (enabled: boolean) => void;
  onShowGoogleOnboarding?: () => void;
}

export function AdminDashboard({ readOnly = false, canSeeDocs = true, canSeeAlgos = true, canSeeFinances = true, canSeeUsers = true, canSeeIntelligence = true, isAuditor = false, onSimulatedDataChange, onShowGoogleOnboarding }: AdminDashboardProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = adminTranslations[language] || adminTranslations.fr;
  const [activeTab, setActiveTab] = useState(canSeeIntelligence ? 'intelligence' : 'analytics');
  const [docsHiddenForViewers, setDocsHiddenForViewers] = useState(false);
  const [simulatedDataEnabled, setSimulatedDataEnabled] = useState(true);
  const [gscBigQueryHidden, setGscBigQueryHidden] = useState(false);
  const [showContentArchitect, setShowContentArchitect] = useState(false);
  const { notifications } = useAdminNotifications();
  const isMobile = useIsMobile();

  useEffect(() => {
    const loadDocVisibility = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('admin_dashboard_config')
        .select('card_order')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (data?.card_order && typeof data.card_order === 'object' && !Array.isArray(data.card_order)) {
        const config = data.card_order as Record<string, unknown>;
        setDocsHiddenForViewers(!!config.docs_hidden_for_viewers);
        setSimulatedDataEnabled(config.simulated_data_enabled !== false);
        setGscBigQueryHidden(!!config.gsc_bigquery_hidden);
      }
    };
    loadDocVisibility();
  }, []);

  const updateAdminConfig = async (patch: Record<string, unknown>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from('admin_dashboard_config')
      .select('id, card_order')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const currentConfig = (typeof existing.card_order === 'object' && !Array.isArray(existing.card_order))
        ? existing.card_order as Record<string, unknown>
        : {};
      await supabase
        .from('admin_dashboard_config')
        .update({ card_order: { ...currentConfig, ...patch } as Record<string, unknown> as any })
        .eq('id', existing.id);
      return;
    }

    await supabase
      .from('admin_dashboard_config')
      .insert({ user_id: user.id, card_order: patch as Record<string, unknown> as any });
  };

  const toggleDocsVisibility = async () => {
    const newValue = !docsHiddenForViewers;
    setDocsHiddenForViewers(newValue);
    await updateAdminConfig({ docs_hidden_for_viewers: newValue });
  };

  const toggleSimulatedData = async () => {
    const newValue = !simulatedDataEnabled;
    setSimulatedDataEnabled(newValue);
    onSimulatedDataChange?.(newValue);
    await updateAdminConfig({ simulated_data_enabled: newValue });
  };

  const toggleGscBigQueryHidden = async () => {
    const newValue = !gscBigQueryHidden;
    setGscBigQueryHidden(newValue);
    await updateAdminConfig({ gsc_bigquery_hidden: newValue });
  };

  const showDocs = canSeeDocs && !(readOnly && docsHiddenForViewers);
  const showAlgos = canSeeAlgos;

  // Build nav items grouped
  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: t.monitoring,
      items: [
        ...(canSeeIntelligence ? [{ id: 'intelligence', label: t.intelligence, icon: Cpu, group: 'monitoring', notifKey: 'intelligence' as const }] : []),
        { id: 'analytics', label: t.analytics, icon: BarChart3, group: 'monitoring' },
        ...(canSeeFinances ? [{ id: 'finances', label: t.finances, icon: Wallet, group: 'monitoring' }] : []),
        ...(canSeeFinances ? [{ id: 'bundle', label: t.bundle, icon: Package, group: 'monitoring' }] : []),
        { id: 'silent-errors', label: t.silentErrors, icon: AlertTriangle, group: 'monitoring', notifKey: 'silentErrors' as const },
        { id: 'injection-errors', label: t.injectionErrors, icon: Syringe, group: 'monitoring', notifKey: 'injectionErrors' as const },
        { id: 'ci-tests', label: t.ciTests, icon: FlaskConical, group: 'monitoring' },
        { id: 'matrix-errors', label: 'Matrice d\'audit', icon: ClipboardList, group: 'monitoring' },
        { id: 'scanned-urls', label: t.scannedUrls, icon: ScanSearch, group: 'monitoring' },
        { id: 'sitemap', label: 'Sitemap', icon: Globe, group: 'monitoring' },
      ],
    },
    {
      label: t.contentUsers,
      items: [
        ...(canSeeUsers ? [{ id: 'users', label: t.users, icon: Users, group: 'content' }] : []),
        { id: 'cms', label: t.cms, icon: FileText, group: 'content' },
        { id: 'support', label: t.support, icon: MessageCircle, group: 'content', notifKey: 'support' as const },
        { id: 'sav-ia', label: 'SAV IA', icon: Bot, group: 'content' },
        { id: 'affiliates', label: t.affiliates, icon: Link2, group: 'content' },
        { id: 'surveys', label: t.surveys, icon: ClipboardList, group: 'content' },
      ],
    },
    {
      label: t.technical,
      items: [
        { id: 'crawls', label: t.crawls, icon: Globe, group: 'technical' },
        { id: 'scripts', label: t.scripts, icon: ShieldAlert, group: 'technical' },
        ...(showAlgos ? [{ id: 'algos', label: t.algos, icon: Brain, group: 'technical' }] : []),
        { id: 'functions', label: t.functions, icon: Code2, group: 'technical' },
      ],
    },
    ...(showDocs
      ? [{
          label: t.documentation,
          items: [{ id: 'docs', label: t.docs, icon: BookOpen, group: 'docs' }],
        }]
      : []),
    {
      label: 'Automatisation',
      items: [
        { id: 'parmenion', label: 'Parménion', icon: Shield, group: 'automation' },
        { id: 'workbench', label: 'Workbench', icon: ClipboardList, group: 'automation' },
        { id: 'eeat', label: 'E-E-A-T', icon: Award, group: 'automation' },
        { id: 'marina', label: 'Marina', icon: Anchor, group: 'automation' },
        { id: 'prospects', label: 'Prospection', icon: Users, group: 'automation' },
        { id: 'social-hub', label: 'Social Hub', icon: Share2, group: 'automation' },
      ],
    },
  ];

  const renderContent = () => {
    const wrap = (children: React.ReactNode) => (
      <div className={readOnly ? 'admin-readonly' : ''}>{children}</div>
    );

    switch (activeTab) {
      case 'analytics': return <AnalyticsDashboard />;
      case 'finances': return <FinancesDashboard />;
      case 'intelligence': return <IntelligenceHub />;
      case 'silent-errors': return <SilentErrorsRegistry />;
      case 'injection-errors': return <InjectionErrorsRegistry />;
      case 'ci-tests': return <CiTestsDashboard />;
      case 'scanned-urls': return <ScannedUrlsRegistry />;
      case 'matrix-errors': return <MatrixErrorsRegistry />;
      case 'users': return wrap(<UserManagement />);
      case 'cms': return wrap(<BlogManagement />);
      case 'support': return wrap(<SupportManagement />);
      case 'sav-ia': return <SavDashboard />;
      case 'affiliates': return wrap(<AffiliateManagement />);
      case 'crawls': return wrap(<CrawlManagement />);
      case 'scripts': return wrap(<ScriptKillSwitches />);
      case 'algos': return showAlgos ? wrap(<AlgoTrainingDashboard />) : null;
      case 'docs': return showDocs ? <BackendDocumentation /> : null;
      case 'functions': return <FunctionsManagement />;
      case 'surveys': return <SurveyManagement />;
      case 'bundle': return <BundleManagement />;
      case 'parmenion': return <ParmenionDashboard />;
      case 'workbench': return <WorkbenchAdmin />;
      case 'eeat': return <EeatScoringAdmin />;
      case 'marina': return <MarinaDashboard />;
      case 'prospects': return <ProspectPipelineDashboard />;
      case 'social-hub': return <SocialContentDashboard simulatedDataEnabled={simulatedDataEnabled} />;
      case 'sitemap': return <SitemapMonitorWidget />;
      default: return <AnalyticsDashboard />;
    }
  };

  return (
    <>
    <AdminProvider value={{ readOnly, canSeeDocs: showDocs, canSeeAlgos: showAlgos, docsHiddenForViewers, isAuditor }}>
      <AdminAnalyticsProvider>
      <div className="space-y-3">
        {readOnly && <ReadOnlyBanner />}
        <BrowserlessAlert />
        <ApiGatewayFallbackAlert />

        {isMobile ? (
          /* ── Mobile: horizontal carousel nav + stacked content ── */
          <div className="space-y-3">
            <div className="overflow-x-auto -mx-2 px-2 pb-2">
              <div className="flex gap-1.5 w-max">
                {navGroups.flatMap((group) => group.items).map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const notifCount = item.notifKey ? notifications[item.notifKey] : 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs whitespace-nowrap transition-colors shrink-0",
                        isActive
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.label}</span>
                      {notifCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none">
                          {notifCount > 99 ? '99+' : notifCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0">
              {renderContent()}
            </div>
          </div>
        ) : (
          /* ── Desktop: sidebar + content ── */
          <div className="flex gap-4 min-h-[600px]">
            <nav className="w-48 shrink-0 space-y-4">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 mb-1">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      const notifCount = item.notifKey ? notifications[item.notifKey] : 0;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left",
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate flex-1">{item.label}</span>
                          {notifCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                              {notifCount > 99 ? '99+' : notifCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {!readOnly && (
                <div className="pt-2 border-t border-border/40 space-y-1">
                  <button
                    onClick={toggleDocsVisibility}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                  >
                    {docsHiddenForViewers ? <EyeOff className="h-3 w-3 shrink-0" /> : <Eye className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{docsHiddenForViewers ? t.hideDocsForViewers : t.showDocsForViewers}</span>
                  </button>
                  {docsHiddenForViewers && (
                    <Badge variant="secondary" className="text-[9px] mt-1 ml-2">
                      Masqué
                    </Badge>
                  )}
                  <button
                    onClick={toggleSimulatedData}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                  >
                    {simulatedDataEnabled ? <Eye className="h-3 w-3 shrink-0" /> : <EyeOff className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{simulatedDataEnabled ? 'Données simulées ON' : 'Données simulées OFF'}</span>
                  </button>
                  {simulatedDataEnabled && (
                    <Badge variant="outline" className="text-[9px] mt-1 ml-2 border-orange-500/40 text-orange-500">
                      Simulé
                    </Badge>
                  )}
                  <button
                    onClick={toggleGscBigQueryHidden}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                    title="Masque l'onglet Console > GSC BigQuery pour tous les utilisateurs (admins exclus)"
                  >
                    {gscBigQueryHidden ? <EyeOff className="h-3 w-3 shrink-0" /> : <Eye className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{gscBigQueryHidden ? 'GSC BigQuery masqué (front)' : 'GSC BigQuery visible (front)'}</span>
                  </button>
                  {gscBigQueryHidden && (
                    <Badge variant="secondary" className="text-[9px] mt-1 ml-2">
                      Caché front
                    </Badge>
                  )}
                  <button
                    onClick={() => setShowContentArchitect(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                  >
                    <PenLine className="h-3 w-3 shrink-0" />
                    <span className="truncate">Content Architect (crawlers.fr)</span>
                  </button>
                  {onShowGoogleOnboarding && (
                    <button
                      onClick={onShowGoogleOnboarding}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                    >
                      <Plug className="h-3 w-3 shrink-0" />
                      <span className="truncate">Modal Google Services</span>
                    </button>
                  )}
                  {canSeeDocs && (
                    <button
                      onClick={() => navigate('/architecture-map')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                    >
                      <Map className="h-3 w-3 shrink-0" />
                      <span className="truncate">Architecture Map</span>
                    </button>
                  )}
                </div>
              )}
            </nav>

            <div className="flex-1 min-w-0">
              {renderContent()}
            </div>
          </div>
        )}
      </div>
      </AdminAnalyticsProvider>
    </AdminProvider>

    {showContentArchitect && (
      <Suspense fallback={null}>
        <CocoonContentArchitectModal
          isOpen={showContentArchitect}
          onClose={() => setShowContentArchitect(false)}
          nodes={[]}
          domain="crawlers.fr"
          trackedSiteId=""
          demoMode={true}
          colorTheme="green"
        />
      </Suspense>
    )}
    </>
  );
}
