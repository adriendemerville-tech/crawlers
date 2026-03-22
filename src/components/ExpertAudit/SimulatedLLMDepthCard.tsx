import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, CheckCircle2, XCircle } from 'lucide-react';
import { StrategicAnalysis } from '@/types/expertAudit';
import { MethodologyPopover } from './MethodologyPopover';

interface SimulatedLLMDepthCardProps {
  analysis: StrategicAnalysis;
  domain?: string;
}

interface SimulatedModelResult {
  llm: string;
  depth: number;
  found: boolean;
}

/**
 * Generates coherent simulated LLM depth data based on:
 * - EEAT score (0-10) → higher = more likely to be found early
 * - GEO score (0-100) → higher = better overall depth
 * - Sector context → adjusts variance between models
 */
function generateSimulatedDepth(analysis: StrategicAnalysis): {
  avgDepth: number;
  results: SimulatedModelResult[];
  interpretation: string;
} {
  // Extract signals
  const eeatScore = analysis.social_signals?.thought_leadership?.eeat_score ?? 5;
  const geoScore = analysis.geo_score?.score ?? (analysis.geo_readiness?.citability_score ?? 50);
  const overallScore = analysis.overallScore ?? 50;
  const hasLLMVisibility = !!analysis.llm_visibility_raw?.citationRate;
  const citationRate = hasLLMVisibility
    ? (analysis.llm_visibility_raw!.citationRate!.cited / Math.max(1, analysis.llm_visibility_raw!.citationRate!.total))
    : 0.5;

  // Base depth: inversely proportional to quality signals
  // EEAT 10 + GEO 100 → depth ~1.5 (excellent)
  // EEAT 0 + GEO 0 → depth ~7+ (invisible)
  const normalizedEeat = eeatScore / 10; // 0-1
  const normalizedGeo = geoScore / 100; // 0-1
  const normalizedOverall = overallScore / 100; // 0-1

  const qualitySignal = (normalizedEeat * 0.4 + normalizedGeo * 0.3 + normalizedOverall * 0.2 + citationRate * 0.1);
  
  // Map quality signal (0-1) to depth (1-8)
  const baseDepth = Math.max(1, Math.min(8, 8 - qualitySignal * 6.5));

  // Per-model variation (some LLMs cite brands more easily)
  const modelVariances: Record<string, number> = {
    'ChatGPT': -0.3,   // Tends to cite earlier
    'Gemini': 0.1,      // Slightly harder
    'Claude': 0.4,      // More conservative
    'Perplexity': -0.8, // Best at citing (search-based)
  };

  const results: SimulatedModelResult[] = Object.entries(modelVariances).map(([llm, variance]) => {
    const modelDepth = Math.max(1, Math.min(8, baseDepth + variance + (Math.random() * 0.6 - 0.3)));
    const roundedDepth = Math.round(modelDepth * 10) / 10;
    // Found if depth <= 7
    const found = roundedDepth <= 7;
    return {
      llm,
      depth: found ? Math.round(roundedDepth) : 8,
      found,
    };
  });

  const avgDepth = results.length > 0 ? parseFloat((results.reduce((acc, r) => acc + r.depth, 0) / results.length).toFixed(1)) : 0;

  // Generate interpretation
  let interpretation: string;
  if (avgDepth <= 2) {
    interpretation = 'Votre marque est rapidement citée dans les conversations LLM. Excellente découvrabilité conversationnelle.';
  } else if (avgDepth <= 4) {
    interpretation = 'Votre marque est citée après quelques échanges. Bon niveau de visibilité mais un renforcement E-E-A-T pourrait l\'améliorer.';
  } else if (avgDepth <= 6) {
    interpretation = 'Il faut plusieurs échanges spécifiques pour que les LLMs mentionnent votre marque. Travaillez votre contenu de niche et vos signaux d\'autorité.';
  } else {
    interpretation = 'Les LLMs peinent à citer votre marque même après des questions très ciblées. Priorité : renforcer votre présence web et vos signaux E-E-A-T.';
  }

  return { avgDepth, results, interpretation };
}

function depthColor(depth: number): string {
  if (depth <= 1) return 'text-green-600 dark:text-green-400';
  if (depth <= 3) return 'text-emerald-600 dark:text-emerald-400';
  if (depth <= 5) return 'text-yellow-600 dark:text-yellow-400';
  if (depth <= 7) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function depthLabel(depth: number): string {
  if (depth <= 1) return 'Excellent';
  if (depth <= 3) return 'Bon';
  if (depth <= 5) return 'Moyen';
  if (depth <= 7) return 'Faible';
  return 'Invisible';
}

export function SimulatedLLMDepthCard({ analysis, domain }: SimulatedLLMDepthCardProps) {
  const { avgDepth, results, interpretation } = generateSimulatedDepth(analysis);

  return (
    <Card className="border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <Layers className="h-4.5 w-4.5 text-violet-500" />
            </div>
            Profondeur LLM
          </CardTitle>
          <Badge className={`${depthColor(avgDepth)} bg-transparent border-current`}>
            {avgDepth} / 7
          </Badge>
        </div>
        <CardDescription>
          Estimation de la profondeur conversationnelle nécessaire pour citer {domain || 'votre marque'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average depth gauge */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="text-xs text-muted-foreground">Profondeur moyenne estimée</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${depthColor(avgDepth)}`}>
              {avgDepth}
            </span>
            <span className="text-xs text-muted-foreground">/ 7 itérations</span>
            <Badge variant="outline" className={`text-[10px] ml-auto ${depthColor(avgDepth)}`}>
              {depthLabel(avgDepth)}
            </Badge>
          </div>
        </div>

        {/* Per-model results */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {results.map((r) => (
            <div key={r.llm} className="rounded-lg border bg-card p-2.5 text-center space-y-1">
              <div className="flex items-center justify-center gap-1">
                {r.found ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-400" />
                )}
                <span className="text-xs font-medium">{r.llm}</span>
              </div>
              <span className={`text-lg font-semibold ${depthColor(r.depth)}`}>
                {r.found ? r.depth : '7+'}
              </span>
            </div>
          ))}
        </div>

        {/* Interpretation */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm text-muted-foreground">{interpretation}</p>
        </div>

        <MethodologyPopover variant="llm_visibility" />
      </CardContent>
    </Card>
  );
}
