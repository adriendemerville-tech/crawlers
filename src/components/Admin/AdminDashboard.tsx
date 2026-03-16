import { useState, useEffect } from 'react';
import { Users, FileText, BarChart3, MessageCircle, BookOpen, Globe, FlaskConical, Link2, Cpu, ShieldAlert, AlertTriangle, Brain, EyeOff, Eye, Code2, ScanSearch, Wallet } from 'lucide-react';
import { UserManagement } from './UserManagement';
import { BlogManagement } from './BlogManagement';
import { SupportManagement } from './SupportManagement';
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
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { AdminProvider } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

const adminTranslations = {
  fr: {
    monitoring: 'Monitoring',
    analytics: 'Statistiques',
    finances: 'Finances',
    intelligence: 'Intelligence',
    silentErrors: 'Erreurs',
    scannedUrls: 'URLs scannées',
    ciTests: 'CI Tests',
    contentUsers: 'Contenu & Users',
    users: 'Utilisateurs',
    blog: 'Blog',
    support: 'SAV',
    affiliates: 'Affiliation',
    technical: 'Technique',
    crawls: 'Crawls',
    scripts: 'Scripts',
    algos: 'Algos ML',
    documentation: 'Documentation',
    docs: 'Docs',
    functions: 'Functions',
    hideDocsForViewers: 'Masquer docs aux viewers',
    showDocsForViewers: 'Docs visibles aux viewers',
  },
  en: {
    monitoring: 'Monitoring',
    analytics: 'Analytics',
    finances: 'Finances',
    intelligence: 'Intelligence',
    silentErrors: 'Errors',
    scannedUrls: 'Scanned URLs',
    ciTests: 'CI Tests',
    contentUsers: 'Content & Users',
    users: 'Users',
    blog: 'Blog',
    support: 'Support',
    affiliates: 'Affiliates',
    technical: 'Technical',
    crawls: 'Crawls',
    scripts: 'Scripts',
    algos: 'ML Algos',
    documentation: 'Documentation',
    docs: 'Docs',
    functions: 'Functions',
    hideDocsForViewers: 'Hide docs from viewers',
    showDocsForViewers: 'Docs visible to viewers',
  },
  es: {
    monitoring: 'Monitoreo',
    analytics: 'Estadísticas',
    finances: 'Finanzas',
    intelligence: 'Inteligencia',
    silentErrors: 'Errores',
    scannedUrls: 'URLs escaneadas',
    ciTests: 'CI Tests',
    contentUsers: 'Contenido & Usuarios',
    users: 'Usuarios',
    blog: 'Blog',
    support: 'Soporte',
    affiliates: 'Afiliación',
    technical: 'Técnico',
    crawls: 'Crawls',
    scripts: 'Scripts',
    algos: 'Algos ML',
    documentation: 'Documentación',
    docs: 'Docs',
    functions: 'Functions',
    hideDocsForViewers: 'Ocultar docs de viewers',
    showDocsForViewers: 'Docs visibles para viewers',
  },
};

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  group: string;
}

interface AdminDashboardProps {
  readOnly?: boolean;
  canSeeDocs?: boolean;
  canSeeAlgos?: boolean;
  canSeeFinances?: boolean;
  canSeeUsers?: boolean;
}

export function AdminDashboard({ readOnly = false, canSeeDocs = true, canSeeAlgos = true, canSeeFinances = true, canSeeUsers = true }: AdminDashboardProps) {
  const { language } = useLanguage();
  const t = adminTranslations[language] || adminTranslations.fr;
  const [activeTab, setActiveTab] = useState('analytics');
  const [docsHiddenForViewers, setDocsHiddenForViewers] = useState(false);

  useEffect(() => {
    const loadDocVisibility = async () => {
      const { data } = await supabase
        .from('admin_dashboard_config')
        .select('card_order')
        .limit(1)
        .maybeSingle();
      if (data?.card_order && typeof data.card_order === 'object' && !Array.isArray(data.card_order)) {
        const config = data.card_order as Record<string, unknown>;
        setDocsHiddenForViewers(!!config.docs_hidden_for_viewers);
      }
    };
    loadDocVisibility();
  }, []);

  const toggleDocsVisibility = async () => {
    const newValue = !docsHiddenForViewers;
    setDocsHiddenForViewers(newValue);
    const { data: existing } = await supabase
      .from('admin_dashboard_config')
      .select('id, card_order')
      .limit(1)
      .maybeSingle();
    if (existing) {
      const currentConfig = (typeof existing.card_order === 'object' && !Array.isArray(existing.card_order))
        ? existing.card_order as Record<string, unknown>
        : {};
      await supabase
        .from('admin_dashboard_config')
        .update({ card_order: { ...currentConfig, docs_hidden_for_viewers: newValue } })
        .eq('id', existing.id);
    }
  };

  const showDocs = canSeeDocs && !(readOnly && docsHiddenForViewers);
  const showAlgos = canSeeAlgos;

  // Build nav items grouped
  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: t.monitoring,
      items: [
        { id: 'analytics', label: t.analytics, icon: BarChart3, group: 'monitoring' },
        { id: 'finances', label: t.finances, icon: Wallet, group: 'monitoring' },
        { id: 'intelligence', label: t.intelligence, icon: Cpu, group: 'monitoring' },
        { id: 'silent-errors', label: t.silentErrors, icon: AlertTriangle, group: 'monitoring' },
        { id: 'ci-tests', label: t.ciTests, icon: FlaskConical, group: 'monitoring' },
        { id: 'scanned-urls', label: t.scannedUrls, icon: ScanSearch, group: 'monitoring' },
      ],
    },
    {
      label: t.contentUsers,
      items: [
        { id: 'users', label: t.users, icon: Users, group: 'content' },
        { id: 'blog', label: t.blog, icon: FileText, group: 'content' },
        { id: 'support', label: t.support, icon: MessageCircle, group: 'content' },
        { id: 'affiliates', label: t.affiliates, icon: Link2, group: 'content' },
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
      case 'ci-tests': return <CiTestsDashboard />;
      case 'scanned-urls': return <ScannedUrlsRegistry />;
      case 'users': return wrap(<UserManagement />);
      case 'blog': return wrap(<BlogManagement />);
      case 'support': return wrap(<SupportManagement />);
      case 'affiliates': return wrap(<AffiliateManagement />);
      case 'crawls': return wrap(<CrawlManagement />);
      case 'scripts': return wrap(<ScriptKillSwitches />);
      case 'algos': return showAlgos ? wrap(<AlgoTrainingDashboard />) : null;
      case 'docs': return showDocs ? <BackendDocumentation /> : null;
      case 'functions': return <FunctionsManagement />;
      default: return <AnalyticsDashboard />;
    }
  };

  return (
    <AdminProvider value={{ readOnly, canSeeDocs: showDocs, canSeeAlgos: showAlgos, docsHiddenForViewers }}>
      <div className="space-y-3">
        {readOnly && <ReadOnlyBanner />}
        {/* toggles moved to Scripts tab */}
        <BrowserlessAlert />
        <ApiGatewayFallbackAlert />

        <div className="flex gap-4 min-h-[600px]">
          {/* ─── Sidebar navigation ─── */}
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
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Creator-only: doc visibility toggle */}
            {!readOnly && (
              <div className="pt-2 border-t border-border/40">
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
              </div>
            )}
          </nav>

          {/* ─── Main content ─── */}
          <div className="flex-1 min-w-0">
            {renderContent()}
          </div>
        </div>
      </div>
    </AdminProvider>
  );
}
