import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, ArrowRight, Lightbulb, BrainCircuit, 
  CheckCircle2, XCircle, Code2, ExternalLink, FileText, ChevronDown, ChevronUp, Image as ImageIcon, MessageCircle
} from 'lucide-react';
import { HallucinationDiagnosis, Discrepancy, HallucinationRecommendation, DiscrepancySourcePage } from './HallucinationCorrectionModal';
import { useLanguage } from '@/contexts/LanguageContext';

interface HallucinationDiagnosisCardProps {
  diagnosis: HallucinationDiagnosis;
}

const translations = {
  fr: {
    title: 'Diagnostic d\'Incohérences IA',
    subtitle: 'Analyse des écarts entre la perception IA et la réalité',
    discrepanciesTitle: 'Incohérences Détectées',
    confusionTitle: 'Sources de Confusion pour les LLM',
    recommendationsTitle: 'Recommandations Correctives',
    analysisTitle: 'Analyse Narrative',
    field: 'Champ',
    detected: 'Détecté par l\'IA',
    reality: 'Réalité',
    impact: 'Impact',
    impactHigh: 'Élevé',
    impactMedium: 'Moyen',
    impactLow: 'Faible',
    noDiscrepancies: 'Aucune incohérence majeure détectée',
    codeAvailable: 'Code correctif disponible',
    sourcePages: 'Pages sources',
    element: 'Élément',
    excerpt: 'Extrait',
    viewPage: 'Voir la page',
    screenshot: 'Capture',
    verdict_misleading: 'Donnée trompeuse',
    verdict_absent: 'Donnée absente',
    verdict_bias: 'Biais d\'entraînement',
    verdict_reasoning: 'Erreur de raisonnement',
  },
  en: {
    title: 'AI Discrepancy Diagnosis',
    subtitle: 'Analysis of gaps between AI perception and reality',
    discrepanciesTitle: 'Detected Discrepancies',
    confusionTitle: 'LLM Confusion Sources',
    recommendationsTitle: 'Corrective Recommendations',
    analysisTitle: 'Narrative Analysis',
    field: 'Field',
    detected: 'Detected by AI',
    reality: 'Reality',
    impact: 'Impact',
    impactHigh: 'High',
    impactMedium: 'Medium',
    impactLow: 'Low',
    noDiscrepancies: 'No major discrepancies detected',
    codeAvailable: 'Corrective code available',
    sourcePages: 'Source pages',
    element: 'Element',
    excerpt: 'Excerpt',
    viewPage: 'View page',
    screenshot: 'Screenshot',
    verdict_misleading: 'Misleading data',
    verdict_absent: 'Missing data',
    verdict_bias: 'Training bias',
    verdict_reasoning: 'Reasoning error',
  },
  es: {
    title: 'Diagnóstico de Discrepancias IA',
    subtitle: 'Análisis de brechas entre la percepción IA y la realidad',
    discrepanciesTitle: 'Discrepancias Detectadas',
    confusionTitle: 'Fuentes de Confusión para LLM',
    recommendationsTitle: 'Recomendaciones Correctivas',
    analysisTitle: 'Análisis Narrativo',
    field: 'Campo',
    detected: 'Detectado por IA',
    reality: 'Realidad',
    impact: 'Impacto',
    impactHigh: 'Alto',
    impactMedium: 'Medio',
    impactLow: 'Bajo',
    noDiscrepancies: 'Sin discrepancias importantes detectadas',
    codeAvailable: 'Código correctivo disponible',
    sourcePages: 'Páginas fuente',
    element: 'Elemento',
    excerpt: 'Extracto',
    viewPage: 'Ver página',
    screenshot: 'Captura',
    verdict_misleading: 'Dato engañoso',
    verdict_absent: 'Dato ausente',
    verdict_bias: 'Sesgo de entrenamiento',
    verdict_reasoning: 'Error de razonamiento',
  },
};

