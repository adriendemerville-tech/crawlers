import { lazy, Suspense } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileEdit, FileText } from 'lucide-react';

const MyDrafts = lazy(() => import('@/components/Profile/MyDrafts').then(m => ({ default: m.MyDrafts })));
const MyPromptBlocks = lazy(() => import('@/components/Profile/MyPromptBlocks').then(m => ({ default: m.MyPromptBlocks })));

const labels = {
  fr: { drafts: 'Brouillons', prompts: 'Prompts' },
  en: { drafts: 'Drafts', prompts: 'Prompts' },
  es: { drafts: 'Borradores', prompts: 'Prompts' },
};

export function MyContent() {
  const { language } = useLanguage();
  const t = labels[language as keyof typeof labels] || labels.fr;

  return (
    <Tabs defaultValue="drafts" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="drafts" className="gap-1.5 text-xs">
          <FileEdit className="h-3.5 w-3.5" />
          {t.drafts}
        </TabsTrigger>
        <TabsTrigger value="prompts" className="gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" />
          {t.prompts}
        </TabsTrigger>
      </TabsList>

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
