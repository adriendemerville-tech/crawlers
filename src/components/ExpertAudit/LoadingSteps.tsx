import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Loader2, Globe, Code, Shield, Brain, CheckCircle2, Target, Link2, Users } from 'lucide-react';

const technicalSteps = [
  { id: 'connect', label: 'Audit Speed et Performances...', icon: Globe },
  { id: 'html', label: 'Analyse du code HTML...', icon: Code },
  { id: 'links', label: 'Vérification des liens cassés...', icon: Link2 },
  { id: 'security', label: 'Vérification Safe Browsing...', icon: Shield },
  { id: 'ai', label: 'Calcul du score GEO & IA...', icon: Brain },
  { id: 'done', label: 'Génération du rapport...', icon: CheckCircle2 },
];

const strategicSteps = [
  { id: 'fetch', label: 'Récupération du contenu...', icon: Globe },
  { id: 'keywords', label: 'Étude des mots-clés...', icon: Target },
  { id: 'brand', label: 'Analyse de l\'identité de marque...', icon: Target },
  { id: 'competition', label: 'Analyse de la concurrence...', icon: Users },
  { id: 'geo', label: 'Évaluation du score GEO...', icon: Brain },
  { id: 'roadmap', label: 'Construction de la roadmap stratégique...', icon: Code },
  { id: 'done', label: 'Génération du rapport...', icon: CheckCircle2 },
];

interface LoadingStepsProps {
  siteName?: string;
  variant?: 'technical' | 'strategic';
}

export function LoadingSteps({ siteName, variant = 'technical' }: LoadingStepsProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = variant === 'strategic' ? strategicSteps : technicalSteps;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, variant === 'strategic' ? 8000 : 2500);

    return () => clearInterval(interval);
  }, [steps.length, variant]);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      {/* Spinning loader with ring */}
      <div className="relative">
        <div className={`h-20 w-20 rounded-full border-4 border-muted`}></div>
        <div className={`absolute inset-0 h-20 w-20 rounded-full border-4 border-t-transparent animate-spin ${
          variant === 'strategic' ? 'border-slate-500' : 'border-primary'
        }`}></div>
        <motion.div 
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          {variant === 'strategic' ? (
            <Target className="h-8 w-8 text-slate-600 dark:text-slate-400" />
          ) : (
            <Brain className="h-8 w-8 text-primary" />
          )}
        </motion.div>
      </div>

      {/* Animated "Analyse de [site]..." text */}
      <div className="flex items-center gap-1 text-xl font-semibold text-foreground">
        <span>Analyse {siteName ? `de ${siteName}` : ''}</span>
        <span className="inline-flex">
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
          >.</motion.span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          >.</motion.span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
          >.</motion.span>
        </span>
      </div>

      <div className="space-y-3 w-full max-w-md">
        <AnimatePresence mode="wait">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            const isPending = index > currentStep;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ 
                  opacity: isActive || isComplete ? 1 : 0.4, 
                  x: 0,
                  scale: isActive ? 1.02 : 1
                }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isActive 
                    ? variant === 'strategic' 
                      ? 'bg-slate-500/10 border border-slate-500/30' 
                      : 'bg-primary/10 border border-primary/30'
                    : isComplete 
                    ? 'bg-success/10' 
                    : isPending && variant === 'strategic'
                    ? 'bg-slate-500/5 border border-slate-500/20'
                    : 'bg-muted/30'
                }`}
              >
                <StepIcon className={`h-5 w-5 ${
                  isComplete ? 'text-success' : 
                  isActive 
                    ? variant === 'strategic' ? 'text-slate-600 dark:text-slate-400' : 'text-primary' 
                    : isPending && variant === 'strategic'
                    ? 'text-slate-500/60'
                    : 'text-muted-foreground'
                }`} />
                <span className={`text-sm ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
                {isComplete && (
                  <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
                )}
                {isActive && (
                  <motion.div
                    className="ml-auto"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <div className={`h-2 w-2 rounded-full ${variant === 'strategic' ? 'bg-slate-500' : 'bg-primary'}`} />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        L'analyse peut prendre jusqu'à 9 minutes.
        <br />
        <span className="text-xs opacity-70">Veuillez patienter pendant que nous analysons votre site en profondeur.</span>
      </p>
    </div>
  );
}
