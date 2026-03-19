import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Search, Brain, Shield } from 'lucide-react';
import { CtoAgentDashboard } from './CtoAgentDashboard';
import { SeoAgentDashboard } from './SeoAgentDashboard';
import { PredictionsDashboard } from './PredictionEngine';
import { CtoSupervisor } from './CtoSupervisor';

export function IntelligenceHub() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="agent-seo" className="space-y-4">
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="agent-seo" className="flex-1 gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Agent SEO</span>
          </TabsTrigger>
          <TabsTrigger value="agent-cto" className="flex-1 gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Agent CTO</span>
          </TabsTrigger>
          <TabsTrigger value="supervisor" className="flex-1 gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Supervisor</span>
          </TabsTrigger>
          <TabsTrigger value="predictions" className="flex-1 gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Prédictions</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agent-seo" forceMount className="data-[state=inactive]:hidden">
          <SeoAgentDashboard />
        </TabsContent>

        <TabsContent value="agent-cto" forceMount className="data-[state=inactive]:hidden">
          <CtoAgentDashboard />
        </TabsContent>

        <TabsContent value="supervisor" forceMount className="data-[state=inactive]:hidden">
          <CtoSupervisor />
        </TabsContent>

        <TabsContent value="predictions" forceMount className="data-[state=inactive]:hidden">
          <PredictionsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
