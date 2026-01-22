import { LLMAnalysisResult } from '@/types/llm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  ExternalLink, 
  Clock, 
  Eye, 
  EyeOff, 
  ThumbsUp, 
  ThumbsDown,
  Minus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LLMDashboardProps {
  result: LLMAnalysisResult | null;
  isLoading: boolean;
}

function ScoreGauge({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-success';
    if (s >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreRingColor = (s: number) => {
    if (s >= 80) return 'stroke-success';
    if (s >= 50) return 'stroke-warning';
    return 'stroke-destructive';
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn("transition-all duration-1000", getScoreRingColor(score))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold", getScoreColor(score))}>{score}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) {
  const config = {
    positive: { icon: ThumbsUp, label: 'Positive', className: 'bg-success/10 text-success border-success/20' },
    neutral: { icon: Minus, label: 'Neutral', className: 'bg-warning/10 text-warning border-warning/20' },
    negative: { icon: ThumbsDown, label: 'Negative', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  };
  
  const { icon: Icon, label, className } = config[sentiment];
  
  return (
    <Badge variant="outline" className={cn("gap-1.5 px-3 py-1.5", className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

export function LLMDashboard({ result, isLoading }: LLMDashboardProps) {
  if (isLoading) {
    return (
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 rounded-xl border border-border bg-card p-8 card-shadow">
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
              <div className="flex flex-col items-center lg:items-start">
                <Skeleton className="mb-2 h-6 w-32" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="mt-2 h-4 w-36" />
              </div>
              <Skeleton className="h-36 w-36 rounded-full" />
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!result) return null;

  return (
    <section className="px-4 pb-12">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header with score */}
        <div className="rounded-xl border border-border bg-card p-8 card-shadow">
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
            <div className="flex flex-col items-center lg:items-start">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">LLM Visibility Analysis</span>
              </div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                {result.domain}
                <a 
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </h2>
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(result.scannedAt).toLocaleTimeString()}
                </span>
                <span>{result.citationRate.cited}/{result.citationRate.total} LLMs cite this domain</span>
              </div>
            </div>

            <div className="text-center">
              <ScoreGauge score={result.overallScore} />
              <p className="mt-2 text-sm font-medium text-muted-foreground">Overall Visibility</p>
            </div>
          </div>
        </div>

        {/* Quantitative Dashboard */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Citation Rate Card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5 text-primary" />
                Citation Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl font-bold text-foreground">
                  {result.citationRate.cited}
                  <span className="text-lg text-muted-foreground">/{result.citationRate.total}</span>
                </span>
                <span className={cn(
                  "text-sm font-medium px-2 py-1 rounded-full",
                  result.citationRate.cited >= result.citationRate.total * 0.7
                    ? "bg-success/10 text-success"
                    : result.citationRate.cited >= result.citationRate.total * 0.4
                    ? "bg-warning/10 text-warning"
                    : "bg-destructive/10 text-destructive"
                )}>
                  {Math.round((result.citationRate.cited / result.citationRate.total) * 100)}% coverage
                </span>
              </div>
              <Progress 
                value={(result.citationRate.cited / result.citationRate.total) * 100} 
                className="h-2"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                LLMs that mentioned this domain in their responses
              </p>
            </CardContent>
          </Card>

          {/* Invisible List Card */}
          <Card className="overflow-hidden border-warning/30">
            <CardHeader className="pb-3 bg-warning/5">
              <CardTitle className="flex items-center gap-2 text-base text-warning">
                <EyeOff className="h-5 w-5" />
                The "Invisible" List
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {result.invisibleList.length === 0 ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Visible across all LLMs!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {result.invisibleList.map((provider) => (
                    <div 
                      key={provider.id}
                      className="flex items-center justify-between rounded-lg bg-warning/5 px-3 py-2"
                    >
                      <span className="font-medium text-foreground">{provider.name}</span>
                      <span className="text-sm text-muted-foreground">{provider.company}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Qualitative Analysis */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Iteration Depth */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-primary" />
                Iteration Depth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <span className="text-3xl font-bold text-foreground">
                  {result.averageIterationDepth.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground ml-1">avg. prompts</span>
              </div>
              <Progress 
                value={(5 - result.averageIterationDepth) / 4 * 100} 
                className={cn(
                  "h-2",
                  result.averageIterationDepth <= 2 
                    ? "[&>div]:bg-success" 
                    : result.averageIterationDepth <= 3.5
                    ? "[&>div]:bg-warning"
                    : "[&>div]:bg-destructive"
                )}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                {result.averageIterationDepth <= 2 
                  ? "Excellent! LLMs mention you immediately."
                  : result.averageIterationDepth <= 3.5
                  ? "Moderate depth. Consider improving authority signals."
                  : "Deep iteration needed. Improve structured data."}
              </p>
            </CardContent>
          </Card>

          {/* Sentiment Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-primary" />
                Sentiment Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <SentimentBadge sentiment={result.overallSentiment} />
                <p className="text-sm text-muted-foreground">
                  {result.overallSentiment === 'positive'
                    ? "LLMs speak favorably about your brand and content."
                    : result.overallSentiment === 'negative'
                    ? "Some negative perceptions detected. Review content quality."
                    : "Neutral perception. Opportunity to build stronger reputation."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {result.overallRecommendation ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                Recommendation Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                result.overallRecommendation
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}>
                {result.overallRecommendation ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    LLMs recommend this site
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Not explicitly recommended
                  </>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {result.overallRecommendation
                  ? "Your site is actively recommended by LLMs."
                  : "Work on E-E-A-T signals to gain recommendations."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Core Value Understanding */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Core Value Understanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-foreground leading-relaxed">
                {result.coreValueSummary}
              </p>
            </div>
            {result.citations.some(c => c.hallucinations && c.hallucinations.length > 0) && (
              <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-warning mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Potential Hallucinations Detected
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {result.citations
                    .filter(c => c.hallucinations && c.hallucinations.length > 0)
                    .flatMap(c => c.hallucinations!)
                    .slice(0, 3)
                    .map((h, i) => (
                      <li key={i}>• {h}</li>
                    ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Individual LLM Cards */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Detailed LLM Analysis</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {result.citations.map((citation) => (
              <Card 
                key={citation.provider.id}
                className={cn(
                  "transition-all",
                  citation.cited 
                    ? "border-success/30 bg-success/5" 
                    : "border-destructive/30 bg-destructive/5"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{citation.provider.name}</p>
                      <p className="text-xs text-muted-foreground">{citation.provider.company}</p>
                    </div>
                    {citation.cited ? (
                      <Eye className="h-5 w-5 text-success" />
                    ) : (
                      <EyeOff className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  
                  {citation.cited && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Iterations:</span>
                        <span className={cn(
                          "font-medium",
                          citation.iterationDepth <= 2 ? "text-success" : 
                          citation.iterationDepth <= 3 ? "text-warning" : "text-destructive"
                        )}>
                          {citation.iterationDepth}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Sentiment:</span>
                        <SentimentBadge sentiment={citation.sentiment} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Recommends:</span>
                        {citation.recommends ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!citation.cited && (
                    <p className="text-sm text-muted-foreground">
                      Not mentioned by this LLM
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
