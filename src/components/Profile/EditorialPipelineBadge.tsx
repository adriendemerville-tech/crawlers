import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Activity } from 'lucide-react';

interface Status {
  use_editorial_pipeline: boolean;
  runs_last_7d: number;
  avg_latency_ms_7d: number;
  total_cost_usd_7d: number;
}

export function EditorialPipelineBadge({ domain }: { domain: string }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from('editorial_pipeline_status')
        .select('use_editorial_pipeline, runs_last_7d, avg_latency_ms_7d, total_cost_usd_7d')
        .eq('domain', domain)
        .maybeSingle();
      if (data) setStatus(data as Status);
    }
    if (domain) load();
  }, [domain]);

  if (!status?.use_editorial_pipeline) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Activity className="h-3 w-3" />
            Pipeline 4-étages
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          <div className="space-y-0.5">
            <p>Runs (7j) : {status.runs_last_7d}</p>
            <p>Latence moy. : {(Number(status.avg_latency_ms_7d) / 1000).toFixed(1)}s</p>
            <p>Coût (7j) : ${Number(status.total_cost_usd_7d).toFixed(3)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
