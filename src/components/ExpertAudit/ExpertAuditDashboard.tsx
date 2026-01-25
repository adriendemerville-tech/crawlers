import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Zap, Settings2, FileText, Brain, Shield, 
  ExternalLink, Search, Sparkles 
} from 'lucide-react';
import { ScoreGauge200 } from './ScoreGauge200';
import { CategoryCard, MetricRow } from './CategoryCard';
import { RecommendationList } from './RecommendationList';
import { LoadingSteps } from './LoadingSteps';
import { StrategicInsights } from './StrategicInsights';
import { ExpertAuditResult, StrategicAnalysis } from '@/types/expertAudit';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function ExpertAuditDashboard() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStrategicLoading, setIsStrategicLoading] = useState(false);
  const [result, setResult] = useState<ExpertAuditResult | null>(null);
  const { toast } = useToast();
  const { language } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      // Step 1: Run expert-audit
      const { data, error } = await supabase.functions.invoke('expert-audit', {
        body: { url: url.trim() }
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Audit failed');

      // Set initial result
      const auditResult = data.data as ExpertAuditResult;
      setResult(auditResult);
      setIsLoading(false);

      // Step 2: Run strategic AI analysis in background
      setIsStrategicLoading(true);
      
      try {
        // Prepare toolsData for strategic audit
        const toolsData = {
          crawlers: null, // We don't have this data in expert-audit
          geo: {
            hasSchemaOrg: auditResult.scores.aiReady.hasSchemaOrg,
            schemaTypes: auditResult.scores.aiReady.schemaTypes,
            robotsPermissive: auditResult.scores.aiReady.robotsPermissive,
          },
          llm: {
            semanticScore: auditResult.scores.semantic.score,
            wordCount: auditResult.scores.semantic.wordCount,
            hasTitle: auditResult.scores.semantic.hasTitle,
            hasMetaDesc: auditResult.scores.semantic.hasMetaDesc,
          },
          pagespeed: {
            performance: auditResult.scores.performance.psiPerformance,
            lcp: auditResult.scores.performance.lcp,
            cls: auditResult.scores.performance.cls,
            tbt: auditResult.scores.performance.tbt,
            seoScore: auditResult.scores.technical.psiSeo,
          },
        };

        const { data: strategicData, error: strategicError } = await supabase.functions.invoke('audit-strategic', {
          body: { url: url.trim(), toolsData }
        });

        if (!strategicError && strategicData?.success) {
          // Merge strategic analysis into result
          setResult(prev => prev ? {
            ...prev,
            strategicAnalysis: {
              brandPerception: strategicData.data.brandPerception,
              geoAnalysis: strategicData.data.geoAnalysis,
              llmVisibility: strategicData.data.llmVisibility,
              testQueries: strategicData.data.testQueries,
              executiveSummary: strategicData.data.executiveSummary,
              overallScore: strategicData.data.overallScore,
            }
          } : null);
          
          toast({
            title: 'Analyse IA terminée !',
            description: 'Les recommandations stratégiques sont disponibles.',
          });
        }
      } catch (strategicErr) {
        console.error('Strategic analysis error:', strategicErr);
        // Don't fail the whole audit, just skip strategic analysis
      } finally {
        setIsStrategicLoading(false);
      }

      toast({
        title: 'Audit terminé !',
        description: `Score global : ${data.data.totalScore}/200`,
      });
    } catch (error) {
      console.error('Audit error:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Échec de l\'audit',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-4">
          <Sparkles className="h-3 w-3 mr-1" />
          Audit Expert SEO & IA
        </Badge>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Analysez votre site en profondeur
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Score global sur 200 points couvrant Performance, Technique SEO, Sémantique, 
          Préparation IA/GEO et Sécurité.
        </p>
      </div>

      {/* Search Form */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10 h-12 text-lg"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" size="lg" disabled={isLoading || !url.trim()}>
              {isLoading ? 'Analyse...' : 'Lancer l\'Audit'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && <LoadingSteps />}

      {/* Results */}
      {result && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Hero Score */}
          <Card className="bg-gradient-to-br from-card via-card to-muted/30 border-2">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="text-center md:text-left">
                  <h2 className="text-2xl font-bold text-foreground mb-2">{result.domain}</h2>
                  <a 
                    href={result.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                  >
                    {result.url} <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="mt-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Score Global</p>
                    <p className="text-lg">
                      {result.totalScore < 100 && <span className="text-destructive font-medium">À améliorer</span>}
                      {result.totalScore >= 100 && result.totalScore < 150 && <span className="text-warning font-medium">Correct</span>}
                      {result.totalScore >= 150 && <span className="text-success font-medium">Excellent</span>}
                    </p>
                  </div>
                </div>
                <ScoreGauge200 score={result.totalScore} />
              </div>
            </CardContent>
          </Card>

          {/* Category Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Performance */}
            <CategoryCard
              icon={<Zap className="h-5 w-5" />}
              title="Performance"
              score={result.scores.performance.score}
              maxScore={result.scores.performance.maxScore}
              variant="performance"
            >
              <MetricRow 
                label="Score PSI" 
                value={`${result.scores.performance.psiPerformance}%`} 
                status={result.scores.performance.psiPerformance >= 90 ? 'good' : result.scores.performance.psiPerformance >= 50 ? 'warning' : 'bad'}
              />
              <MetricRow 
                label="LCP" 
                value={formatMs(result.scores.performance.lcp)} 
                status={result.scores.performance.lcp <= 2500 ? 'good' : result.scores.performance.lcp <= 4000 ? 'warning' : 'bad'}
              />
              <MetricRow 
                label="CLS" 
                value={result.scores.performance.cls.toFixed(3)} 
                status={result.scores.performance.cls <= 0.1 ? 'good' : result.scores.performance.cls <= 0.25 ? 'warning' : 'bad'}
              />
              <MetricRow 
                label="TBT" 
                value={formatMs(result.scores.performance.tbt)} 
                status={result.scores.performance.tbt <= 200 ? 'good' : result.scores.performance.tbt <= 600 ? 'warning' : 'bad'}
              />
            </CategoryCard>

            {/* Technical */}
            <CategoryCard
              icon={<Settings2 className="h-5 w-5" />}
              title="Socle Technique"
              score={result.scores.technical.score}
              maxScore={result.scores.technical.maxScore}
              variant="technical"
            >
              <MetricRow 
                label="Score SEO PSI" 
                value={`${result.scores.technical.psiSeo}%`} 
                status={result.scores.technical.psiSeo >= 90 ? 'good' : result.scores.technical.psiSeo >= 70 ? 'warning' : 'bad'}
              />
              <MetricRow label="Status HTTP" value={result.scores.technical.httpStatus} status="good" />
              <MetricRow label="HTTPS" value={result.scores.technical.isHttps} />
            </CategoryCard>

            {/* Semantic */}
            <CategoryCard
              icon={<FileText className="h-5 w-5" />}
              title="Sémantique & Contenu"
              score={result.scores.semantic.score}
              maxScore={result.scores.semantic.maxScore}
              variant="semantic"
            >
              <MetricRow 
                label="Balise Title" 
                value={result.scores.semantic.hasTitle ? `${result.scores.semantic.titleLength} car.` : 'Absente'} 
                status={result.scores.semantic.hasTitle && result.scores.semantic.titleLength <= 70 ? 'good' : 'bad'}
              />
              <MetricRow label="Meta Description" value={result.scores.semantic.hasMetaDesc} />
              <MetricRow 
                label="H1 unique" 
                value={result.scores.semantic.hasUniqueH1 ? 'Oui' : `${result.scores.semantic.h1Count} trouvés`} 
                status={result.scores.semantic.hasUniqueH1 ? 'good' : 'bad'}
              />
              <MetricRow 
                label="Contenu" 
                value={`~${result.scores.semantic.wordCount} mots`} 
                status={result.scores.semantic.wordCount >= 500 ? 'good' : 'warning'}
              />
            </CategoryCard>

            {/* AI Ready */}
            <CategoryCard
              icon={<Brain className="h-5 w-5" />}
              title="Préparation IA & GEO"
              score={result.scores.aiReady.score}
              maxScore={result.scores.aiReady.maxScore}
              variant="ai"
            >
              <MetricRow label="Schema.org (JSON-LD)" value={result.scores.aiReady.hasSchemaOrg} />
              {result.scores.aiReady.schemaTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 py-1">
                  {result.scores.aiReady.schemaTypes.slice(0, 3).map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                  ))}
                </div>
              )}
              <MetricRow label="Robots.txt" value={result.scores.aiReady.hasRobotsTxt} />
              <MetricRow 
                label="Permissif aux bots" 
                value={result.scores.aiReady.robotsPermissive} 
                status={result.scores.aiReady.robotsPermissive ? 'good' : 'warning'}
              />
            </CategoryCard>

            {/* Security */}
            <CategoryCard
              icon={<Shield className="h-5 w-5" />}
              title="Santé & Sécurité"
              score={result.scores.security.score}
              maxScore={result.scores.security.maxScore}
              variant="security"
            >
              <MetricRow label="HTTPS activé" value={result.scores.security.isHttps} />
              <MetricRow 
                label="Safe Browsing" 
                value={result.scores.security.safeBrowsingOk ? 'OK' : 'Menaces détectées'} 
                status={result.scores.security.safeBrowsingOk ? 'good' : 'bad'}
              />
              {result.scores.security.threats.length > 0 && (
                <div className="text-xs text-destructive">
                  Menaces : {result.scores.security.threats.join(', ')}
                </div>
              )}
            </CategoryCard>
          </div>

          {/* Strategic AI Insights */}
          {isStrategicLoading && (
            <Card className="border-dashed border-primary/30">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3">
                  <Brain className="h-5 w-5 animate-pulse text-primary" />
                  <span className="text-muted-foreground">Analyse stratégique IA en cours...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {result.strategicAnalysis && !isStrategicLoading && (
            <StrategicInsights analysis={result.strategicAnalysis} />
          )}

          {/* Recommendations */}
          <RecommendationList recommendations={result.recommendations} />

          {/* Timestamp */}
          <p className="text-center text-xs text-muted-foreground">
            Audit généré le {new Date(result.scannedAt).toLocaleString('fr-FR')}
          </p>
        </motion.div>
      )}
    </div>
  );
}
