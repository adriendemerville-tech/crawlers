import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, ArrowRight, Lightbulb, BrainCircuit, 
  CheckCircle2, XCircle, Code2
} from 'lucide-react';
import { HallucinationDiagnosis, Discrepancy, HallucinationRecommendation } from './HallucinationCorrectionModal';
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
  },
};

const fieldLabels: Record<string, Record<string, string>> = {
  fr: {
    sector: 'Secteur',
    country: 'Pays',
    valueProposition: 'Proposition de valeur',
    targetAudience: 'Audience cible',
    businessAge: 'Ancienneté',
    businessType: 'Type d\'entreprise',
    mainProducts: 'Produits/Services',
  },
  en: {
    sector: 'Sector',
    country: 'Country',
    valueProposition: 'Value Proposition',
    targetAudience: 'Target Audience',
    businessAge: 'Business Age',
    businessType: 'Business Type',
    mainProducts: 'Products/Services',
  },
  es: {
    sector: 'Sector',
    country: 'País',
    valueProposition: 'Propuesta de Valor',
    targetAudience: 'Audiencia Objetivo',
    businessAge: 'Antigüedad',
    businessType: 'Tipo de Empresa',
    mainProducts: 'Productos/Servicios',
  },
};

const impactColors = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-muted text-muted-foreground border-muted',
};

const priorityColors = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  important: 'bg-primary/10 text-primary border-primary/30',
  optional: 'bg-muted text-muted-foreground border-muted',
};

export function HallucinationDiagnosisCard({ diagnosis }: HallucinationDiagnosisCardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const fieldLabel = fieldLabels[language] || fieldLabels.fr;

  const getImpactLabel = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high': return t.impactHigh;
      case 'medium': return t.impactMedium;
      case 'low': return t.impactLow;
    }
  };

  const hasDiscrepancies = diagnosis.discrepancies && diagnosis.discrepancies.length > 0;

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

          {/* Discrepancies Table */}
          {hasDiscrepancies ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                {t.discrepanciesTitle}
              </h3>
              <div className="space-y-2">
                {diagnosis.discrepancies.map((disc, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-muted/30 rounded-lg p-3 border border-border"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-sm font-medium text-foreground">
                        {fieldLabel[disc.field] || disc.field}
                      </span>
                      <Badge variant="outline" className={impactColors[disc.impact]}>
                        {getImpactLabel(disc.impact)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <span className="text-destructive/80 line-through flex-1 truncate">
                        {disc.original || '(non détecté)'}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-success flex-1 truncate font-medium">
                        {disc.corrected}
                      </span>
                    </div>
                    {disc.explanation && (
                      <p className="text-xs text-muted-foreground italic">
                        {disc.explanation}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-success">
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
