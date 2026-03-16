import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Zap, Settings2, FileText, Brain, Shield,
  ExternalLink, FileDown,
} from 'lucide-react';
import { ScoreGauge200 } from './ScoreGauge200';
import { CategoryCard, MetricRow } from './CategoryCard';
import { ActionPlan } from './ActionPlan';
import { IntroductionCard } from './IntroductionCard';
import { SPADetectionAlert } from './SPADetectionAlert';
import { ExpertInsightsCard } from './ExpertInsightsCard';
import { BrokenLinksCard } from './BrokenLinksCard';
import { TechnicalNarrativeSection } from './TechnicalNarrativeSection';
import { AIBotsCard } from './AIBotsCard';
import { ImageQualityCard } from './ImageQualityCard';
import { PageWeightCard } from './PageWeightCard';
import { DarkSocialCard } from './DarkSocialCard';
import { FreshnessSignalsCard } from './FreshnessSignalsCard';
import { ConversionFrictionCard } from './ConversionFrictionCard';
import { MethodologyPopover } from './MethodologyPopover';
import { ExpertAuditResult } from '@/types/expertAudit';

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

interface Props {
  result: ExpertAuditResult;
  t: Record<string, string>;
  onReportClick: () => void;
}

export function TechnicalResultsSection({ result, t, onReportClick }: Props) {
  const computedTotal = result.scores.performance.score + result.scores.technical.score + result.scores.semantic.score + result.scores.aiReady.score + result.scores.security.score;

  return (
    <>
      {/* Introduction */}
      {result.introduction && (
        <IntroductionCard introduction={result.introduction} variant="technical" />
      )}

      {/* SPA Detection Alert */}
      {result.isSPA && <SPADetectionAlert />}

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
                <p className="text-base font-semibold text-foreground">Score Global SEO</p>
                <p className="text-lg">
                  {computedTotal < 100 && <span className="text-destructive font-medium">{t.toImprove}</span>}
                  {computedTotal >= 100 && computedTotal < 150 && <span className="text-warning font-medium">{t.correct}</span>}
                  {computedTotal >= 150 && <span className="text-primary font-medium">{t.excellent}</span>}
                </p>
              </div>
            </div>
            <ScoreGauge200 score={computedTotal} />
          </div>
          <MethodologyPopover variant="global_score" />
        </CardContent>
      </Card>

      {/* Category Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CategoryCard icon={<Zap className="h-5 w-5" />} title="Performance" score={result.scores.performance.score} maxScore={result.scores.performance.maxScore} variant="performance">
          <MetricRow label="Score PSI" value={result.scores.performance.psiPerformance != null ? `${result.scores.performance.psiPerformance}%` : '~estimé'} status={result.scores.performance.psiPerformance == null ? 'warning' : result.scores.performance.psiPerformance >= 90 ? 'good' : result.scores.performance.psiPerformance >= 50 ? 'warning' : 'bad'} />
          <MetricRow label="LCP" value={result.scores.performance.lcp != null ? formatMs(result.scores.performance.lcp) : '—'} status={result.scores.performance.lcp == null ? 'warning' : result.scores.performance.lcp <= 2500 ? 'good' : 'warning'} />
          <MetricRow label="CLS" value={result.scores.performance.cls != null ? result.scores.performance.cls.toFixed(2) : '—'} status={result.scores.performance.cls == null ? 'warning' : result.scores.performance.cls <= 0.1 ? 'good' : 'warning'} />
          <MetricRow label="TBT" value={result.scores.performance.tbt != null ? formatMs(result.scores.performance.tbt) : '—'} status={result.scores.performance.tbt == null ? 'warning' : result.scores.performance.tbt <= 200 ? 'good' : 'warning'} />
          {result.scores.performance.psiUnavailable && (
            <p className="text-[10px] text-muted-foreground mt-1 italic">⚠️ PageSpeed indisponible — score estimé</p>
          )}
        </CategoryCard>

        <CategoryCard icon={<Settings2 className="h-5 w-5" />} title="Socle Technique" score={result.scores.technical.score} maxScore={result.scores.technical.maxScore} variant="technical">
          <MetricRow label="Score SEO PSI" value={result.scores.technical.psiSeo != null ? `${result.scores.technical.psiSeo}%` : '~estimé'} status={result.scores.technical.psiSeo == null ? 'warning' : result.scores.technical.psiSeo >= 90 ? 'good' : result.scores.technical.psiSeo >= 70 ? 'warning' : 'bad'} />
          <MetricRow label="Status HTTP" value={result.scores.technical.httpStatus} status="good" />
          <MetricRow label="HTTPS" value={result.scores.technical.isHttps} />
          {result.scores.technical.brokenLinksCount !== undefined && (
            <MetricRow label="Liens cassés" value={`${result.scores.technical.brokenLinksCount}/${result.scores.technical.brokenLinksChecked || 0}`} status={result.scores.technical.brokenLinksCount === 0 ? 'good' : result.scores.technical.brokenLinksCount <= 2 ? 'warning' : 'bad'} />
          )}
          {result.scores.technical.psiUnavailable && (
            <p className="text-[10px] text-muted-foreground mt-1 italic">⚠️ PageSpeed indisponible — score estimé</p>
          )}
        </CategoryCard>

        <CategoryCard icon={<FileText className="h-5 w-5" />} title="Sémantique & Contenu" score={result.scores.semantic.score} maxScore={result.scores.semantic.maxScore} variant="semantic">
          <MetricRow label="Balise Title" value={result.scores.semantic.hasTitle ? `${result.scores.semantic.titleLength} car.` : 'Absente'} status={result.scores.semantic.hasTitle && result.scores.semantic.titleLength <= 70 ? 'good' : 'bad'} />
          <MetricRow label="Meta Description" value={result.scores.semantic.hasMetaDesc} />
          <MetricRow label="H1 unique" value={result.scores.semantic.hasUniqueH1 ? 'Oui' : `${result.scores.semantic.h1Count} trouvés`} status={result.scores.semantic.hasUniqueH1 ? 'good' : 'bad'} />
          <MetricRow label="Contenu" value={`~${result.scores.semantic.wordCount} mots`} status={result.scores.semantic.wordCount >= 500 ? 'good' : 'warning'} />
        </CategoryCard>

        <CategoryCard icon={<Brain className="h-5 w-5" />} title="Préparation IA & GEO" score={result.scores.aiReady.score} maxScore={result.scores.aiReady.maxScore} variant="ai">
          <MetricRow label="Schema.org (JSON-LD)" value={result.scores.aiReady.hasSchemaOrg} />
          {result.scores.aiReady.schemaTypes.length > 0 && (
            <div className="flex flex-wrap gap-1 py-1">
              {result.scores.aiReady.schemaTypes.slice(0, 3).map((type) => (
                <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
              ))}
            </div>
          )}
          <MetricRow label="Robots.txt" value={result.scores.aiReady.hasRobotsTxt} />
          <MetricRow label="Permissif aux bots" value={result.scores.aiReady.robotsPermissive} status={result.scores.aiReady.robotsPermissive ? 'good' : 'warning'} />
        </CategoryCard>

        <CategoryCard icon={<Shield className="h-5 w-5" />} title="Santé & Sécurité" score={result.scores.security.score} maxScore={result.scores.security.maxScore} variant="security">
          <MetricRow label="HTTPS activé" value={result.scores.security.isHttps} />
          <MetricRow label="Safe Browsing" value={result.scores.security.safeBrowsingOk ? 'OK' : 'Menaces détectées'} status={result.scores.security.safeBrowsingOk ? 'good' : 'bad'} />
          {result.scores.security.threats.length > 0 && (
            <div className="text-xs text-destructive">Menaces : {result.scores.security.threats.join(', ')}</div>
          )}
        </CategoryCard>

        {result.rawData?.crawlersData && <AIBotsCard data={result.rawData.crawlersData} />}
      </div>

      {/* Dark Social, Freshness, Conversion Friction */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {result.rawData?.htmlAnalysis?.darkSocial && <DarkSocialCard data={result.rawData.htmlAnalysis.darkSocial} />}
        {result.rawData?.htmlAnalysis?.freshnessSignals && <FreshnessSignalsCard data={result.rawData.htmlAnalysis.freshnessSignals} />}
        {result.rawData?.htmlAnalysis?.conversionFriction && <ConversionFrictionCard data={result.rawData.htmlAnalysis.conversionFriction} />}
      </div>

      {/* Report Button */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex justify-center py-6">
        <Button onClick={onReportClick} size="lg" className="gap-3 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
          <FileDown className="h-5 w-5" />
          {t.viewReport}
        </Button>
      </motion.div>

      {/* Expert Insights */}
      {result.insights && <ExpertInsightsCard insights={result.insights} />}
      {result.insights?.brokenLinks && <BrokenLinksCard brokenLinks={result.insights.brokenLinks} />}

      {/* Technical Narrative */}
      <TechnicalNarrativeSection result={result} />

      {/* Image Quality & Page Weight */}
      <div className="grid gap-4 md:grid-cols-2">
        <ImageQualityCard imagesTotal={result.rawData?.htmlAnalysis?.imagesTotal ?? 0} imagesMissingAlt={result.rawData?.htmlAnalysis?.imagesMissingAlt ?? 0} />
        {(result.rawData?.htmlAnalysis?.htmlSizeBytes > 0 || result.insights?.contentDensity?.htmlSize > 0) && (
          <PageWeightCard htmlSizeBytes={result.rawData?.htmlAnalysis?.htmlSizeBytes || result.insights?.contentDensity?.htmlSize || 0} />
        )}
      </div>

      {/* Action Plan */}
      <ActionPlan recommendations={result.recommendations} url={result.url} />
    </>
  );
}
