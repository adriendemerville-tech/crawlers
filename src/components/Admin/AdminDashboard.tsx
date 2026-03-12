import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, FileText, BarChart3, MessageCircle, Shield, Brain, Bot, BookOpen } from 'lucide-react';
import { UserManagement } from './UserManagement';
import { BlogManagement } from './BlogManagement';
import { SupportManagement } from './SupportManagement';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { PredictionsDashboard } from './PredictionEngine';
import { BrowserlessAlert } from './BrowserlessAlert';
import { CtoAgentDashboard } from './CtoAgentDashboard';
import { BackendDocumentation } from './BackendDocumentation';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <BrowserlessAlert />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Administration</h2>
          <p className="text-muted-foreground">Gérez les utilisateurs, le contenu et les statistiques</p>
        </div>
      </div>

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
          <TabsTrigger value="predictions" className="flex-1 gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Prédictions</span>
          </TabsTrigger>
          <TabsTrigger value="cto-agent" className="flex-1 gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Agent CTO</span>
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex-1 gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Documentation</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="flex-1 gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">SAV</span>
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

        <TabsContent value="predictions" forceMount className="data-[state=inactive]:hidden">
          <PredictionsDashboard />
        </TabsContent>

        <TabsContent value="cto-agent" forceMount className="data-[state=inactive]:hidden">
          <CtoAgentDashboard />
        </TabsContent>

        <TabsContent value="docs" forceMount className="data-[state=inactive]:hidden">
          <BackendDocumentation />
        </TabsContent>

        <TabsContent value="support" forceMount className="data-[state=inactive]:hidden">
          <SupportManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
