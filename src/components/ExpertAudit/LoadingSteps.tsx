import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Loader2, Globe, Code, Shield, Brain, CheckCircle2 } from 'lucide-react';

const steps = [
  { id: 'connect', label: 'Connexion à Google PageSpeed...', icon: Globe },
  { id: 'html', label: 'Analyse du code HTML...', icon: Code },
  { id: 'security', label: 'Vérification Safe Browsing...', icon: Shield },
  { id: 'ai', label: 'Calcul du score GEO & IA...', icon: Brain },
  { id: 'done', label: 'Génération du rapport...', icon: CheckCircle2 },
];

export function LoadingSteps() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      {/* Spinning loader with ring */}
      <div className="relative">
        <div className="h-20 w-20 rounded-full border-4 border-muted"></div>
        <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        <motion.div 
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Brain className="h-8 w-8 text-primary" />
        </motion.div>
      </div>

      {/* Animated "Analyse..." text */}
      <div className="flex items-center gap-1 text-xl font-semibold text-foreground">
        <span>Analyse</span>
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
                  isActive ? 'bg-primary/10 border border-primary/30' : 
                  isComplete ? 'bg-success/10' : 'bg-muted/30'
                }`}
              >
                <StepIcon className={`h-5 w-5 ${
                  isComplete ? 'text-success' : 
                  isActive ? 'text-primary' : 'text-muted-foreground'
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
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <p className="text-sm text-muted-foreground">
        L'analyse complète prend environ 15 secondes...
      </p>
    </div>
  );
}
