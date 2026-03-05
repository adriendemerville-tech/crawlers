import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircleQuestion, ArrowRight, Sparkles } from 'lucide-react';
import { StrategicAnalysis } from '@/types/expertAudit';

interface ConversationalIntentCardProps {
  analysis: StrategicAnalysis;
}

// Examples of classic → conversational rewrites
const rewriteExamples = [
  { before: 'Optimisation SEO', after: 'Comment optimiser son SEO en 2026 ?' },
  { before: 'Stratégie de contenu', after: 'Quelle stratégie de contenu adopter pour être cité par l\'IA ?' },
  { before: 'Marketing digital', after: 'Comment le marketing digital évolue-t-il avec l\'IA générative ?' },
  { before: 'Analyse concurrentielle', after: 'Comment analyser ses concurrents face aux moteurs IA ?' },
];

export function ConversationalIntentCard({ analysis }: ConversationalIntentCardProps) {
  // Derive a conversational score from available data
  const geoFormats = analysis.geo_readiness?.ai_favored_formats;
  const hasFaq = geoFormats?.has_faq ?? false;
  const formatScore = geoFormats?.format_score ?? 30;

  // Simulate a ratio: classic vs question-based headings
  const conversationalRatio = Math.min(100, Math.round(formatScore * 0.8 + (hasFaq ? 15 : 0)));
  const genericPercent = 100 - conversationalRatio;

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
      <Card className="border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <MessageCircleQuestion className="h-5 w-5 text-accent-foreground" />
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
                Les IA répondent à des <span className="font-semibold">questions</span>, pas à des mots-clés.{' '}
                <span className="font-bold text-warning">{genericPercent}%</span> de vos titres sont trop génériques pour
                déclencher une recommandation IA.
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
              Avant / Après — Reformulations conversationnelles
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
                  <span className="text-muted-foreground line-through flex-shrink-0 max-w-[35%] truncate">{ex.before}</span>
                  <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="font-medium text-foreground">{ex.after}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
