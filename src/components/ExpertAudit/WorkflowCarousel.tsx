import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart3, Target, Code, Search, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const translations = {
  fr: {
    step1Title: 'Audit Technique SEO',
    step1Desc: 'Performance, SEO, sécurité, Core Web Vitals. Score sur 200 points.',
    step2Title: 'Audit Stratégique IA',
    step2Desc: 'Analyse de positionnement, citabilité LLM, stratégie GEO 2026.',
    step3Title: 'Code Correctif',
    step3Desc: 'Recevez le code JSON-LD optimisé pour votre site.',
    start: 'Démarrer',
    analyzing: 'Analyse...',
    placeholder: 'example.com',
    locked: 'Terminez l\'étape précédente',
    complete: 'Terminé',
    paid: '5€',
  },
  en: {
    step1Title: 'Technical SEO Audit',
    step1Desc: 'Performance, SEO, security, Core Web Vitals. Score out of 200.',
    step2Title: 'Strategic AI Audit',
    step2Desc: 'Positioning analysis, LLM citability, GEO 2026 strategy.',
    step3Title: 'Corrective Code',
    step3Desc: 'Get optimized JSON-LD code for your site.',
    start: 'Start',
    analyzing: 'Analyzing...',
    placeholder: 'example.com',
    locked: 'Complete previous step',
    complete: 'Complete',
    paid: '€5',
  },
  es: {
    step1Title: 'Auditoría Técnica SEO',
    step1Desc: 'Rendimiento, SEO, seguridad, Core Web Vitals. Puntuación sobre 200.',
    step2Title: 'Auditoría Estratégica IA',
    step2Desc: 'Análisis de posicionamiento, citabilidad LLM, estrategia GEO 2026.',
    step3Title: 'Código Correctivo',
    step3Desc: 'Reciba el código JSON-LD optimizado para su sitio.',
    start: 'Iniciar',
    analyzing: 'Analizando...',
    placeholder: 'example.com',
    locked: 'Complete el paso anterior',
    complete: 'Completado',
    paid: '5€',
  },
};

interface WorkflowStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  isPaid?: boolean;
}

interface WorkflowCarouselProps {
  currentStep: number;
  completedSteps: number[];
  url: string;
  onUrlChange: (url: string) => void;
  onStartTechnical: () => void;
  onStartStrategic: () => void;
  onStartPayment: () => void;
  isLoading: boolean;
  isStrategicLoading: boolean;
  hasTechnicalResult: boolean;
}

