import { lazy, Suspense } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileEdit, FileText, BarChart3 } from 'lucide-react';

const MyDrafts = lazy(() => import('@/components/Profile/MyDrafts').then(m => ({ default: m.MyDrafts })));
const MyPromptBlocks = lazy(() => import('@/components/Profile/MyPromptBlocks').then(m => ({ default: m.MyPromptBlocks })));
const EditorialDashboard = lazy(() => import('@/components/Profile/EditorialDashboard').then(m => ({ default: m.EditorialDashboard })));

const labels = {
  fr: { drafts: 'Brouillons', prompts: 'Prompts', dashboard: 'Dashboard' },
  en: { drafts: 'Drafts', prompts: 'Prompts', dashboard: 'Dashboard' },
  es: { drafts: 'Borradores', prompts: 'Prompts', dashboard: 'Dashboard' },
};

export function MyContent() {
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
        <TabsTrigger value="prompts" className="gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" />
          {t.prompts}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        <Suspense fallback={null}>
          <EditorialDashboard />
        </Suspense>
      </TabsContent>

      <TabsContent value="drafts">
        <Suspense fallback={null}>
          <MyDrafts />
        </Suspense>
      </TabsContent>

      <TabsContent value="prompts">
        <Suspense fallback={null}>
          <MyPromptBlocks />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
