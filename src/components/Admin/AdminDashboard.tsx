import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, FileText, BarChart3, MessageCircle, Shield } from 'lucide-react';
// TEST ISOLATION - Import commenté temporairement
// import { UserManagement } from './UserManagement';
import { BlogManagement } from './BlogManagement';
import { SupportManagement } from './SupportManagement';
import { AnalyticsDashboard } from './AnalyticsDashboard';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
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
        <TabsList className="w-full flex">
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
          <TabsTrigger value="support" className="flex-1 gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">SAV</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {/* TEST ISOLATION - Composant désactivé */}
          {/* <UserManagement /> */}
          <div className="p-4 text-muted-foreground border rounded-lg">Module Utilisateurs désactivé pour test d'isolation</div>
        </TabsContent>

        <TabsContent value="blog">
          <BlogManagement />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="support">
          <SupportManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
