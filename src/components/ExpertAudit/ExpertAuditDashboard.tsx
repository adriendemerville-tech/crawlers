import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Zap, Settings2, FileText, Brain, Shield, 
  ExternalLink, Search, Sparkles, BarChart3, Target
} from 'lucide-react';
import { ScoreGauge200 } from './ScoreGauge200';
import { CategoryCard, MetricRow } from './CategoryCard';
import { RecommendationList } from './RecommendationList';
import { LoadingSteps } from './LoadingSteps';
import { StrategicInsights } from './StrategicInsights';
import { IntroductionCard } from './IntroductionCard';
import { ExpertInsightsCard } from './ExpertInsightsCard';
import { EmailGateCard } from './EmailGateCard';
import { ExpertAuditResult } from '@/types/expertAudit';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const EMAIL_SESSION_KEY = 'crawlers_audit_email';

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

type AuditMode = 'technical' | 'strategic' | null;

const translations = {
  fr: {
    badge: 'Audit Expert SEO & IA',
    title: 'Analysez votre site en profondeur',
    subtitle: 'Choisissez le type d\'audit adapté à vos besoins',
    technicalTitle: 'Audit Technique SEO',
    technicalDesc: 'Performance, SEO, sécurité, Core Web Vitals. Score sur 200 points.',
    strategicTitle: 'Audit Stratégique IA',
    strategicDesc: 'Analyse de positionnement, citabilité LLM, stratégie GEO 2026.',
    placeholder: 'example.com',
    launch: 'Démarrer',
    analyzing: 'Analyse...',
    auditComplete: 'Audit terminé !',
    globalScore: 'Score global',
    strategicComplete: 'Analyse IA terminée !',
    strategicDesc2: 'Les recommandations stratégiques sont disponibles.',
    error: 'Erreur',
    auditFailed: 'Échec de l\'audit',
    toImprove: 'À améliorer',
    correct: 'Correct',
    excellent: 'Excellent',
    generatedAt: 'Audit généré le',
    or: 'ou',
  },
  en: {
    badge: 'Expert SEO & AI Audit',
    title: 'Analyze your site in depth',
    subtitle: 'Choose the audit type suited to your needs',
    technicalTitle: 'Technical SEO Audit',
    technicalDesc: 'Performance, SEO, security, Core Web Vitals. Score out of 200 points.',
    strategicTitle: 'Strategic AI Audit',
    strategicDesc: 'Positioning analysis, LLM citability, GEO 2026 strategy.',
    placeholder: 'example.com',
    launch: 'Start',
    analyzing: 'Analyzing...',
    auditComplete: 'Audit complete!',
    globalScore: 'Global score',
    strategicComplete: 'AI analysis complete!',
    strategicDesc2: 'Strategic recommendations are available.',
    error: 'Error',
    auditFailed: 'Audit failed',
    toImprove: 'Needs improvement',
    correct: 'Good',
    excellent: 'Excellent',
    generatedAt: 'Audit generated on',
    or: 'or',
  },
  es: {
    badge: 'Auditoría Experta SEO e IA',
    title: 'Analiza tu sitio en profundidad',
    subtitle: 'Elige el tipo de auditoría adaptado a tus necesidades',
    technicalTitle: 'Auditoría Técnica SEO',
    technicalDesc: 'Rendimiento, SEO, seguridad, Core Web Vitals. Puntuación sobre 200.',
    strategicTitle: 'Auditoría Estratégica IA',
    strategicDesc: 'Análisis de posicionamiento, citabilidad LLM, estrategia GEO 2026.',
    placeholder: 'example.com',
    launch: 'Iniciar',
    analyzing: 'Analizando...',
    auditComplete: '¡Auditoría completa!',
    globalScore: 'Puntuación global',
    strategicComplete: '¡Análisis IA completo!',
    strategicDesc2: 'Las recomendaciones estratégicas están disponibles.',
    error: 'Error',
    auditFailed: 'Auditoría fallida',
    toImprove: 'A mejorar',
    correct: 'Correcto',
    excellent: 'Excelente',
    generatedAt: 'Auditoría generada el',
    or: 'o',
  },
};

