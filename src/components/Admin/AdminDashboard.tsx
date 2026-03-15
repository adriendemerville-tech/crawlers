import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, FileText, BarChart3, MessageCircle, BookOpen, Globe, FlaskConical, Link2, Cpu, ShieldAlert, AlertTriangle, Brain, EyeOff, Eye } from 'lucide-react';
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
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { AdminProvider } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

const adminTranslations = {
  fr: {
    // Groupe 1: Monitoring
    analytics: 'Statistiques',
    intelligence: 'Intelligence',
    silentErrors: 'Erreurs',
    ciTests: 'CI Tests',
    // Groupe 2: Contenu & Users
    users: 'Utilisateurs',
    blog: 'Blog',
    support: 'SAV',
    affiliates: 'Affiliation',
    // Groupe 3: Technique
    crawls: 'Crawls',
    scripts: 'Scripts',
    algos: 'Algos ML',
    // Groupe 4: Documentation
    docs: 'Docs',
    hideDocsForViewers: 'Masquer docs aux viewers',
    showDocsForViewers: 'Docs visibles aux viewers',
  },
  en: {
    analytics: 'Analytics',
    intelligence: 'Intelligence',
    silentErrors: 'Errors',
    ciTests: 'CI Tests',
    users: 'Users',
    blog: 'Blog',
    support: 'Support',
    affiliates: 'Affiliates',
    crawls: 'Crawls',
    scripts: 'Scripts',
    algos: 'ML Algos',
    docs: 'Docs',
    hideDocsForViewers: 'Hide docs from viewers',
    showDocsForViewers: 'Docs visible to viewers',
  },
  es: {
    analytics: 'Estadísticas',
    intelligence: 'Inteligencia',
    silentErrors: 'Errores',
    ciTests: 'CI Tests',
    users: 'Usuarios',
    blog: 'Blog',
    support: 'Soporte',
    affiliates: 'Afiliación',
    crawls: 'Crawls',
    scripts: 'Scripts',
    algos: 'Algos ML',
    docs: 'Docs',
    hideDocsForViewers: 'Ocultar docs de viewers',
    showDocsForViewers: 'Docs visibles para viewers',
  },
};

interface AdminDashboardProps {
  readOnly?: boolean;
  canSeeDocs?: boolean;
  canSeeAlgos?: boolean;
}