const fieldLabels: Record<string, Record<string, string>> = {
  fr: {
    sector: 'Secteur', country: 'Pays', valueProposition: 'Proposition de valeur',
    targetAudience: 'Audience cible', businessAge: 'Ancienneté',
    businessType: 'Type d\'entreprise', mainProducts: 'Produits/Services',
  },
  en: {
    sector: 'Sector', country: 'Country', valueProposition: 'Value Proposition',
    targetAudience: 'Target Audience', businessAge: 'Business Age',
    businessType: 'Business Type', mainProducts: 'Products/Services',
  },
  es: {
    sector: 'Sector', country: 'País', valueProposition: 'Propuesta de Valor',
    targetAudience: 'Audiencia Objetivo', businessAge: 'Antigüedad',
    businessType: 'Tipo de Empresa', mainProducts: 'Productos/Servicios',
  },
};

const elementLabels: Record<string, string> = {
  title: 'Title', h1: 'H1', meta_description: 'Meta Description',
  schema_org: 'Schema.org', body_content: 'Contenu', canonical: 'Canonical', og_tags: 'OG Tags',
};

const impactColors = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-muted text-muted-foreground border-muted',
};

const verdictConfig = {
  misleading_data: { icon: '🔴', color: 'bg-destructive/10 text-destructive border-destructive/30', key: 'verdict_misleading' as const },
  absent_data: { icon: '🟡', color: 'bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/50', key: 'verdict_absent' as const },
  training_bias: { icon: '🟠', color: 'bg-orange-100/50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300/50', key: 'verdict_bias' as const },
  reasoning_error: { icon: '🔵', color: 'bg-primary/10 text-primary border-primary/30', key: 'verdict_reasoning' as const },
};

const priorityColors = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  important: 'bg-primary/10 text-primary border-primary/30',
  optional: 'bg-muted text-muted-foreground border-muted',
};

function SourcePageDetail({ page, t }: { page: DiscrepancySourcePage; t: typeof translations.fr }) {
  return (
    <div className="flex items-start gap-2 text-xs bg-muted/40 rounded-md p-2 border border-border/50">
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted">
            {elementLabels[page.element] || page.element}
          </Badge>
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline truncate max-w-[200px] inline-flex items-center gap-1"
          >
            {page.title || new URL(page.url).pathname}
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          </a>
        </div>
        {page.excerpt && (
          <p className="text-muted-foreground mt-1 italic truncate">
            « {page.excerpt} »
          </p>
        )}
      </div>
    </div>
  );
}

