import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Target, Building2, Palette, Search, Brain, MessageSquare, 
  ChevronDown, ChevronUp, ExternalLink, CheckCircle2, AlertTriangle, 
  XCircle, Sparkles, Zap, FileText, Copy, Check
} from 'lucide-react';
import { StrategicAuditResult } from '@/types/audit';
import { useLanguage } from '@/contexts/LanguageContext';

interface StrategicAuditDashboardProps {
  result: StrategicAuditResult | null;
  isLoading: boolean;
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (score: number) => {
    if (score >= 80) return 'hsl(var(--success))';
    if (score >= 50) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: 'good' | 'warning' | 'error' | boolean }) {
  if (status === true || status === 'good') {
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  }
  if (status === 'warning') {
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  }
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function QueryCard({ query, index }: { query: { query: string; purpose: string; targetLLMs: string[] }; index: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(query.query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <p className="text-sm font-medium text-foreground mb-2">"{query.query}"</p>
        <p className="text-xs text-muted-foreground mb-2">{query.purpose}</p>
        <div className="flex flex-wrap gap-1">
          {query.targetLLMs.map((llm) => (
            <Badge key={llm} variant="secondary" className="text-xs">{llm}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StrategicAuditDashboard({ result, isLoading }: StrategicAuditDashboardProps) {
  const { language } = useLanguage();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    perception: true,
    visual: false,
    seo: false,
    geo: false,
    llm: false,
    queries: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center space-y-6 py-16">
          {/* Spinning loader */}
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-muted"></div>
            <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          
          {/* Animated "Analyse..." text */}
          <div className="flex items-center gap-1 text-lg font-medium text-foreground">
            <span>Analyse</span>
            <span className="inline-flex">
              <span className="animate-[bounce_1s_ease-in-out_infinite]">.</span>
              <span className="animate-[bounce_1s_ease-in-out_0.2s_infinite]">.</span>
              <span className="animate-[bounce_1s_ease-in-out_0.4s_infinite]">.</span>
            </span>
          </div>
          
          <p className="text-sm text-muted-foreground text-center max-w-md">
            L'intelligence artificielle analyse votre site en profondeur. 
            Cette opération peut prendre quelques secondes.
          </p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const getPositionLabel = (position: string) => {
    const labels: Record<string, Record<string, string>> = {
      'entry-level': { fr: 'Entrée de gamme', en: 'Entry Level', es: 'Entrada' },
      'mid-range': { fr: 'Milieu de gamme', en: 'Mid-Range', es: 'Gama Media' },
      'premium': { fr: 'Haut de gamme', en: 'Premium', es: 'Premium' },
    };
    return labels[position]?.[language] || position;
  };

  const getAudienceLabel = (audience: string) => {
    const labels: Record<string, Record<string, string>> = {
      'B2B': { fr: 'B2B (Professionnels)', en: 'B2B (Professionals)', es: 'B2B (Profesionales)' },
      'B2C': { fr: 'B2C (Grand public)', en: 'B2C (Consumers)', es: 'B2C (Consumidores)' },
      'Both': { fr: 'B2B & B2C', en: 'B2B & B2C', es: 'B2B & B2C' },
    };
    return labels[audience]?.[language] || audience;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-4">
          <Sparkles className="h-3 w-3 mr-1" />
          Audit Stratégique IA 2026
        </Badge>
        <h2 className="text-2xl font-bold text-foreground mb-2">{result.domain}</h2>
        <a 
          href={result.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          {result.url} <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Score Principal */}
      <Card className="mb-8 bg-gradient-to-br from-card to-muted/30">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-lg font-semibold text-foreground mb-2">Score de Citabilité 2026</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Capacité de votre site à être référencé comme source par les moteurs de recherche génératifs (SGE, Perplexity, ChatGPT).
              </p>
            </div>
            <ScoreRing score={result.overallScore} size={140} />
          </div>
        </CardContent>
      </Card>

      {/* Résumé Exécutif */}
      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Résumé Exécutif
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground leading-relaxed">{result.executiveSummary}</p>
        </CardContent>
      </Card>

      {/* Dashboard Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Perception de Marque */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Perception de Marque
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-xs text-muted-foreground">Cible</span>
              <p className="text-sm font-medium">{getAudienceLabel(result.brandPerception.targetAudience)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Positionnement</span>
              <p className="text-sm font-medium">{getPositionLabel(result.brandPerception.marketPosition)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Indice de Citabilité */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" />
              Indice de Citabilité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold">{result.geoAnalysis.citabilityIndex}</span>
              <Progress value={result.geoAnalysis.citabilityIndex} className="flex-1" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={result.geoAnalysis.hasFactualData ? 'default' : 'outline'} className="text-xs">
                Données factuelles
              </Badge>
              <Badge variant={result.geoAnalysis.hasComparativeTables ? 'default' : 'outline'} className="text-xs">
                Tableaux comparatifs
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Architecture SSR */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4 text-success" />
              Architecture SEO
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">SSR / Prérendu</span>
              <StatusIcon status={result.seoArchitecture.isSSR} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Budget de crawl</span>
              <Badge variant={result.seoArchitecture.crawlBudgetOptimization === 'good' ? 'default' : 'secondary'}>
                {result.seoArchitecture.crawlBudgetOptimization}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Hiérarchie sémantique</span>
              <Badge variant={result.seoArchitecture.semanticHierarchy === 'strong' ? 'default' : 'secondary'}>
                {result.seoArchitecture.semanticHierarchy}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Identité Visuelle */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="h-4 w-4 text-purple-500" />
              Identité Visuelle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Favicon SVG</span>
              <StatusIcon status={result.visualIdentity.faviconDetection.hasSvg} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">PNG 48x48</span>
              <StatusIcon status={result.visualIdentity.faviconDetection.hasPng48} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Apple Touch Icon</span>
              <StatusIcon status={result.visualIdentity.faviconDetection.hasAppleTouchIcon} />
            </div>
          </CardContent>
        </Card>

        {/* Autorité d'Entité */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-500" />
              Autorité d'Entité LLM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge 
              variant={result.llmVisibility.entityAuthority === 'high' ? 'default' : 'secondary'}
              className="mb-2"
            >
              {result.llmVisibility.entityAuthority === 'high' ? 'Haute' : 
               result.llmVisibility.entityAuthority === 'moderate' ? 'Modérée' : 'Faible'}
            </Badge>
            <div className="flex flex-wrap gap-1">
              {result.llmVisibility.ecosystemPresence.wikidata && (
                <Badge variant="outline" className="text-xs">Wikidata</Badge>
              )}
              {result.llmVisibility.ecosystemPresence.press && (
                <Badge variant="outline" className="text-xs">Presse</Badge>
              )}
              {result.llmVisibility.ecosystemPresence.reddit && (
                <Badge variant="outline" className="text-xs">Reddit</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Écosystème */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-500" />
              Présence Écosystème
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">Sources tierces détectées :</p>
            <div className="flex flex-wrap gap-1">
              {result.llmVisibility.ecosystemPresence.other.length > 0 ? (
                result.llmVisibility.ecosystemPresence.other.map((source) => (
                  <Badge key={source} variant="secondary" className="text-xs">{source}</Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">Aucune source tierce détectée</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Dépliable: Recommandations Détaillées */}
      <Collapsible open={expandedSections.perception} onOpenChange={() => toggleSection('perception')}>
        <Card className="mb-4">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Analyse de Perception de Marque
                </span>
                {expandedSections.perception ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Univers Sémantique</h4>
                <p className="text-sm text-muted-foreground">{result.brandPerception.semanticUniverse}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Proposition de Valeur</h4>
                <p className="text-sm text-muted-foreground">{result.brandPerception.valueProposition}</p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Recommandations GEO */}
      <Collapsible open={expandedSections.geo} onOpenChange={() => toggleSection('geo')}>
        <Card className="mb-4">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Stratégie GEO & Recommandations
                </span>
                {expandedSections.geo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Stratégie Contextuelle</h4>
                <p className="text-sm text-muted-foreground">{result.geoAnalysis.contextualStrategy}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Actions Prioritaires</h4>
                <ul className="space-y-2">
                  {result.geoAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Requêtes de Test LLM */}
      <Collapsible open={expandedSections.queries} onOpenChange={() => toggleSection('queries')}>
        <Card className="mb-4">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  10 Requêtes de Test LLM
                </span>
                {expandedSections.queries ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-4">
                Testez ces requêtes sur ChatGPT, Claude et Perplexity pour vérifier votre visibilité réelle.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.testQueries.map((query, i) => (
                  <QueryCard key={i} query={query} index={i} />
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Timestamp */}
      <p className="text-center text-xs text-muted-foreground">
        Audit généré le {new Date(result.scannedAt).toLocaleString(language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR')}
      </p>
    </div>
  );
}