export function AdminDashboard({ readOnly = false, canSeeDocs = true, canSeeAlgos = true }: AdminDashboardProps) {
  const { language } = useLanguage();
  const t = adminTranslations[language] || adminTranslations.fr;
  const [docsHiddenForViewers, setDocsHiddenForViewers] = useState(false);

  // Load doc visibility setting from admin_dashboard_config
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
    // Upsert into admin_dashboard_config
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

  // Effective doc/algo visibility considering viewer restrictions AND creator toggle
  const showDocs = canSeeDocs && !(readOnly && docsHiddenForViewers);
  const showAlgos = canSeeAlgos;

  return (
    <AdminProvider value={{ readOnly, canSeeDocs: showDocs, canSeeAlgos: showAlgos, docsHiddenForViewers }}>
    <div className="space-y-4">
      {readOnly && <ReadOnlyBanner />}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <DemoModeToggle />
          <GA4OAuthToggle />
        </div>
      )}
      <BrowserlessAlert />
      <ApiGatewayFallbackAlert />

      <Tabs defaultValue="analytics" className="space-y-4">
        {/* ── Tab bar reorganized by groups ── */}
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          {/* Group 1: Monitoring & Analytics */}
          <TabsTrigger value="analytics" className="flex-1 gap-1.5 min-w-0">
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.analytics}</span>
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex-1 gap-1.5 min-w-0">
            <Cpu className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.intelligence}</span>
          </TabsTrigger>
          <TabsTrigger value="silent-errors" className="flex-1 gap-1.5 min-w-0">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.silentErrors}</span>
          </TabsTrigger>
          <TabsTrigger value="ci-tests" className="flex-1 gap-1.5 min-w-0">
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.ciTests}</span>
          </TabsTrigger>

          {/* Separator */}
          <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />

          {/* Group 2: Content & Users */}
          <TabsTrigger value="users" className="flex-1 gap-1.5 min-w-0">
            <Users className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.users}</span>
          </TabsTrigger>
          <TabsTrigger value="blog" className="flex-1 gap-1.5 min-w-0">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.blog}</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="flex-1 gap-1.5 min-w-0">
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.support}</span>
          </TabsTrigger>
          <TabsTrigger value="affiliates" className="flex-1 gap-1.5 min-w-0">
            <Link2 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.affiliates}</span>
          </TabsTrigger>

          {/* Separator */}
          <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />

          {/* Group 3: Technical */}
          <TabsTrigger value="crawls" className="flex-1 gap-1.5 min-w-0">
            <Globe className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.crawls}</span>
          </TabsTrigger>
          <TabsTrigger value="scripts" className="flex-1 gap-1.5 min-w-0">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t.scripts}</span>
          </TabsTrigger>
          {showAlgos && (
            <TabsTrigger value="algos" className="flex-1 gap-1.5 min-w-0">
              <Brain className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">{t.algos}</span>
            </TabsTrigger>
          )}

          {/* Separator */}
          {showDocs && <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />}

          {/* Group 4: Documentation */}
          {showDocs && (
            <TabsTrigger value="docs" className="flex-1 gap-1.5 min-w-0">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">{t.docs}</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Creator-only: toggle doc visibility for viewers ── */}
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDocsVisibility}
              className="gap-2 text-xs text-muted-foreground"
            >
              {docsHiddenForViewers ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  {t.hideDocsForViewers}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  {t.showDocsForViewers}
                </>
              )}
            </Button>
            {docsHiddenForViewers && (
              <Badge variant="secondary" className="text-xs">
                Docs masquées
              </Badge>
            )}
          </div>
        )}

        {/* ── Monitoring group ── */}
        <TabsContent value="analytics" forceMount className="data-[state=inactive]:hidden">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="intelligence" forceMount className="data-[state=inactive]:hidden">
          <IntelligenceHub />
        </TabsContent>

        <TabsContent value="silent-errors" forceMount className="data-[state=inactive]:hidden">
          <SilentErrorsRegistry />
        </TabsContent>

        <TabsContent value="ci-tests" forceMount className="data-[state=inactive]:hidden">
          <CiTestsDashboard />
        </TabsContent>

        {/* ── Content & Users group ── */}
        <TabsContent value="users" forceMount className="data-[state=inactive]:hidden">
          <div className={readOnly ? 'admin-readonly' : ''}>
            <UserManagement />
          </div>
        </TabsContent>

        <TabsContent value="blog" forceMount className="data-[state=inactive]:hidden">
          <div className={readOnly ? 'admin-readonly' : ''}>
            <BlogManagement />
          </div>
        </TabsContent>

        <TabsContent value="support" forceMount className="data-[state=inactive]:hidden">
          <div className={readOnly ? 'admin-readonly' : ''}>
            <SupportManagement />
          </div>
        </TabsContent>

        <TabsContent value="affiliates" forceMount className="data-[state=inactive]:hidden">
          <div className={readOnly ? 'admin-readonly' : ''}>
            <AffiliateManagement />
          </div>
        </TabsContent>

        {/* ── Technical group ── */}
        <TabsContent value="crawls" forceMount className="data-[state=inactive]:hidden">
          <div className={readOnly ? 'admin-readonly' : ''}>
            <CrawlManagement />
          </div>
        </TabsContent>

        <TabsContent value="scripts" forceMount className="data-[state=inactive]:hidden">
          <div className={readOnly ? 'admin-readonly' : ''}>
            <ScriptKillSwitches />
          </div>
        </TabsContent>

        {showAlgos && (
          <TabsContent value="algos" forceMount className="data-[state=inactive]:hidden">
            <div className={readOnly ? 'admin-readonly' : ''}>
              <AlgoTrainingDashboard />
            </div>
          </TabsContent>
        )}

        {/* ── Documentation ── */}
        {showDocs && (
          <TabsContent value="docs" forceMount className="data-[state=inactive]:hidden">
            <BackendDocumentation />
          </TabsContent>
        )}
      </Tabs>
    </div>
    </AdminProvider>
  );
}
