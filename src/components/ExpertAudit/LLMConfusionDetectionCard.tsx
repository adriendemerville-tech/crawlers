import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BrainCircuit, AlertTriangle, ArrowRight, Shield, 
  ChevronDown, ChevronUp, Wrench, Info
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StoredCorrection {
  id: string;
  domain: string;
  url: string;
  original_values: Record<string, string>;
  corrected_values: Record<string, string>;
  discrepancies: Array<{
    field: string;
    original: string;
    corrected: string;
    impact: 'high' | 'medium' | 'low';
    explanation: string;
  }>;
  recommendations: Array<{
    id: string;
    category: string;
    priority: string;
    title: string;
    description: string;
  }>;
  analysis_narrative: string | null;
  confusion_sources: string[];
  created_at: string;
}

interface LLMConfusionDetectionCardProps {
  corrections: StoredCorrection[];
  domain: string;
  onApplyCorrections?: (correctedValues: Record<string, string>) => void;
}

const translations = {
  fr: {
    title: 'Détection de Confusion des LLMs',
    subtitle: 'Des confusions sémantiques ont déjà été identifiées sur ce domaine',
    previouslyDetected: 'Confusions précédemment corrigées',
    field: 'Champ',
    aiSaw: 'Ce que l\'IA voyait',
    reality: 'Réalité corrigée',
    impact: 'Impact',
    impactHigh: 'Élevé',
    impactMedium: 'Moyen',
    impactLow: 'Faible',
    whyConfusion: 'Pourquoi cette confusion ?',
    explanation: 'Les LLMs s\'appuient sur des signaux sémantiques faibles (meta tags, texte ambigü, absence de données structurées). Quand ces signaux sont incohérents, les IA "hallucinent" des informations incorrectes.',
    howToCure: 'Comment guérir définitivement ces confusions',
    cure1: 'Injectez un calque anti-hallucination (Schema.org, meta, JSON-LD) qui clarifie l\'identité de votre entité',
    cure2: 'Enrichissez le contenu on-page avec les termes exacts corrigés (secteur, audience, proposition de valeur)',
    cure3: 'Utilisez l\'Architecte Génératif pour appliquer automatiquement ces corrections techniques',
    applyCorrections: 'Appliquer les corrections au rapport',
    detectedOn: 'Détecté le',
    showDetails: 'Voir les détails',
    hideDetails: 'Masquer',
    confusionCount: 'confusion(s) identifiée(s)',
  },
  en: {
    title: 'LLM Confusion Detection',
    subtitle: 'Semantic confusions have already been identified on this domain',
    previouslyDetected: 'Previously corrected confusions',
    field: 'Field',
    aiSaw: 'What AI saw',
    reality: 'Corrected reality',
    impact: 'Impact',
    impactHigh: 'High',
    impactMedium: 'Medium',
    impactLow: 'Low',
    whyConfusion: 'Why this confusion?',
    explanation: 'LLMs rely on weak semantic signals (meta tags, ambiguous text, missing structured data). When these signals are inconsistent, AIs "hallucinate" incorrect information.',
    howToCure: 'How to permanently cure these confusions',
    cure1: 'Inject an anti-hallucination layer (Schema.org, meta, JSON-LD) that clarifies your entity identity',
    cure2: 'Enrich on-page content with the exact corrected terms (sector, audience, value proposition)',
    cure3: 'Use the Generative Architect to automatically apply these technical corrections',
    applyCorrections: 'Apply corrections to report',
    detectedOn: 'Detected on',
    showDetails: 'Show details',
    hideDetails: 'Hide',
    confusionCount: 'confusion(s) identified',
  },
  es: {
    title: 'Detección de Confusión de LLMs',
    subtitle: 'Se han identificado confusiones semánticas en este dominio',
    previouslyDetected: 'Confusiones previamente corregidas',
    field: 'Campo',
    aiSaw: 'Lo que la IA veía',
    reality: 'Realidad corregida',
    impact: 'Impacto',
    impactHigh: 'Alto',
    impactMedium: 'Medio',
    impactLow: 'Bajo',
    whyConfusion: '¿Por qué esta confusión?',
    explanation: 'Los LLMs se basan en señales semánticas débiles (meta tags, texto ambiguo, falta de datos estructurados). Cuando estas señales son inconsistentes, las IAs "alucinan" información incorrecta.',
    howToCure: 'Cómo curar permanentemente estas confusiones',
    cure1: 'Inyecte una capa anti-alucinación (Schema.org, meta, JSON-LD) que aclare la identidad de su entidad',
    cure2: 'Enriquezca el contenido on-page con los términos exactos corregidos (sector, audiencia, propuesta de valor)',
    cure3: 'Use el Arquitecto Generativo para aplicar automáticamente estas correcciones técnicas',
    applyCorrections: 'Aplicar correcciones al informe',
    detectedOn: 'Detectado el',
    showDetails: 'Ver detalles',
    hideDetails: 'Ocultar',
    confusionCount: 'confusión(es) identificada(s)',
  },
};

