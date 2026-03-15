import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, FileText, BarChart3, MessageCircle, BookOpen, Globe, FlaskConical, Link2, Cpu, ShieldAlert, AlertTriangle, Brain } from 'lucide-react';
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
import { useLanguage } from '@/contexts/LanguageContext';

const adminTranslations = {
  fr: {
    users: 'Utilisateurs',
    blog: 'Blog',
    analytics: 'Statistiques',
    intelligence: 'Intelligence',
    crawls: 'Crawls',
    support: 'SAV',
    ciTests: 'CI Tests',
    affiliates: 'Affiliation',
    scripts: 'Scripts',
    silentErrors: 'Erreurs',
    algos: 'Algos ML',
    docs: 'Docs',
  },
  en: {
    users: 'Users',
    blog: 'Blog',
    analytics: 'Analytics',
    intelligence: 'Intelligence',
    crawls: 'Crawls',
    support: 'Support',
    ciTests: 'CI Tests',
    affiliates: 'Affiliates',
    scripts: 'Scripts',
    silentErrors: 'Errors',
    algos: 'ML Algos',
    docs: 'Docs',
  },
  es: {
    users: 'Usuarios',
    blog: 'Blog',
    analytics: 'Estadísticas',
    intelligence: 'Inteligencia',
    crawls: 'Crawls',
    support: 'Soporte',
    ciTests: 'CI Tests',
    affiliates: 'Afiliación',
    scripts: 'Scripts',
    silentErrors: 'Errores',
    algos: 'Algos ML',
    docs: 'Docs',
  },
};

export function AdminDashboard() {
  const { language } = useLanguage();
  const t = adminTranslations[language] || adminTranslations.fr;

  return (
    <div className="space-y-6">
      <DemoModeToggle />
      <GA4OAuthToggle />
      <BrowserlessAlert />
      <ApiGatewayFallbackAlert />

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="users" className="flex-1 gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t.users}</span>
          </TabsTrigger>
          <TabsTrigger value="blog" className="flex-1 gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{t.blog}</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t.analytics}</span>
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex-1 gap-2">
            <Cpu className="h-4 w-4" />
            <span className="hidden sm:inline">{t.intelligence}</span>
          </TabsTrigger>
          <TabsTrigger value="crawls" className="flex-1 gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{t.crawls}</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="flex-1 gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{t.support}</span>
          </TabsTrigger>
          <TabsTrigger value="ci-tests" className="flex-1 gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">{t.ciTests}</span>
          </TabsTrigger>
          <TabsTrigger value="affiliates" className="flex-1 gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t.affiliates}</span>
          </TabsTrigger>
          <TabsTrigger value="scripts" className="flex-1 gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="hidden sm:inline">{t.scripts}</span>
          </TabsTrigger>
          <TabsTrigger value="silent-errors" className="flex-1 gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">{t.silentErrors}</span>
          </TabsTrigger>
          <TabsTrigger value="algos" className="flex-1 gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">{t.algos}</span>
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex-1 gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{t.docs}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" forceMount className="data-[state=inactive]:hidden">
          <UserManagement />
        </TabsContent>

        <TabsContent value="blog" forceMount className="data-[state=inactive]:hidden">
          <BlogManagement />
        </TabsContent>

        <TabsContent value="analytics" forceMount className="data-[state=inactive]:hidden">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="intelligence" forceMount className="data-[state=inactive]:hidden">
          <IntelligenceHub />
        </TabsContent>

        <TabsContent value="docs" forceMount className="data-[state=inactive]:hidden">
          <BackendDocumentation />
        </TabsContent>

        <TabsContent value="crawls" forceMount className="data-[state=inactive]:hidden">
          <CrawlManagement />
        </TabsContent>

        <TabsContent value="support" forceMount className="data-[state=inactive]:hidden">
          <SupportManagement />
        </TabsContent>

        <TabsContent value="ci-tests" forceMount className="data-[state=inactive]:hidden">
          <CiTestsDashboard />
        </TabsContent>

        <TabsContent value="affiliates" forceMount className="data-[state=inactive]:hidden">
          <AffiliateManagement />
        </TabsContent>

        <TabsContent value="scripts" forceMount className="data-[state=inactive]:hidden">
          <ScriptKillSwitches />
        </TabsContent>

        <TabsContent value="silent-errors" forceMount className="data-[state=inactive]:hidden">
          <SilentErrorsRegistry />
        </TabsContent>

        <TabsContent value="algos" forceMount className="data-[state=inactive]:hidden">
          <AlgoTrainingDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
