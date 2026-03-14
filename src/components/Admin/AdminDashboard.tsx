import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, FileText, BarChart3, MessageCircle, BookOpen, Globe, FlaskConical, Link2, Cpu } from 'lucide-react';
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

export function AdminDashboard() {
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
            <span className="hidden sm:inline">Utilisateurs</span>
          </TabsTrigger>
          <TabsTrigger value="blog" className="flex-1 gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Blog</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Statistiques</span>
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex-1 gap-2">
            <Cpu className="h-4 w-4" />
            <span className="hidden sm:inline">Intelligence</span>
          </TabsTrigger>
          <TabsTrigger value="crawls" className="flex-1 gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Crawls</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="flex-1 gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">SAV</span>
          </TabsTrigger>
          <TabsTrigger value="ci-tests" className="flex-1 gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">CI Tests</span>
          </TabsTrigger>
          <TabsTrigger value="affiliates" className="flex-1 gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Affiliation</span>
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex-1 gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Docs</span>
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
      </Tabs>
    </div>
  );
}
