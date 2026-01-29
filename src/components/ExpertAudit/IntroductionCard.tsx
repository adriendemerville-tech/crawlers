import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, CheckCircle2, AlertCircle, Lightbulb, Zap, Target, Users } from 'lucide-react';
import { StrategicIntroduction } from '@/types/expertAudit';
import { useLanguage } from '@/contexts/LanguageContext';

interface IntroductionCardProps {
  introduction: StrategicIntroduction;
  variant: 'technical' | 'strategic';
}

const translations = {
  fr: {
    technicalTitle: 'Analyse Technique SEO',
    strategicTitle: 'Analyse Stratégique IA',
    presentation: 'Présentation du site',
    strengths: 'Points forts identifiés',
    improvement: 'Axe d\'amélioration prioritaire',
    competitors: 'Concurrents identifiés',
  },
  en: {
    technicalTitle: 'Technical SEO Analysis',
    strategicTitle: 'Strategic AI Analysis',
    presentation: 'Site Presentation',
    strengths: 'Key Strengths',
    improvement: 'Priority Improvement Area',
    competitors: 'Identified Competitors',
  },
  es: {
    technicalTitle: 'Análisis Técnico SEO',
    strategicTitle: 'Análisis Estratégico IA',
    presentation: 'Presentación del sitio',
    strengths: 'Puntos fuertes identificados',
    improvement: 'Área de mejora prioritaria',
    competitors: 'Competidores identificados',
  },
};

export function IntroductionCard({ introduction, variant }: IntroductionCardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  const Icon = variant === 'technical' ? Zap : Lightbulb;
  const title = variant === 'technical' ? t.technicalTitle : t.strategicTitle;
  const gradientClass = variant === 'technical' 
    ? 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent'
    : 'border-accent/30 bg-gradient-to-br from-accent/10 to-transparent';

  return (
    <Card className={gradientClass}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Paragraphe 1 - Présentation (Qui, Où, Quand) */}
        {introduction.presentation && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t.presentation}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed pl-6">
              {introduction.presentation}
            </p>
          </div>
        )}
        
        {/* Paragraphe 2 - Points forts (Quoi, Pourquoi) */}
        {introduction.strengths && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-success flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t.strengths}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed pl-6">
              {introduction.strengths}
            </p>
          </div>
        )}
        
        {/* Paragraphe 3 - Axe d'amélioration */}
        {introduction.improvement && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-warning flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t.improvement}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed pl-6">
              {introduction.improvement}
            </p>
          </div>
        )}

        {/* Concurrents - uniquement pour l'audit stratégique */}
        {variant === 'strategic' && introduction.competitors && introduction.competitors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t.competitors}
            </h4>
            <ul className="text-sm text-muted-foreground pl-6 flex flex-wrap gap-2">
              {introduction.competitors.map((competitor, index) => (
                <li key={index} className="bg-muted/50 px-3 py-1 rounded-full text-xs font-medium">
                  {competitor}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