function DiscrepancyCard({ disc, index, t, fieldLabel }: { 
  disc: Discrepancy; index: number; t: typeof translations.fr; fieldLabel: Record<string, string> 
}) {
  const [expanded, setExpanded] = useState(false);
  const [screenshotError, setScreenshotError] = useState(false);
  const hasSourcePages = disc.sourcePages && disc.sourcePages.length > 0;
  const hasScreenshot = disc.screenshotUrl && !screenshotError;
  const verdictInfo = disc.verdict ? verdictConfig[disc.verdict] : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-muted/30 rounded-lg p-3 border border-border"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {fieldLabel[disc.field] || disc.field}
          </span>
          {verdictInfo && (
            <Badge variant="outline" className={`text-[10px] ${verdictInfo.color}`}>
              {verdictInfo.icon} {t[verdictInfo.key]}
            </Badge>
          )}
        </div>
        <Badge variant="outline" className={impactColors[disc.impact]}>
          {disc.impact === 'high' ? t.impactHigh : disc.impact === 'medium' ? t.impactMedium : t.impactLow}
        </Badge>
      </div>

      {/* Original → Corrected */}
      <div className="flex items-center gap-2 text-sm mb-2">
        <span className="text-destructive/80 line-through flex-1 truncate">
          {disc.original || '(non détecté)'}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-emerald-600 dark:text-emerald-400 flex-1 truncate font-medium">
          {disc.corrected}
        </span>
      </div>

      {disc.explanation && (
        <p className="text-xs text-muted-foreground italic mb-2">{disc.explanation}</p>
      )}

      {/* Evidence */}
      {disc.evidence && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 mb-2">
          📋 {disc.evidence}
        </p>
      )}

      {/* Source pages + Screenshot expandable */}
      {(hasSourcePages || hasScreenshot) && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {t.sourcePages} ({disc.sourcePages?.length || 0})
            {hasScreenshot && (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                • <ImageIcon className="h-3 w-3" /> {t.screenshot}
              </span>
            )}
          </button>

          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 space-y-2"
            >
              {/* Source pages */}
              {disc.sourcePages?.map((page, i) => (
                <SourcePageDetail key={i} page={page} t={t} />
              ))}

              {/* Screenshot */}
              {hasScreenshot && (
                <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img
                    src={disc.screenshotUrl!}
                    alt={`Screenshot ${disc.sourcePages?.[0]?.url || ''}`}
                    className="w-full h-auto max-h-[300px] object-cover object-top"
                    loading="lazy"
                    onError={() => setScreenshotError(true)}
                  />
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function HallucinationDiagnosisCard({ diagnosis }: HallucinationDiagnosisCardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const fieldLabel = fieldLabels[language] || fieldLabels.fr;

  const hasDiscrepancies = diagnosis.discrepancies && diagnosis.discrepancies.length > 0;

  // Verdict summary
  const vs = diagnosis.verdictSummary;
  const hasVerdictSummary = vs && (vs.misleading_data + vs.absent_data + vs.training_bias + vs.reasoning_error > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BrainCircuit className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            {t.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Verdict Summary Badges */}
          {hasVerdictSummary && (
            <div className="flex flex-wrap gap-2">
              {vs.misleading_data > 0 && (
                <Badge variant="outline" className={verdictConfig.misleading_data.color}>
                  🔴 {t.verdict_misleading}: {vs.misleading_data}
                </Badge>
              )}
              {vs.absent_data > 0 && (
                <Badge variant="outline" className={verdictConfig.absent_data.color}>
                  🟡 {t.verdict_absent}: {vs.absent_data}
                </Badge>
              )}
              {vs.training_bias > 0 && (
                <Badge variant="outline" className={verdictConfig.training_bias.color}>
                  🟠 {t.verdict_bias}: {vs.training_bias}
                </Badge>
              )}
              {vs.reasoning_error > 0 && (
                <Badge variant="outline" className={verdictConfig.reasoning_error.color}>
                  🔵 {t.verdict_reasoning}: {vs.reasoning_error}
                </Badge>
              )}
            </div>
          )}

          {/* Narrative Analysis */}
          {diagnosis.analysisNarrative && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                {t.analysisTitle}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                {diagnosis.analysisNarrative}
              </p>
            </div>
          )}

          {/* Discrepancies */}
          {hasDiscrepancies ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                {t.discrepanciesTitle}
              </h3>
              <div className="space-y-2">
                {diagnosis.discrepancies.map((disc, index) => (
                  <DiscrepancyCard
                    key={index}
                    disc={disc}
                    index={index}
                    t={t}
                    fieldLabel={fieldLabel}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              {t.noDiscrepancies}
            </div>
          )}

          {/* Confusion Sources */}
          {diagnosis.confusionSources && diagnosis.confusionSources.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                {t.confusionTitle}
              </h3>
              <div className="flex flex-wrap gap-2 pl-6">
                {diagnosis.confusionSources.map((source, i) => (
                  <Badge 
                    key={i} 
                    variant="outline" 
                    className="bg-amber-100/50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300/50"
                  >
                    {source}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
                {t.recommendationsTitle}
              </h3>
              <div className="space-y-2 pl-6">
                {diagnosis.recommendations.map((rec, i) => (
                  <div 
                    key={rec.id || i}
                    className="flex items-start gap-3 text-sm"
                  >
                    <Badge 
                      variant="outline" 
                      className={`shrink-0 ${priorityColors[rec.priority]}`}
                    >
                      {rec.category}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{rec.title}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{rec.description}</p>
                      {rec.codeSnippet && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-violet-600 dark:text-violet-400">
                          <Code2 className="h-3 w-3" />
                          {t.codeAvailable}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