export function ExpertAuditDashboard() {
  const [url, setUrl] = useState('');
  const [auditMode, setAuditMode] = useState<AuditMode>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStrategicLoading, setIsStrategicLoading] = useState(false);
  const [result, setResult] = useState<ExpertAuditResult | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  // Check for existing email in session on mount
  useEffect(() => {
    const storedEmail = sessionStorage.getItem(EMAIL_SESSION_KEY);
    if (storedEmail) {
      setUserEmail(storedEmail);
    }
  }, []);

  const handleEmailSubmit = (email: string) => {
    sessionStorage.setItem(EMAIL_SESSION_KEY, email);
    setUserEmail(email);
  };

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim();
    if (!normalized) return '';
    normalized = normalized.toLowerCase();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${input.trim()}`;
    } else {
      normalized = input.trim();
    }
    return normalized;
  };

  const handleTechnicalAudit = async () => {
    if (!url.trim()) return;
    const normalizedUrl = normalizeUrl(url);
    setAuditMode('technical');
    setIsLoading(true);
    setResult(null);

    try {
      // Call the new audit-expert-seo function
      const { data, error } = await supabase.functions.invoke('audit-expert-seo', {
        body: { url: normalizedUrl }
      });

      if (error) throw new Error(error.message);
      if (!data.success) {
        // Handle RENDERING_REQUIRED error specifically
        if (data.error === 'RENDERING_REQUIRED') {
          throw new Error(`Rendu JavaScript requis: ${data.message || 'Site SPA non accessible sans navigateur'}`);
        }
        throw new Error(data.error || 'Audit failed');
      }

      const auditResult = data.data as ExpertAuditResult;
      // Map scannedAt from meta if available
      if (auditResult.meta?.scannedAt && !auditResult.scannedAt) {
        auditResult.scannedAt = auditResult.meta.scannedAt;
      }
      setResult(auditResult);

      const reliabilityInfo = auditResult.meta?.reliabilityScore 
        ? ` (Fiabilité: ${Math.round(auditResult.meta.reliabilityScore * 100)}%)`
        : '';

      toast({
        title: t.auditComplete,
        description: `${t.globalScore} : ${data.data.totalScore}/200${reliabilityInfo}`,
      });
    } catch (error) {
      console.error('Audit error:', error);
      toast({
        title: t.error,
        description: error instanceof Error ? error.message : t.auditFailed,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStrategicAudit = async () => {
    if (!url.trim()) return;
    const normalizedUrl = normalizeUrl(url);
    setAuditMode('strategic');
    setIsStrategicLoading(true);
    setResult(null);

    try {
      // Run audit-strategique-ia directly (full strategic analysis)
      const { data, error } = await supabase.functions.invoke('audit-strategique-ia', {
        body: { url: normalizedUrl, toolsData: null }
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Strategic audit failed');

      // Create a minimal result structure for strategic display
      setResult({
        url: normalizedUrl,
        domain: new URL(normalizedUrl).hostname,
        totalScore: data.data.overallScore * 2,
        maxScore: 200,
        scores: {
          performance: { score: 0, maxScore: 40, psiPerformance: 0, lcp: 0, cls: 0, tbt: 0, fcp: 0 },
          technical: { score: 0, maxScore: 50, psiSeo: 0, httpStatus: 200, isHttps: true },
          semantic: { score: 0, maxScore: 60, hasTitle: false, titleLength: 0, hasMetaDesc: false, metaDescLength: 0, h1Count: 0, hasUniqueH1: false, wordCount: 0 },
          aiReady: { score: 0, maxScore: 30, hasSchemaOrg: false, schemaTypes: [], hasRobotsTxt: false, robotsPermissive: false },
          security: { score: 0, maxScore: 20, isHttps: true, safeBrowsingOk: true, threats: [] },
        },
        recommendations: [],
        rawData: { psi: null, safeBrowsing: null, htmlAnalysis: null },
        scannedAt: data.data.scannedAt || new Date().toISOString(),
        strategicAnalysis: {
          introduction: data.data.introduction,
          // New format fields
          brand_identity: data.data.brand_identity,
          market_positioning: data.data.market_positioning,
          geo_score: data.data.geo_score,
          strategic_roadmap: data.data.strategic_roadmap,
          executive_summary: data.data.executive_summary,
          // Legacy format fields (for backward compatibility)
          brandPerception: data.data.brandPerception,
          geoAnalysis: data.data.geoAnalysis,
          llmVisibility: data.data.llmVisibility,
          testQueries: data.data.testQueries,
          executiveSummary: data.data.executiveSummary,
          overallScore: data.data.overallScore || data.data.geo_score?.score,
        },
      });

      toast({
        title: t.strategicComplete,
        description: t.strategicDesc2,
      });
    } catch (error) {
      console.error('Strategic audit error:', error);
      toast({
        title: t.error,
        description: error instanceof Error ? error.message : t.auditFailed,
        variant: 'destructive',
      });
    } finally {
      setIsStrategicLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* Header - Premium SaaS style */}
      <div className="text-center mb-10">
        <Badge variant="outline" className="mb-4 text-xs font-medium tracking-wide uppercase">
          <Sparkles className="h-3 w-3 mr-1.5" />
          {t.badge}
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
          {t.title}
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-base">
          {t.subtitle}
        </p>
      </div>

      {/* URL Input - Clean minimal style */}
      <div className="mb-8">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t.placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="pl-12 h-14 text-lg bg-background border-border/60 focus:border-primary/50"
            disabled={isLoading || isStrategicLoading}
          />
        </div>
      </div>

      {/* Audit Type Selection - Premium Cards */}
      <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-8">
        {/* Technical Audit */}
        <Card 
          className={`relative overflow-hidden transition-all cursor-pointer ${
            auditMode === 'technical' 
              ? 'border-2 border-amber-400 shadow-[0_0_10px_-3px_rgba(251,191,36,0.4),inset_0_1px_0_0_rgba(255,255,255,0.2)]' 
              : 'border-border/60 hover:border-primary/50'
          }`}
          onClick={() => !isLoading && !isStrategicLoading && setAuditMode('technical')}
        >
          {auditMode === 'technical' && (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 via-transparent to-amber-400/10 pointer-events-none" />
          )}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/80" />
          <CardContent className="p-6 relative">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-md bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">{t.technicalTitle}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.technicalDesc}</p>
              </div>
            </div>
            {auditMode === 'technical' && (
              <Button 
                onClick={(e) => { e.stopPropagation(); handleTechnicalAudit(); }}
                disabled={isLoading || isStrategicLoading || !url.trim()}
                className="w-full mt-4 bg-primary hover:bg-primary/90 shadow-[2px_2px_6px_rgba(0,0,0,0.35)]"
              >
                {isLoading && auditMode === 'technical' ? t.analyzing : t.launch}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Strategic Audit */}
        <Card 
          className={`relative overflow-hidden transition-all cursor-pointer ${
            auditMode === 'strategic' 
              ? 'border-2 border-amber-400 shadow-[0_0_10px_-3px_rgba(251,191,36,0.4),inset_0_1px_0_0_rgba(255,255,255,0.2)]' 
              : 'border-border/60 hover:border-primary/50'
          }`}
          onClick={() => !isLoading && !isStrategicLoading && setAuditMode('strategic')}
        >
          {auditMode === 'strategic' && (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 via-transparent to-amber-400/10 pointer-events-none" />
          )}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-foreground/60 to-accent-foreground/40" />
          <CardContent className="p-6 relative">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-md bg-accent">
                <Target className="h-6 w-6 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">{t.strategicTitle}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.strategicDesc}</p>
              </div>
            </div>
            {auditMode === 'strategic' && (
              <Button 
                onClick={(e) => { e.stopPropagation(); handleStrategicAudit(); }}
                disabled={isLoading || isStrategicLoading || !url.trim()}
                className="w-full mt-4 bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[2px_2px_6px_rgba(0,0,0,0.35)]"
              >
                {isStrategicLoading ? t.analyzing : t.launch}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

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
          {/* Introduction en premier - Toujours en haut (AVANT le gate email) */}
          {result.introduction && auditMode === 'technical' && (
            <IntroductionCard introduction={result.introduction} variant="technical" />
          )}
          {result.strategicAnalysis?.introduction && auditMode === 'strategic' && (
            <IntroductionCard introduction={result.strategicAnalysis.introduction} variant="strategic" />
          )}

          {/* Email Gate + Blurred Content */}
          <div className="relative">
            {/* Blur overlay and email form when not authenticated */}
            {!userEmail && (
              <>
                <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-md rounded-lg" />
                <EmailGateCard onEmailSubmit={handleEmailSubmit} />
              </>
            )}

            {/* Content that gets blurred/unblurred */}
            <div className={`space-y-8 ${!userEmail ? 'pointer-events-none select-none' : ''}`}>
              
              {/* === TECHNICAL AUDIT CONTENT === */}
              {auditMode === 'technical' && (
                <>
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

                  {/* Category Cards Grid - ONLY for technical */}
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

                  {/* Expert Insights Card - Only for technical audit */}
                  {result.insights && (
                    <ExpertInsightsCard insights={result.insights} />
                  )}

                  {/* Recommendations */}
                  <RecommendationList recommendations={result.recommendations} />
                </>
              )}

              {/* === STRATEGIC AUDIT CONTENT === */}
              {auditMode === 'strategic' && (
                <>
                  {/* Strategic AI Insights Loading */}
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

                  {/* Strategic Insights - Brand Identity, GEO Score, Roadmap */}
                  {result.strategicAnalysis && !isStrategicLoading && (
                    <StrategicInsights analysis={result.strategicAnalysis} />
                  )}
                </>
              )}

              {/* Timestamp */}
              <p className="text-center text-xs text-muted-foreground">
                Audit généré le {new Date(result.scannedAt).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
