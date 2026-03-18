import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Target, Code, Search, Check, Eye, Lock, RotateCcw, GitCompareArrows } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { CreditCoin } from '@/components/ui/CreditCoin';

const translations = {
  fr: {
    step1Title: 'Audit Technique SEO',
    step1Desc: 'Performance, SEO, sécurité, Core Web Vitals. Score sur 200 points.',
    step2Title: 'Audit Stratégique GEO',
    step2Desc: 'Analyse de positionnement, citabilité LLM, stratégie GEO-SEO, étude de la concurrence et des mots-clés.',
    step3Title: 'Architecte Génératif',
    step3Desc: 'Recevez le code JSON-LD optimisé pour votre site.',
    start: 'Démarrer',
    analyzing: 'Analyse...',
    placeholder: '',
    locked: 'Terminez l\'étape précédente',
    complete: 'Terminé',
    startCode: 'Démarrer',
    priceRange: '< 6 ... 24 >',
    viewReport: 'Voir rapport',
    auditCompare: 'Audit Comparé',
  },
  en: {
    step1Title: 'Technical SEO Audit',
    step1Desc: 'Performance, SEO, security, Core Web Vitals. Score out of 200.',
    step2Title: 'Strategic AI Audit',
    step2Desc: 'Positioning analysis, LLM citability, GEO-SEO strategy, competitor and keyword research.',
    step3Title: 'Generative Architect',
    step3Desc: 'Get optimized JSON-LD code for your site.',
    start: 'Start',
    analyzing: 'Analyzing...',
    placeholder: '',
    locked: 'Complete previous step',
    complete: 'Complete',
    startCode: 'Start',
    priceRange: '< 6 ... 24 >',
    viewReport: 'View report',
    auditCompare: 'Compare Audit',
  },
  es: {
    step1Title: 'Auditoría Técnica SEO',
    step1Desc: 'Rendimiento, SEO, seguridad, Core Web Vitals. Puntuación sobre 200.',
    step2Title: 'Auditoría Estratégica IA',
    step2Desc: 'Análisis de posicionamiento, citabilidad LLM, estrategia GEO-SEO, estudio de competencia y palabras clave.',
    step3Title: 'Arquitecto Generativo',
    step3Desc: 'Reciba el código JSON-LD optimizado para su sitio.',
    start: 'Iniciar',
    analyzing: 'Analizando...',
    placeholder: '',
    locked: 'Complete el paso anterior',
    complete: 'Completado',
    startCode: 'Iniciar',
    priceRange: '< 6 ... 24 >',
    viewReport: 'Ver informe',
    auditCompare: 'Auditoría Comparada',
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
  hasStrategicResult?: boolean;
  onNavigateToTechnical?: () => void;
  onNavigateToStrategic?: () => void;
  validationBanner?: React.ReactNode;
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
  hasStrategicResult = false,
  onNavigateToTechnical,
  onNavigateToStrategic,
  validationBanner,
}: WorkflowCarouselProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeStep, setActiveStep] = useState(1);
  const [isCarouselVisible, setIsCarouselVisible] = useState(false);
  const [pendingStep2Animation, setPendingStep2Animation] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
    return t.start;
  };

  // Calculate progress percentage
  const progressPercentage = ((completedSteps.length) / steps.length) * 100;

  // Card dimensions for sliding calculation
  // Mobile: 255px (340px - 25%), Desktop: 380px
  const CARD_WIDTH = isMobile ? 310 : 380;
  const GAP = isMobile ? 16 : 24;
  const SLIDE_DISTANCE = CARD_WIDTH + GAP;

  // Swipe threshold for mobile/tablet
  const SWIPE_THRESHOLD = 50;

  // Handle swipe gesture on mobile/tablet
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    
    // Only process on mobile/tablet
    if (!isMobile) return;

    const { offset, velocity } = info;
    const swipe = offset.x;
    const swipeVelocity = velocity.x;

    // Determine if swipe was significant enough
    if (Math.abs(swipe) > SWIPE_THRESHOLD || Math.abs(swipeVelocity) > 500) {
      if (swipe > 0 && activeStep > 1) {
        // Swipe right -> go to previous step
        const newStep = activeStep - 1;
        setActiveStep(newStep);
        // Navigate to report if available
        if (newStep === 1 && hasTechnicalResult && onNavigateToTechnical) {
          onNavigateToTechnical();
        }
      } else if (swipe < 0 && activeStep < 3) {
        // Swipe left -> go to next step (only if step 2 is unlocked or completed)
        const nextStep = activeStep + 1;
        // Check if we can go to the next step
        if (nextStep === 2 && !hasTechnicalResult) return; // Can't go to step 2 if step 1 not done
        if (nextStep === 3 && !completedSteps.includes(2)) return; // Can't go to step 3 if step 2 not done
        
        setActiveStep(nextStep);
        // Navigate to report if available
        if (nextStep === 2 && hasStrategicResult && onNavigateToStrategic) {
          onNavigateToStrategic();
        }
      }
    }
  };

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
                    ? step.id === 2
                      ? "bg-slate-500 text-white"
                      : step.id === 3
                      ? "bg-violet-500 text-white"
                      : "bg-primary text-primary-foreground"
                    : step.id === 2
                    ? "bg-slate-400/30 text-slate-500"
                    : step.id === 3
                    ? "bg-violet-400/30 text-violet-500"
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

      {/* URL Input - Show for step 1 and step 2 */}
      <AnimatePresence>
        {(activeStep === 1 || activeStep === 2) && !isStepCompleted(activeStep) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8"
          >
            <div className="flex items-center gap-6 max-w-3xl mx-auto px-4">
              <div className="relative flex-1 max-w-xl">
                <Input
                  type="text"
                  placeholder={t.placeholder}
                  value={url}
                  onChange={(e) => onUrlChange(e.target.value)}
                  className="pl-4 pr-12 h-14 text-lg bg-background border-border/60 focus:border-primary/50 shadow-sm"
                  disabled={isLoading || isStrategicLoading}
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={false}
                onClick={() => window.open('/audit-compare', '_blank')}
                className="h-10 px-4 border border-violet-500 text-violet-500 bg-transparent hover:bg-violet-500/10 hover:text-violet-400 font-medium shrink-0 hidden sm:flex items-center gap-1.5 text-sm ml-2"
              >
                <GitCompareArrows className="h-4 w-4" />
                {t.auditCompare}
              </Button>
            </div>
            {validationBanner}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Carousel Container */}
      <div className="relative py-8">
        {/* Left fade mask - gradient blur from center to left (hidden on mobile) */}
        <div className="absolute left-0 top-0 bottom-0 w-40 z-10 pointer-events-none bg-gradient-to-r from-background via-background/80 to-transparent hidden sm:block" />
        
        {/* Right fade mask - gradient blur from center to right (hidden on mobile) */}
        <div className="absolute right-0 top-0 bottom-0 w-40 z-10 pointer-events-none bg-gradient-to-l from-background via-background/80 to-transparent hidden sm:block" />

        {/* Carousel Viewport - centered with proper padding */}
        <div className="overflow-x-clip touch-pan-y">
          <div className="flex justify-center px-4">
            <motion.div 
              className={cn(
                "flex items-stretch",
                isMobile ? "gap-4" : "gap-6",
                isMobile && "cursor-grab",
                isDragging && "cursor-grabbing"
              )}
              // Enable drag only on mobile/tablet
              drag={isMobile ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              animate={{ 
                // Center the active step: step 1 needs +SLIDE, step 2 needs 0, step 3 needs -SLIDE
                x: (2 - activeStep) * SLIDE_DISTANCE
              }}
              transition={{ 
                duration: isDragging ? 0 : 0.7, 
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
                  if (isNext) return 0.85;
                  if (isPrevious) return 0.75;
                  return 0; // Hidden (step 3 at start)
                };

                const getCardScale = () => {
                  if (isActive) return 1;
                  return 0.92; // Slightly larger scale for side cards (was 0.88)
                };

                // Calculate blur intensity - no blur on mobile, subtle on desktop
                const getBlurAmount = () => {
                  if (isActive) return 0;
                  if (isMobile) return 0; // No blur on mobile
                  if (isNext || isPrevious) return 0.5;
                  return 1.5;
                };

                // Step 3 should be completely hidden at step 1
                const shouldHide = activeStep === 1 && step.id === 3;

                // Handle card click to navigate
                const handleCardClick = () => {
                  if (!isActive && !shouldHide) {
                    // If this step has cached results, navigate to that report
                    if (step.id === 1 && hasTechnicalResult && onNavigateToTechnical) {
                      onNavigateToTechnical();
                    } else if (step.id === 2 && hasStrategicResult && onNavigateToStrategic) {
                      onNavigateToStrategic();
                    }
                    // Always update carousel position
                    setActiveStep(step.id);
                  }
                };

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
                        : `grayscale(20%) blur(${getBlurAmount()}px)`,
                      x: 0,
                    }}
                    transition={{ 
                      duration: 0.7, 
                      ease: [0.22, 1, 0.36, 1] 
                    }}
                    onClick={handleCardClick}
                    className={cn(
                      "flex-shrink-0 w-[290px] sm:w-[380px] relative z-20",
                      !isActive && !shouldHide && "cursor-pointer hover:scale-[0.94] transition-transform duration-300"
                    )}
                    style={{
                      visibility: shouldHide ? 'hidden' : 'visible',
                      pointerEvents: shouldHide ? 'none' : 'auto'
                    }}
                  >
                    {/* Outer golden ring for step 3 (premium effect) */}
                    {step.id === 3 && !isCompleted && (
                      <div className={cn(
                        "absolute -inset-[3px] rounded-[10px] pointer-events-none",
                        "bg-gradient-to-br from-amber-400/50 via-amber-500/40 to-amber-600/50"
                      )} />
                    )}
                    
                    {/* Glassmorphism Card with shadow */}
                    <Card className={cn(
                      "relative overflow-hidden transition-all duration-500 h-full",
                      "bg-card/95 backdrop-blur-sm border border-border/40",
                      "shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
                      isActive && step.id === 1 && "border-primary/30 shadow-[0_12px_40px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.15)]",
                      !isActive && step.id === 1 && "shadow-[0_8px_25px_rgba(0,0,0,0.12),0_4px_10px_rgba(0,0,0,0.1)]",
                      isCompleted && "border-success/30",
                      // Dark metallic grey border for step 2 (Strategic Audit) - elegant SaaS style with golden glow
                      step.id === 2 && !isCompleted && "border border-slate-400/50 dark:border-slate-500/60 bg-gradient-to-br from-card via-card to-slate-50/5 dark:to-slate-900/20 shadow-[0_8px_25px_rgba(251,191,36,0.15),0_15px_35px_rgba(251,191,36,0.1)]",
                      step.id === 2 && isActive && !isCompleted && "border-slate-500/70 dark:border-slate-400/70 shadow-[0_10px_30px_rgba(251,191,36,0.25),0_20px_50px_rgba(251,191,36,0.15),0_0_60px_rgba(251,191,36,0.1)]",
                      // Violet/purple border for step 3 (Code Correctif) - inner border
                      step.id === 3 && !isCompleted && "border-2 border-violet-500/70 dark:border-violet-400/70 shadow-[0_0_15px_rgba(139,92,246,0.2)]",
                      step.id === 3 && isActive && !isCompleted && "border-violet-500/90 shadow-[0_0_20px_rgba(139,92,246,0.3)]",
                      // Hover effect for non-active cards
                      !isActive && !shouldHide && "hover:shadow-[0_12px_35px_rgba(0,0,0,0.18)]"
                    )}>
                      {/* Top accent line */}
                      <div className={cn(
                        "absolute top-0 left-0 right-0 h-1",
                        isCompleted 
                          ? "bg-gradient-to-r from-success to-success/80"
                          : step.id === 2
                          ? "bg-gradient-to-r from-slate-600 via-slate-400 to-slate-600"
                          : step.id === 3
                          ? "bg-gradient-to-r from-violet-600 via-violet-400 to-violet-600"
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
                            : step.id === 2
                            ? "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                            : step.id === 3
                            ? "bg-violet-500/15 text-violet-500"
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
                          {step.id === 3 ? (
                            <span className="font-mono">
                              <span className="text-violet-500">&lt;</span>
                              <span className="text-pink-500">Code</span>
                              <span className="text-violet-500">/&gt;</span>
                              <span className="ml-1 text-foreground font-sans">Correctif</span>
                            </span>
                          ) : (
                            step.title
                          )}
                        </h3>
                        <p className={cn(
                          "text-sm leading-relaxed mb-6",
                          step.id === 3 
                            ? "font-mono text-muted-foreground"
                            : "text-muted-foreground"
                        )}>
                          {step.id === 3 ? (
                            <>
                              <span className="text-violet-400">&lt;</span>
                              <span className="text-cyan-500">json-ld</span>
                              <span className="text-violet-400">&gt;</span>
                              <span className="text-foreground/70"> optimisé pour votre site </span>
                              <span className="text-violet-400">&lt;/</span>
                              <span className="text-cyan-500">schema</span>
                              <span className="text-violet-400">&gt;</span>
                              <br />
                              <span className="text-amber-500/90 text-sm font-sans not-italic">déploiement simple : copiez, collez.</span>
                            </>
                          ) : (
                            step.description
                          )}
                        </p>

                        {/* Action Button - Only visible on active (center) card */}
                        {isActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStepAction(step.id);
                              }}
                              disabled={
                                isLocked || 
                                isLoading || 
                                isStrategicLoading || 
                                (step.id === 1 && !url.trim()) ||
                                isCompleted
                              }
                              className={cn(
                                "w-full h-14 text-sm sm:text-base font-medium transition-all duration-300 px-3",
                                "shadow-[2px_4px_12px_rgba(0,0,0,0.15)]",
                                isCompleted && "bg-success hover:bg-success/90",
                                isLocked && "cursor-not-allowed",
                                // Dark slate grey button for step 2 - same as border (both locked and active)
                                step.id === 2 && !isCompleted && "bg-slate-500 hover:bg-slate-600 text-white border-0",
                                step.id === 2 && isLocked && "bg-slate-500/50 hover:bg-slate-500/50",
                                // Gradient button for step 3 - purple to gold premium SaaS style (both locked and active)
                                step.id === 3 && !isCompleted && "bg-gradient-to-r from-violet-600 via-violet-500 to-amber-500 hover:from-violet-700 hover:via-violet-600 hover:to-amber-600 text-white border-0 shadow-[2px_4px_16px_rgba(139,92,246,0.25)]",
                                step.id === 3 && isLocked && "from-violet-600/50 via-violet-500/50 to-amber-500/50 hover:from-violet-600/50 hover:via-violet-500/50 hover:to-amber-500/50"
                              )}
                            >
                              {step.id === 3 && !isCompleted ? (
                                <span className="flex items-center justify-center gap-2">
                                  {getStepButtonText(step.id)}
                                  <Lock className="h-4 w-4" />
                                </span>
                              ) : (
                                getStepButtonText(step.id)
                              )}
                            </Button>
                            {/* Price below button for step 3 */}
                            {step.id === 3 && !isCompleted && (
                              <p className="text-center text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
                                <span>&lt; 6</span>
                                <CreditCoin size="sm" />
                                <span>... 24</span>
                                <CreditCoin size="sm" />
                                <span>&gt;</span>
                              </p>
                            )}
                          </motion.div>
                        )}

                        {/* Completed badge - shown below button when completed */}
                        {isCompleted && (
                          <div className="flex flex-col items-center gap-2 mt-3">
                            <div className="flex items-center gap-2 text-success text-sm font-medium">
                              <Check className="h-4 w-4" />
                              {t.complete}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Click to view report indicator */}
                              {(step.id === 1 ? hasTechnicalResult : step.id === 2 ? hasStrategicResult : false) && (
                                <Badge 
                                  variant="outline" 
                                  className="gap-1.5 text-xs cursor-pointer border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (step.id === 1 && onNavigateToTechnical) onNavigateToTechnical();
                                    else if (step.id === 2 && onNavigateToStrategic) onNavigateToStrategic();
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                  {t.viewReport}
                                </Badge>
                              )}
                              {/* Re-run button */}
                              {isActive && (step.id === 1 || step.id === 2) && (
                                <Badge 
                                  variant="outline" 
                                  className="gap-1.5 text-xs cursor-pointer border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStepAction(step.id);
                                  }}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Relancer
                                </Badge>
                              )}
                            </div>
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
    </div>
  );
}