const fieldLabels: Record<string, Record<string, string>> = {
  fr: { sector: 'Secteur', country: 'Pays', valueProposition: 'Proposition de valeur', targetAudience: 'Audience cible', businessAge: 'Ancienneté', businessType: 'Type d\'entreprise', mainProducts: 'Produits/Services' },
  en: { sector: 'Sector', country: 'Country', valueProposition: 'Value Proposition', targetAudience: 'Target Audience', businessAge: 'Business Age', businessType: 'Business Type', mainProducts: 'Products/Services' },
  es: { sector: 'Sector', country: 'País', valueProposition: 'Propuesta de Valor', targetAudience: 'Audiencia Objetivo', businessAge: 'Antigüedad', businessType: 'Tipo de Empresa', mainProducts: 'Productos/Servicios' },
};

const impactColors = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-amber-100/50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300/50',
  low: 'bg-muted text-muted-foreground border-muted',
};

export function LLMConfusionDetectionCard({ corrections, domain, onApplyCorrections }: LLMConfusionDetectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const fl = fieldLabels[language] || fieldLabels.fr;

  // Merge all discrepancies from all corrections (deduplicate by field)
  const allDiscrepancies = corrections.flatMap(c => c.discrepancies || []);
  const uniqueDiscrepancies = allDiscrepancies.reduce((acc, d) => {
    if (!acc.find(x => x.field === d.field)) acc.push(d);
    return acc;
  }, [] as typeof allDiscrepancies);

  // Latest corrected values
  const latestCorrection = corrections[0];
  const totalConfusions = uniqueDiscrepancies.length;

  const getImpactLabel = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high': return t.impactHigh;
      case 'medium': return t.impactMedium;
      case 'low': return t.impactLow;
    }
  };

  const handleApply = () => {
    if (latestCorrection?.corrected_values && onApplyCorrections) {
      onApplyCorrections(latestCorrection.corrected_values);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-amber-500/40 bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-amber-950/30 dark:to-orange-950/20 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800 dark:text-amber-300">
                <BrainCircuit className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                {t.title}
              </CardTitle>
              <p className="text-sm text-amber-700/80 dark:text-amber-400/70 mt-1">{t.subtitle}</p>
            </div>
            <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300/60 shrink-0">
              {totalConfusions} {t.confusionCount}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key discrepancies summary */}
          <div className="space-y-2">
            {uniqueDiscrepancies.slice(0, expanded ? undefined : 3).map((disc, index) => (
              <motion.div
                key={`${disc.field}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-background/60 rounded-lg p-3 border border-amber-200/50 dark:border-amber-800/40"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {fl[disc.field] || disc.field}
                  </span>
                  <Badge variant="outline" className={`text-xs ${impactColors[disc.impact]}`}>
                    {getImpactLabel(disc.impact)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-destructive/80 line-through flex-1 truncate">
                    {disc.original || '—'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400 flex-1 truncate font-medium">
                    {disc.corrected}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {uniqueDiscrepancies.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/30"
            >
              {expanded ? t.hideDetails : t.showDetails}
              {expanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
          )}

          {/* Why this confusion? */}
          <div className="bg-background/40 rounded-lg p-3 border border-border space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Info className="h-4 w-4 text-amber-500" />
              {t.whyConfusion}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.explanation}
            </p>
          </div>

          {/* How to permanently cure */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-3 border border-emerald-200/50 dark:border-emerald-800/40 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <Shield className="h-4 w-4" />
              {t.howToCure}
            </h4>
            <ul className="space-y-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              <li className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-200">1</span>
                {t.cure1}
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-200">2</span>
                {t.cure2}
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-200">3</span>
                {t.cure3}
              </li>
            </ul>
          </div>

          {/* Apply corrections button */}
          {onApplyCorrections && (
            <Button
              onClick={handleApply}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Wrench className="h-4 w-4 mr-2" />
              {t.applyCorrections}
            </Button>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground text-right">
            {t.detectedOn} {new Date(latestCorrection.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
