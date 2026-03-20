import { motion } from 'framer-motion';
import { Check, BarChart3, Brain, CreditCard } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: {
    step1: 'Audit Technique SEO',
    step2: 'Audit Stratégique GEO',
    step3: 'Architecte Génératif',
  },
  en: {
    step1: 'Technical SEO Audit',
    step2: 'Strategic GEO Audit',
    step3: 'Generative Architect',
  },
  es: {
    step1: 'Auditoría Técnica SEO',
    step2: 'Auditoría Estratégica GEO',
    step3: 'Arquitecto Generativo',
  },
};

interface StepperProgressProps {
  currentStep: number;
}

export function StepperProgress({ currentStep }: StepperProgressProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  const steps = [
    { id: 1, label: t.step1, icon: BarChart3 },
    { id: 2, label: t.step2, icon: Brain },
    { id: 3, label: t.step3, icon: CreditCard },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-center mb-12 max-w-4xl mx-auto px-4"
    >
      {steps.map((step, index) => {
        const isPast = currentStep > step.id;
        const isActive = currentStep === step.id;
        const isFuture = currentStep < step.id;
        const StepIcon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 font-bold transition-all duration-500 ${
                  isPast
                    ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700'
                    : isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30'
                    : 'bg-background text-muted-foreground/40 border-muted-foreground/20'
                }`}
              >
                {isPast ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500 }}
                  >
                    <Check className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block transition-colors duration-300 ${
                  isPast
                    ? 'text-green-600 dark:text-green-400'
                    : isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/40'
                }`}
              >
                {step.label}
              </span>
            </motion.div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-3 sm:mx-6 h-1 rounded-full overflow-hidden bg-muted-foreground/10 min-w-[40px] sm:min-w-[80px]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ 
                    // Fill the connector when:
                    // - This step is past (currentStep > step.id), OR
                    // - The NEXT step is active or past (currentStep >= step.id + 1)
                    width: currentStep >= step.id + 1 ? '100%' : '0%' 
                  }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
            )}
          </div>
        );
      })}
    </motion.div>
  );
}
