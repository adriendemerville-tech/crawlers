import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Search, Brain, Shield, Bug, Award, Palette, ListTodo, Sparkles } from 'lucide-react';
import { CtoAgentDashboard } from './CtoAgentDashboard';
import { SeoAgentDashboard } from './SeoAgentDashboard';
import { UxAgentDashboard } from './UxAgentDashboard';
import { PredictionsDashboard } from './PredictionEngine';
import { CtoSupervisor } from './CtoSupervisor';
import { SupervisorErrorsRegistry } from './SupervisorErrorsRegistry';
import { AssistantPrecisionCard } from './AssistantPrecisionCard';
import { RecettageTab } from './RecettageTab';
import { EeatScoringAdmin } from './EeatScoringAdmin';
import { FelixAgentBridgeControls } from './FelixAgentBridgeControls';
import { AgentTaskPlanRegistry } from './AgentTaskPlanRegistry';
import { CopilotDashboard } from './CopilotDashboard';

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
          <TabsTrigger value="agent-ux" className="flex-1 gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Agent UX</span>
          </TabsTrigger>
          <TabsTrigger value="recettage" className="flex-1 gap-2">
            <Bug className="h-4 w-4" />
            <span className="hidden sm:inline">Recettage</span>
          </TabsTrigger>
          <TabsTrigger value="supervisor" className="flex-1 gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Supervisor</span>
          </TabsTrigger>
          <TabsTrigger value="eeat" className="flex-1 gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">E-E-A-T</span>
          </TabsTrigger>
          <TabsTrigger value="predictions" className="flex-1 gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Prédictions</span>
          </TabsTrigger>
          <TabsTrigger value="task-plan" className="flex-1 gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Plan tâches</span>
          </TabsTrigger>
          <TabsTrigger value="copilot" className="flex-1 gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Copilot</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agent-seo" forceMount className="data-[state=inactive]:hidden">
          <SeoAgentDashboard />
        </TabsContent>

        <TabsContent value="agent-cto" forceMount className="data-[state=inactive]:hidden">
          <CtoAgentDashboard />
        </TabsContent>

        <TabsContent value="agent-ux" forceMount className="data-[state=inactive]:hidden">
          <UxAgentDashboard />
        </TabsContent>

        <TabsContent value="recettage" forceMount className="data-[state=inactive]:hidden">
          <RecettageTab />
        </TabsContent>

        <TabsContent value="supervisor" forceMount className="data-[state=inactive]:hidden space-y-6">
          <FelixAgentBridgeControls />
          <AssistantPrecisionCard />
          <CtoSupervisor />
          <SupervisorErrorsRegistry />
        </TabsContent>

        <TabsContent value="eeat" forceMount className="data-[state=inactive]:hidden">
          <EeatScoringAdmin />
        </TabsContent>

        <TabsContent value="predictions" forceMount className="data-[state=inactive]:hidden">
          <PredictionsDashboard />
        </TabsContent>

        <TabsContent value="task-plan" forceMount className="data-[state=inactive]:hidden">
          <AgentTaskPlanRegistry />
        </TabsContent>

        <TabsContent value="copilot" forceMount className="data-[state=inactive]:hidden">
          <CopilotDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
