import { lazy, Suspense } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileEdit, FileText, BarChart3, Cpu, Activity, LineChart, RefreshCw } from 'lucide-react';

const MyDrafts = lazy(() => import('@/components/Profile/MyDrafts').then(m => ({ default: m.MyDrafts })));
const MyPromptBlocks = lazy(() => import('@/components/Profile/MyPromptBlocks').then(m => ({ default: m.MyPromptBlocks })));
const EditorialDashboard = lazy(() => import('@/components/Profile/EditorialDashboard').then(m => ({ default: m.EditorialDashboard })));
const EditorialLLMRoutingMatrix = lazy(() => import('@/components/Profile/EditorialLLMRoutingMatrix').then(m => ({ default: m.EditorialLLMRoutingMatrix })));
const EditorialPipelineObservability = lazy(() => import('@/components/Profile/EditorialPipelineObservability').then(m => ({ default: m.EditorialPipelineObservability })));
const GA4Explorer = lazy(() => import('@/components/Profile/GA4/GA4Explorer').then(m => ({ default: m.GA4Explorer })));
const UpdatePipelinePanel = lazy(() => import('@/components/Profile/UpdatePipelinePanel').then(m => ({ default: m.UpdatePipelinePanel })));

const labels = {
  fr: { drafts: 'Brouillons', prompts: 'Prompts', dashboard: 'Dashboard', routing: 'Routage LLM', pipeline: 'Pipeline', ga4: 'GA4', refresh: 'Refresh' },
  en: { drafts: 'Drafts', prompts: 'Prompts', dashboard: 'Dashboard', routing: 'LLM Routing', pipeline: 'Pipeline', ga4: 'GA4', refresh: 'Refresh' },
  es: { drafts: 'Borradores', prompts: 'Prompts', dashboard: 'Dashboard', routing: 'Enrutado LLM', pipeline: 'Pipeline', ga4: 'GA4', refresh: 'Refresh' },
};

export function MyContent({ externalDomain }: { externalDomain?: string | null }) {
  const { language } = useLanguage();
  const t = labels[language as keyof typeof labels] || labels.fr;

  return (
    <Tabs defaultValue="dashboard" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
          <BarChart3 className="h-3.5 w-3.5" />
          {t.dashboard}
        </TabsTrigger>
        <TabsTrigger value="drafts" className="gap-1.5 text-xs">
          <FileEdit className="h-3.5 w-3.5" />
          {t.drafts}
        </TabsTrigger>
        <TabsTrigger value="refresh" className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          {t.refresh}
        </TabsTrigger>
        <TabsTrigger value="prompts" className="gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" />
          {t.prompts}
        </TabsTrigger>
        <TabsTrigger value="routing" className="gap-1.5 text-xs">
          <Cpu className="h-3.5 w-3.5" />
          {t.routing}
        </TabsTrigger>
        <TabsTrigger value="pipeline" className="gap-1.5 text-xs">
          <Activity className="h-3.5 w-3.5" />
          {t.pipeline}
        </TabsTrigger>
        <TabsTrigger value="ga4" className="gap-1.5 text-xs">
          <LineChart className="h-3.5 w-3.5" />
          {t.ga4}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        <Suspense fallback={null}>
          <EditorialDashboard externalDomain={externalDomain} />
        </Suspense>
      </TabsContent>

      <TabsContent value="drafts">
        <Suspense fallback={null}>
          <MyDrafts />
        </Suspense>
      </TabsContent>

      <TabsContent value="refresh">
        <Suspense fallback={null}>
          <UpdatePipelinePanel externalDomain={externalDomain} />
        </Suspense>
      </TabsContent>

      <TabsContent value="prompts">
        <Suspense fallback={null}>
          <MyPromptBlocks />
        </Suspense>
      </TabsContent>

      <TabsContent value="routing">
        <Suspense fallback={null}>
          <EditorialLLMRoutingMatrix externalDomain={externalDomain} />
        </Suspense>
      </TabsContent>

      <TabsContent value="pipeline">
        <Suspense fallback={null}>
          <EditorialPipelineObservability externalDomain={externalDomain} />
        </Suspense>
      </TabsContent>

      <TabsContent value="ga4">
        <Suspense fallback={null}>
          <GA4Explorer externalDomain={externalDomain} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
