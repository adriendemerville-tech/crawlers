import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircleQuestion, ArrowRight, Sparkles, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StrategicAnalysis } from '@/types/expertAudit';

interface ConversationalIntentCardProps {
  analysis: StrategicAnalysis;
}

// Fallback generic examples (only used if LLM didn't provide any)
const fallbackExamples = [
  { before: 'Optimisation SEO', after: 'Comment optimiser son SEO en 2026 ?' },
  { before: 'Stratégie de contenu', after: 'Quelle stratégie de contenu adopter pour être cité par l\'IA ?' },
];

export function ConversationalIntentCard({ analysis }: ConversationalIntentCardProps) {
  // Try to get conversational_intent data from the raw strategic analysis
  const rawIntent = (analysis as any)?.conversational_intent;
  
  // Use LLM-provided data if available
  const conversationalRatio = rawIntent?.ratio ?? (() => {
    const geoFormats = analysis.geo_readiness?.ai_favored_formats;
    const hasFaq = geoFormats?.has_faq ?? false;
    const formatScore = geoFormats?.format_score ?? 30;
    return Math.min(100, Math.round(formatScore * 0.8 + (hasFaq ? 15 : 0)));
  })();
  
  const genericPercent = 100 - conversationalRatio;
  const intentAnalysis = rawIntent?.analysis || '';
  
  // Build rewrite examples from LLM-provided examples
  const llmExamples: string[] = rawIntent?.examples || [];
  const rewriteExamples = llmExamples.length > 0
    ? llmExamples.slice(0, 5).map((ex: string) => ({
        before: ex.replace(/\s*\?.*$/, '').split(' ').slice(0, 4).join(' '),
        after: ex,
      }))
    : fallbackExamples;

  // Score ring
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (conversationalRatio / 100) * circumference;

  const getColor = () => {
    if (conversationalRatio >= 70) return 'hsl(var(--success))';
    if (conversationalRatio >= 40) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <MessageCircleQuestion className="h-4.5 w-4.5 text-accent-foreground" />
            </div>
            Test d'Intention Conversationnelle
            <Badge variant="secondary" className="ml-auto text-xs">
              <Sparkles className="mr-1 h-3 w-3" />
              Sémantique IA
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Score ring */}
            <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90">
                <circle
                  cx={size / 2} cy={size / 2} r={radius}
                  fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth}
                  className="opacity-30"
                />
                <motion.circle
                  cx={size / 2} cy={size / 2} r={radius}
                  fill="none" stroke={getColor()} strokeWidth={strokeWidth}
                  strokeDasharray={circumference} strokeLinecap="round"
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className="text-3xl font-bold"
                  style={{ color: getColor() }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {conversationalRatio}%
                </motion.span>
                <span className="text-[10px] text-muted-foreground">optimisé</span>
              </div>
            </div>

            {/* Impact text */}
            <div className="flex-1 space-y-2">
              <p className="text-sm leading-relaxed text-foreground">
                {intentAnalysis || (
                  <>
                    Les IA répondent à des <span className="font-semibold">questions</span>, pas à des mots-clés.{' '}
                    <span className="font-bold text-warning">{genericPercent}%</span> de vos titres sont trop génériques pour
                    déclencher une recommandation IA.
                  </>
                )}
              </p>
              <div className="flex gap-3 text-xs">
                <div className="rounded-md bg-muted/50 px-3 py-1.5">
                  <span className="text-muted-foreground">Titres classiques</span>
                  <span className="ml-2 font-bold text-foreground">{genericPercent}%</span>
                </div>
                <div className="rounded-md bg-primary/10 px-3 py-1.5">
                  <span className="text-muted-foreground">Questions naturelles</span>
                  <span className="ml-2 font-bold text-primary">{conversationalRatio}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Before/After rewrite list */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {llmExamples.length > 0 ? 'Reformulations adaptées à votre activité' : 'Avant / Après — Reformulations conversationnelles'}
            </p>
            <div className="space-y-2">
              {rewriteExamples.map((ex, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-muted/30 p-3 text-sm"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  {llmExamples.length > 0 ? (
                    <span className="font-medium text-foreground">{ex.after}</span>
                  ) : (
                    <>
                      <span className="text-muted-foreground line-through flex-shrink-0 max-w-[35%] truncate">{ex.before}</span>
                      <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">{ex.after}</span>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Methodology button */}
          <div className="flex justify-end pt-1">
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                  <Info className="h-3 w-3" />
                  Méthodologie
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                sideOffset={8}
                collisionPadding={16}
                className="w-72 p-3 text-xs leading-relaxed text-foreground/90 backdrop-blur-xl bg-background/80 border border-border/50 shadow-xl rounded-lg z-50"
              >
                Crawlers analyse les balises Title et H1-H3 de la page, identifie celles formulées en questions naturelles (qui, quoi, comment, pourquoi…), et calcule le ratio par rapport aux titres classiques à mots-clés. Un score élevé signifie que le contenu est structuré pour être repris dans les réponses conversationnelles.
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
