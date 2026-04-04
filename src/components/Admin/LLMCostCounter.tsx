import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Euro, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Pricing per 1M tokens (USD) — mirrors backend llmCostCalculator.ts
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'mistral/mistral-large-latest': { input: 2.0, output: 6.0 },
};

const USD_TO_EUR = 0.92;

function computeCostEur(inputTokens: number, outputTokens: number, model = 'anthropic/claude-3.5-sonnet'): number {
  const p = MODEL_PRICING[model] || MODEL_PRICING['anthropic/claude-3.5-sonnet'];
  return ((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * USD_TO_EUR;
}

interface Props {
  /** 'cto' or 'supervisor' */
  agent: 'cto' | 'supervisor';
  /** Number of days to look back (default 30) */
  days?: number;
}

export function LLMCostCounter({ agent, days = 30 }: Props) {
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [todayCost, setTodayCost] = useState<number>(0);
  const [callCount, setCallCount] = useState<number>(0);

  useEffect(() => {
    fetchCost();
  }, [agent, days]);

  const fetchCost = async () => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (agent === 'cto') {
      const { data } = await supabase
        .from('cto_agent_logs')
        .select('metadata, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);

      if (data) {
        let total = 0;
        let today = 0;
        for (const log of data as any[]) {
          const tokens = log.metadata?.tokens;
          if (tokens) {
            const cost = computeCostEur(tokens.input || 0, tokens.output || 0);
            total += cost;
            if (new Date(log.created_at) >= todayStart) today += cost;
          }
        }
        setTotalCost(total);
        setTodayCost(today);
        setCallCount(data.length);
      }
    } else {
      const { data } = await supabase
        .from('supervisor_logs' as any)
        .select('metadata, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);

      if (data) {
        let total = 0;
        let today = 0;
        for (const log of data as any[]) {
          // Check if llm_cost is already computed in metadata
          if (log.metadata?.llm_cost?.total_eur != null) {
            total += log.metadata.llm_cost.total_eur;
            if (new Date(log.created_at) >= todayStart) today += log.metadata.llm_cost.total_eur;
          } else {
            // Fallback: estimate from model (Claude 3.5 Sonnet, ~2000 input + 1500 output per call)
            const cost = computeCostEur(2000, 1500);
            total += cost;
            if (new Date(log.created_at) >= todayStart) today += cost;
          }
        }
        setTotalCost(total);
        setTodayCost(today);
        setCallCount(data.length);
      }
    }
  };

  if (totalCost === null) return null;

  return (
    <Card className="border-border/40 bg-card/50">
      <CardContent className="p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Euro className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">
            {totalCost.toFixed(1)}€
          </span>
          <span className="text-xs text-muted-foreground">/ {days}j</span>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <TrendingUp className="h-3 w-3" />
          Aujourd'hui : {todayCost.toFixed(1)}€
        </Badge>
        <span className="text-xs text-muted-foreground">
          {callCount} appels LLM
        </span>
      </CardContent>
    </Card>
  );
}
