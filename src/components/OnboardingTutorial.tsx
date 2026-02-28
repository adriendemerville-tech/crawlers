import { useState, useEffect, useCallback, memo } from 'react';
import { Bot, Sparkles, Brain, Gauge, FileSearch, X, ArrowRight, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const STORAGE_KEY = 'crawlers_onboarding_done';

interface TutorialStep {
  targetSelector: string;
  titleFr: string;
  titleEn: string;
  titleEs: string;
  descFr: string;
  descEn: string;
  descEs: string;
  icon: React.ReactNode;
}

const steps: TutorialStep[] = [
  {
    targetSelector: '[data-tour="tab-geo"]',
    titleFr: 'Score GEO',
    titleEn: 'GEO Score',
    titleEs: 'Score GEO',
    descFr: 'Mesurez votre optimisation pour les IA génératives : ChatGPT, Gemini, Perplexity…',
    descEn: 'Measure your optimization for generative AIs: ChatGPT, Gemini, Perplexity…',
    descEs: 'Mide tu optimización para IAs generativas: ChatGPT, Gemini, Perplexity…',
    icon: <Sparkles className="h-5 w-5 text-amber-400" />,
  },
  {
    targetSelector: '[data-tour="tab-llm"]',
    titleFr: 'Visibilité LLM',
    titleEn: 'LLM Visibility',
    titleEs: 'Visibilidad LLM',
    descFr: 'Vérifiez si votre site est cité par les grands modèles de langage.',
    descEn: 'Check if your site is cited by large language models.',
    descEs: 'Verifica si tu sitio es citado por los grandes modelos de lenguaje.',
    icon: <Brain className="h-5 w-5 text-violet-400" />,
  },
  {
    targetSelector: '[data-tour="tab-pagespeed"]',
    titleFr: 'Speed Insight',
    titleEn: 'Speed Insight',
    titleEs: 'Speed Insight',
    descFr: 'Analysez vos Core Web Vitals et la performance de vos pages.',
    descEn: 'Analyze your Core Web Vitals and page performance.',
    descEs: 'Analiza tus Core Web Vitals y el rendimiento de tus páginas.',
    icon: <Gauge className="h-5 w-5 text-emerald-400" />,
  },
  {
    targetSelector: '[data-tour="tab-crawlers"]',
    titleFr: 'Bots IA',
    titleEn: 'AI Bots',
    titleEs: 'Bots IA',
    descFr: 'Vérifiez quels crawlers IA ont accès à votre site via robots.txt.',
    descEn: 'Check which AI crawlers can access your site via robots.txt.',
    descEs: 'Verifica qué crawlers IA tienen acceso a tu sitio vía robots.txt.',
    icon: <Bot className="h-5 w-5 text-blue-400" />,
  },
  {
    targetSelector: '[data-tour="audit-expert"]',
    titleFr: 'Audit Expert 360°',
    titleEn: 'Expert Audit 360°',
    titleEs: 'Auditoría Experta 360°',
    descFr: 'Obtenez un audit complet sur 200 points avec recommandations personnalisées et code correctif prêt à l\'emploi.',
    descEn: 'Get a full 200-point audit with personalized recommendations and ready-to-use corrective code.',
    descEs: 'Obtén una auditoría completa de 200 puntos con recomendaciones personalizadas y código correctivo listo para usar.',
    icon: <FileSearch className="h-5 w-5 text-primary" />,
  },
];

interface OnboardingTutorialProps {
  active: boolean;
  onComplete: () => void;
}

export const OnboardingTutorial = memo(function OnboardingTutorial({ active, onComplete }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const { language } = useLanguage();

  const step = steps[currentStep];

  const updatePosition = useCallback(() => {
    if (!active || !step) return;
    const el = document.querySelector(step.targetSelector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({ top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height });
    // Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [active, step]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [updatePosition]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      localStorage.setItem(STORAGE_KEY, 'true');
      onComplete();
    }
  }, [currentStep, onComplete]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  }, [onComplete]);

  if (!active || !position) return null;

  const title = language === 'en' ? step.titleEn : language === 'es' ? step.titleEs : step.titleFr;
  const desc = language === 'en' ? step.descEn : language === 'es' ? step.descEs : step.descFr;
  const skipLabel = language === 'en' ? 'Skip' : language === 'es' ? 'Saltar' : 'Passer';
  const nextLabel = language === 'en' ? 'Next' : language === 'es' ? 'Siguiente' : 'Suivant';
  const doneLabel = language === 'en' ? 'Got it!' : language === 'es' ? '¡Entendido!' : 'Compris !';
  const isLast = currentStep === steps.length - 1;

  // Position tooltip below the target
  const tooltipTop = position.top + position.height + 12;
  const tooltipLeft = Math.max(16, Math.min(position.left + position.width / 2 - 160, window.innerWidth - 336));

  return (
    <AnimatePresence>
      {active && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-[2px]"
            onClick={handleSkip}
          />

          {/* Spotlight cutout */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute z-[9999] rounded-lg ring-4 ring-primary/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
            style={{
              top: position.top - 4,
              left: position.left - 4,
              width: position.width + 8,
              height: position.height + 8,
              pointerEvents: 'none',
            }}
          />

          {/* Tooltip card */}
          <motion.div
            key={`tooltip-${currentStep}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="absolute z-[10000] w-80 rounded-xl border border-border bg-card p-4 shadow-2xl"
            style={{ top: tooltipTop, left: tooltipLeft }}
          >
            {/* Arrow */}
            <div
              className="absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-border bg-card"
              style={{ left: Math.min(Math.max(position.left + position.width / 2 - tooltipLeft - 8, 16), 288) }}
            />

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                {step.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-foreground">{title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </div>
              <button onClick={handleSkip} className="shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              {/* Step dots */}
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentStep ? 'w-4 bg-primary' : i < currentStep ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted-foreground/20'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSkip} className="h-7 px-2 text-xs">
                  {skipLabel}
                </Button>
                <Button size="sm" onClick={handleNext} className="h-7 gap-1 px-3 text-xs">
                  {isLast ? doneLabel : nextLabel}
                  {!isLast && <ChevronRight className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