export function WorkflowCarousel({
  currentStep,
  completedSteps,
  url,
  onUrlChange,
  onStartTechnical,
  onStartStrategic,
  onStartPayment,
  isLoading,
  isStrategicLoading,
  hasTechnicalResult,
}: WorkflowCarouselProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [activeStep, setActiveStep] = useState(1);
  const [isCarouselVisible, setIsCarouselVisible] = useState(false);
  const [pendingStep2Animation, setPendingStep2Animation] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Detect when carousel is visible in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCarouselVisible(entry.isIntersecting);
      },
      { threshold: 0.5 } // Trigger when 50% of carousel is visible
    );

    if (carouselRef.current) {
      observer.observe(carouselRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Mark pending animation when step 1 completes
  useEffect(() => {
    if (completedSteps.includes(1) && !completedSteps.includes(2) && activeStep === 1) {
      setPendingStep2Animation(true);
    }
  }, [completedSteps, activeStep]);

  // Trigger animation to step 2 only when carousel becomes visible
  useEffect(() => {
    if (pendingStep2Animation && isCarouselVisible) {
      setActiveStep(2);
      setPendingStep2Animation(false);
    }
  }, [pendingStep2Animation, isCarouselVisible]);

  // Sync with currentStep for other cases
  useEffect(() => {
    if (!pendingStep2Animation) {
      setActiveStep(currentStep);
    }
  }, [currentStep, pendingStep2Animation]);

  const steps: WorkflowStep[] = [
    {
      id: 1,
      title: t.step1Title,
      description: t.step1Desc,
      icon: <BarChart3 className="h-6 w-6" />,
    },
    {
      id: 2,
      title: t.step2Title,
      description: t.step2Desc,
      icon: <Target className="h-6 w-6" />,
    },
    {
      id: 3,
      title: t.step3Title,
      description: t.step3Desc,
      icon: <Code className="h-6 w-6" />,
      isPaid: true,
    },
  ];

  const isStepCompleted = (stepId: number) => completedSteps.includes(stepId);
  const isStepLocked = (stepId: number) => {
    if (stepId === 1) return false;
    if (stepId === 2) return !hasTechnicalResult;
    if (stepId === 3) return !isStepCompleted(2);
    return true;
  };

  const handleStepAction = (stepId: number) => {
    if (stepId === 1) onStartTechnical();
    else if (stepId === 2) onStartStrategic();
    else if (stepId === 3) onStartPayment();
  };

  const getStepButtonText = (stepId: number) => {
    if (isLoading && stepId === 1) return t.analyzing;
    if (isStrategicLoading && stepId === 2) return t.analyzing;
    if (isStepCompleted(stepId)) return t.complete;
    if (isStepLocked(stepId)) return t.locked;
    return stepId === 3 ? `${t.start} (${t.paid})` : t.start;
  };

  // Calculate progress percentage
  const progressPercentage = ((completedSteps.length) / steps.length) * 100;

  // Card dimensions for sliding calculation
  const CARD_WIDTH = 380; // w-[380px]
  const GAP = 24; // gap-6 = 1.5rem = 24px
  const SLIDE_DISTANCE = CARD_WIDTH + GAP;

  return (
    <div className="w-full" ref={carouselRef}>
      {/* Progress Bar - Minimal SaaS style */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 px-4"
      >
        <div className="max-w-2xl mx-auto">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ 
                duration: 0.7, 
                ease: [0.22, 1, 0.36, 1] 
              }}
              className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
            />
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step) => (
              <motion.div
                key={step.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: step.id * 0.1 }}
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
                  isStepCompleted(step.id)
                    ? "bg-success text-success-foreground"
                    : activeStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isStepCompleted(step.id) ? (
                  <Check className="h-3 w-3" />
                ) : (
                  step.id
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* URL Input - Only show for step 1 */}
      <AnimatePresence>
        {activeStep === 1 && !isStepCompleted(1) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8"
          >
            <div className="relative max-w-xl mx-auto px-4">
              <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t.placeholder}
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                className="pl-12 h-14 text-lg bg-background border-border/60 focus:border-primary/50 shadow-sm"
                disabled={isLoading || isStrategicLoading}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Carousel Container */}
      <div className="relative py-8">
        {/* Left fade mask - gradient blur from center to left */}
        <div className="absolute left-0 top-0 bottom-0 w-40 z-10 pointer-events-none bg-gradient-to-r from-background via-background/80 to-transparent" />
        
        {/* Right fade mask - gradient blur from center to right */}
        <div className="absolute right-0 top-0 bottom-0 w-40 z-10 pointer-events-none bg-gradient-to-l from-background via-background/80 to-transparent" />

        {/* Carousel Viewport - centered with proper padding */}
        <div className="overflow-x-clip">
          <div className="max-w-[900px] mx-auto px-4 sm:px-8">
            <motion.div 
              className="flex items-stretch gap-6"
              animate={{ 
                x: (activeStep - 1) * -SLIDE_DISTANCE
              }}
              transition={{ 
                duration: 0.7, 
                ease: [0.22, 1, 0.36, 1] 
              }}
            >
              {steps.map((step) => {
                const isActive = activeStep === step.id;
                const isCompleted = isStepCompleted(step.id);
                const isLocked = isStepLocked(step.id);
                const isNext = step.id === activeStep + 1;
                const isPrevious = step.id < activeStep;

                // Calculate visual state
                const getCardOpacity = () => {
                  if (isActive) return 1;
                  if (isNext) return 0.7;
                  if (isPrevious) return 0.5;
                  return 0; // Hidden (step 3 at start)
                };

                const getCardScale = () => {
                  if (isActive) return 1;
                  return 0.88; // Smaller scale for side cards
                };

                // Calculate blur intensity - stronger for side cards
                const getBlurAmount = () => {
                  if (isActive) return 0;
                  if (isNext || isPrevious) return 3;
                  return 5;
                };

                // Step 3 should be completely hidden at step 1
                const shouldHide = activeStep === 1 && step.id === 3;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ 
                      opacity: step.id === 1 ? 1 : step.id === 2 ? 0.6 : 0,
                      scale: step.id === 1 ? 1 : 0.92,
                      x: 0
                    }}
                    animate={{
                      scale: getCardScale(),
                      opacity: shouldHide ? 0 : getCardOpacity(),
                      filter: isActive 
                        ? 'grayscale(0%) blur(0px)' 
                        : `grayscale(50%) blur(${getBlurAmount()}px)`,
                      x: 0,
                    }}
                    transition={{ 
                      duration: 0.7, 
                      ease: [0.22, 1, 0.36, 1] 
                    }}
                    className={cn(
                      "flex-shrink-0 w-[340px] sm:w-[380px] relative z-20",
                      !isActive && "pointer-events-none"
                    )}
                    style={{
                      visibility: shouldHide ? 'hidden' : 'visible'
                    }}
                  >
                    {/* Glassmorphism Card with shadow */}
                    <Card className={cn(
                      "relative overflow-hidden transition-all duration-500 h-full",
                      "bg-card/95 backdrop-blur-sm border border-border/40",
                      "shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
                      isActive && "border-primary/30 shadow-[0_12px_40px_rgba(0,0,0,0.15)]",
                      isCompleted && "border-success/30",
                      // Gold border for step 2 (Strategic Audit) - using warning token for amber/gold
                      step.id === 2 && !isCompleted && "border-2 border-warning",
                      // Teal/cyan accent for step 3 (Code Correctif) - premium tech feel
                      step.id === 3 && !isCompleted && "border-2 border-cyan-500/60"
                    )}>
                      {/* Top accent line */}
                      <div className={cn(
                        "absolute top-0 left-0 right-0 h-1",
                        isCompleted 
                          ? "bg-gradient-to-r from-success to-success/80"
                          : isActive 
                          ? "bg-gradient-to-r from-primary to-primary/80"
                          : "bg-muted"
                      )} />

                      <CardContent className="p-8">
                        {/* Icon */}
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-all duration-300",
                          isCompleted 
                            ? "bg-success/10 text-success"
                            : isActive 
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}>
                        {isCompleted ? (
                          <Check className="h-7 w-7" />
                        ) : (
                          step.icon
                        )}
                        </div>

                        {/* Title & Description */}
                        <h3 className={cn(
                          "text-xl font-semibold mb-2 transition-colors",
                          isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {step.title}
                          {step.isPaid && (
                            <span className="ml-2 text-sm font-normal text-primary">({t.paid})</span>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                          {step.description}
                        </p>

                        {/* Action Button - Always visible for active step */}
                        {isActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <Button
                              onClick={() => handleStepAction(step.id)}
                              disabled={
                                isLocked || 
                                isLoading || 
                                isStrategicLoading || 
                                (step.id === 1 && !url.trim()) ||
                                isCompleted
                              }
                              className={cn(
                                "w-full h-12 text-base font-medium transition-all duration-300",
                                "shadow-[2px_4px_12px_rgba(0,0,0,0.15)]",
                                isCompleted && "bg-success hover:bg-success/90",
                                isLocked && "opacity-50 cursor-not-allowed",
                                // Premium dark silver button for step 2
                                step.id === 2 && !isCompleted && !isLocked && "bg-[#3a3f4a] hover:bg-[#4a4f5a] text-white border-0",
                                // Cyan/teal button for step 3
                                step.id === 3 && !isCompleted && !isLocked && "bg-cyan-600 hover:bg-cyan-700 text-white border-0"
                              )}
                            >
                              {getStepButtonText(step.id)}
                            </Button>
                          </motion.div>
                        )}

                        {/* Completed badge */}
                        {isCompleted && !isActive && (
                          <div className="flex items-center gap-2 text-success text-sm font-medium">
                            <Check className="h-4 w-4" />
                            {t.complete}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Step indicators (dots) */}
      <div className="flex justify-center gap-2 mt-4">
        {steps.map((step) => (
          <motion.button
            key={step.id}
            onClick={() => !isStepLocked(step.id) && setActiveStep(step.id)}
            disabled={isStepLocked(step.id)}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-300",
              activeStep === step.id 
                ? "bg-primary w-8" 
                : isStepCompleted(step.id)
                ? "bg-success"
                : isStepLocked(step.id)
                ? "bg-muted cursor-not-allowed"
                : "bg-muted hover:bg-muted-foreground/30"
            )}
            whileHover={!isStepLocked(step.id) ? { scale: 1.2 } : undefined}
            whileTap={!isStepLocked(step.id) ? { scale: 0.95 } : undefined}
          />
        ))}
      </div>
    </div>
  );
}
