import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, CheckCircle2, AlertCircle, Lightbulb, Zap, Users, BrainCircuit } from 'lucide-react';
import { StrategicIntroduction } from '@/types/expertAudit';
import { useLanguage } from '@/contexts/LanguageContext';
import { HallucinationCorrectionModal, HallucinationDiagnosis } from './HallucinationCorrectionModal';
import { TypewriterText } from './TypewriterText';

interface IntroductionCardProps {
  introduction: StrategicIntroduction;
  variant: 'technical' | 'strategic';
  domain?: string;
  siteName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onHallucinationData?: (data: any) => void;
  typewriter?: boolean;
}

const translations = {
  fr: {
    technicalTitle: 'Analyse Technique SEO',
    strategicTitle: 'Qu\'est ce que l\'IA pense savoir de moi ?',
    presentation: 'Présentation du site',
    strengths: 'Points forts identifiés',
    improvement: 'Axe d\'amélioration prioritaire',
    competitors: 'Concurrents identifiés',
    correctInfo: 'Corriger les informations',
  },
  en: {
    technicalTitle: 'Technical SEO Analysis',
    strategicTitle: 'What does AI think it knows about me?',
    presentation: 'Site Presentation',
    strengths: 'Key Strengths',
    improvement: 'Priority Improvement Area',
    competitors: 'Identified Competitors',
    correctInfo: 'Correct information',
  },
  es: {
    technicalTitle: 'Análisis Técnico SEO',
    strategicTitle: '¿Qué cree saber la IA sobre mí?',
    presentation: 'Presentación del sitio',
    strengths: 'Puntos fuertes identificados',
    improvement: 'Área de mejora prioritaria',
    competitors: 'Competidores identificados',
    correctInfo: 'Corregir información',
  },
};

export function IntroductionCard({ 
  introduction, 
  variant,
  domain = '',
  siteName = '',
  onHallucinationData,
  typewriter = false
}: IntroductionCardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [showHallucinationModal, setShowHallucinationModal] = useState(false);

  const Icon = variant === 'technical' ? Zap : Lightbulb;
  const title = variant === 'technical' ? t.technicalTitle : t.strategicTitle;
  const gradientClass = variant === 'technical' 
    ? 'border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent'
    : 'border border-muted-foreground/20 bg-gradient-to-br from-muted/30 to-transparent';

  // Build introduction text for hallucination modal
  const getIntroductionText = (): string => {
    return `${introduction.presentation || ''}\n\n${introduction.strengths || ''}\n\n${introduction.improvement || ''}`;
  };

  return (
    <>
      <Card className={gradientClass}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            {/* Bouton Corriger les informations - uniquement pour audit stratégique */}
            {variant === 'strategic' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHallucinationModal(true)}
                className="gap-2 border-slate-500/50 text-slate-600 hover:bg-slate-500/10 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <BrainCircuit className="h-4 w-4" />
                {t.correctInfo}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Paragraphe 1 - Présentation (Qui, Où, Quand) */}
          {introduction.presentation && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Globe className="h-4 w-4" aria-hidden="true" />
                {t.presentation}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                {typewriter ? (
                  <TypewriterText text={introduction.presentation} speed={10} chunkSize={3} />
                ) : (
                  introduction.presentation
                )}
              </p>
            </div>
          )}
          
          {/* Paragraphe 2 - Points forts (Quoi, Pourquoi) */}
          {introduction.strengths && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-success flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {t.strengths}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                {typewriter ? (
                  <TypewriterText text={introduction.strengths} speed={10} chunkSize={3} />
                ) : (
                  introduction.strengths
                )}
              </p>
            </div>
          )}
          
          {/* Paragraphe 3 - Axe d'amélioration */}
          {introduction.improvement && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-warning flex items-center gap-2">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                {t.improvement}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                {typewriter ? (
                  <TypewriterText text={introduction.improvement} speed={10} chunkSize={3} />
                ) : (
                  introduction.improvement
                )}
              </p>
            </div>
          )}

          {/* Concurrents - uniquement pour l'audit stratégique */}
          {variant === 'strategic' && introduction.competitors && introduction.competitors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden="true" />
                {t.competitors}
              </h3>
              <ul className="text-sm text-muted-foreground pl-6 flex flex-wrap gap-2">
                {introduction.competitors.map((competitor, index) => {
                  const label = typeof competitor === 'string' ? competitor : (competitor as any)?.name || (competitor as any)?.url || JSON.stringify(competitor);
                  return (
                    <li key={index} className="bg-muted/50 px-3 py-1 rounded-full text-xs font-medium">
                      {label}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hallucination Correction Modal */}
      {variant === 'strategic' && (
        <HallucinationCorrectionModal
          open={showHallucinationModal}
          onOpenChange={setShowHallucinationModal}
          introduction={getIntroductionText()}
          domain={domain}
          siteName={siteName || domain}
          onHallucinationDataReady={onHallucinationData}
        />
      )}
    </>
  );
}
