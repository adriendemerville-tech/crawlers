import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, FileText, ListTodo, BarChart3, Plus, Key, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ParmenionTargetPanel } from './ParmenionTargetPanel';
import { ParmenionTaskPlan } from './ParmenionTaskPlan';
import { ParmenionFuncStats } from './ParmenionFuncStats';
import { ParmenionAddTargetModal } from './ParmenionAddTargetModal';
import { ParmenionApiKeyManager } from './ParmenionApiKeyManager';
import { ParmenionExecutionStatus } from './ParmenionExecutionStatus';
import { supabase } from '@/integrations/supabase/client';

interface Target {
  id: string;
  domain: string;
  label: string;
  event_type: string;
  platform: string;
  is_active: boolean;
}

export function ParmenionDashboard() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchTargets = useCallback(async () => {
    const { data } = await supabase
      .from('parmenion_targets')
      .select('id, domain, label, event_type, platform, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (data) setTargets(data);
  }, []);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const defaultTab = 'execution';

  return (
    <Tabs defaultValue={defaultTab} key={defaultTab} className="space-y-4">
      <div className="flex items-center gap-2">
        <TabsList className="flex-1 flex-wrap h-auto">
          <TabsTrigger value="execution" className="gap-2">
            <Activity className="h-4 w-4" />
            Exécution
          </TabsTrigger>
          {targets.map((t) => (
            <TabsTrigger key={t.id} value={t.domain.replace(/\./g, '-')} className="gap-2">
              <Globe className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="task-plan" className="gap-2">
            <ListTodo className="h-4 w-4" />
            Plan de tâches
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Key className="h-4 w-4" />
            Intégrations
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Stats
          </TabsTrigger>
        </TabsList>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-1" />
          Site
        </Button>
      </div>

      <TabsContent value="execution" forceMount className="data-[state=inactive]:hidden">
        <ParmenionExecutionStatus />
      </TabsContent>

      {targets.map((t) => (
        <TabsContent key={t.id} value={t.domain.replace(/\./g, '-')} forceMount className="data-[state=inactive]:hidden">
          <ParmenionTargetPanel
            targetLabel={t.label}
            targetDomain={t.domain}
            eventType={t.event_type}
            historyTitle={`Historique ${t.label}`}
            historyDescription={`Actions CMS effectuées sur ${t.domain}`}
            showForceArticle
          />
        </TabsContent>
      ))}

      <TabsContent value="task-plan" forceMount className="data-[state=inactive]:hidden">
        <div className="space-y-4">
          {targets.map((t) => (
            <ParmenionTaskPlan key={t.id} domain={t.domain} />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="integrations" forceMount className="data-[state=inactive]:hidden">
        <ParmenionApiKeyManager />
      </TabsContent>

      <TabsContent value="stats" forceMount className="data-[state=inactive]:hidden">
        <ParmenionFuncStats />
      </TabsContent>

      <ParmenionAddTargetModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onAdded={fetchTargets}
      />
    </Tabs>
  );
}
