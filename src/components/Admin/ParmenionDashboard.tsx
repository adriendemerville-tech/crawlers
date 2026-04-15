import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, FileText, ListTodo } from 'lucide-react';
import { ParmenionTargetPanel } from './ParmenionTargetPanel';
import { ParmenionTaskPlan } from './ParmenionTaskPlan';

export function ParmenionDashboard() {
  return (
    <Tabs defaultValue="iktracker" className="space-y-4">
      <TabsList>
        <TabsTrigger value="iktracker" className="gap-2">
          <Globe className="h-4 w-4" />
          IKTracker
        </TabsTrigger>
        <TabsTrigger value="crawlers-cms" className="gap-2">
          <FileText className="h-4 w-4" />
          CMS Crawlers
        </TabsTrigger>
        <TabsTrigger value="task-plan" className="gap-2">
          <ListTodo className="h-4 w-4" />
          Plan de tâches
        </TabsTrigger>
      </TabsList>

      <TabsContent value="iktracker" forceMount className="data-[state=inactive]:hidden">
        <ParmenionTargetPanel
          targetLabel="IKTracker"
          targetDomain="iktracker.fr"
          eventType="cms_action:iktracker"
          historyTitle="Historique IKTracker"
          historyDescription="Actions CMS effectuées sur iktracker.fr"
          showForceArticle
        />
      </TabsContent>

      <TabsContent value="crawlers-cms" forceMount className="data-[state=inactive]:hidden">
        <ParmenionTargetPanel
          targetLabel="CMS Crawlers"
          targetDomain="crawlers.fr"
          eventType="cms_action:crawlers"
          historyTitle="Historique CMS Crawlers"
          historyDescription="Actions CMS effectuées sur crawlers.fr"
          showForceArticle
        />
      </TabsContent>

      <TabsContent value="task-plan" forceMount className="data-[state=inactive]:hidden">
        <div className="space-y-4">
          <ParmenionTaskPlan domain="iktracker.fr" />
          <ParmenionTaskPlan domain="crawlers.fr" />
        </div>
      </TabsContent>
    </Tabs>
  );
}
