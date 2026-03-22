import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, ListChecks, Rocket, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'cocoon_onboarding_done';

const i18n = {
  fr: {
    steps: [
      { title: 'Analysons', desc: 'Notre moteur sémantique scanne votre site, détecte les clusters thématiques et évalue chaque page.', icon: Search },
      { title: 'Priorisons', desc: 'L\'assistant identifie les quick wins et propose un plan d\'action priorisé par impact SEO.', icon: ListChecks },
      { title: 'Agissons', desc: 'Validez les tâches, générez le code correctif et déployez en un clic via le plan d\'action.', icon: Rocket },
    ],
    skip: 'Passer',
    next: 'Suivant',
    start: 'C\'est parti !',
  },
  en: {
    steps: [
      { title: 'Analyze', desc: 'Our semantic engine scans your site, detects topic clusters and evaluates each page.', icon: Search },
      { title: 'Prioritize', desc: 'The assistant identifies quick wins and builds a prioritized action plan by SEO impact.', icon: ListChecks },
      { title: 'Act', desc: 'Validate tasks, generate corrective code and deploy in one click via the action plan.', icon: Rocket },
    ],
    skip: 'Skip',
    next: 'Next',
    start: 'Let\'s go!',
  },
  es: {
    steps: [
      { title: 'Analicemos', desc: 'Nuestro motor semántico escanea tu sitio, detecta clusters temáticos y evalúa cada página.', icon: Search },
      { title: 'Prioricemos', desc: 'El asistente identifica quick wins y propone un plan de acción priorizado por impacto SEO.', icon: ListChecks },
      { title: 'Actuemos', desc: 'Valida las tareas, genera el código correctivo y despliega en un clic desde el plan de acción.', icon: Rocket },
    ],
    skip: 'Omitir',
    next: 'Siguiente',
    start: '¡Vamos!',
  },
};

export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}

export function CocoonOnboardingStepper({ onComplete }: { onComplete: () => void }) {
  const { language } = useLanguage();
  const t = i18n[language] || i18n.fr;
  const [step, setStep] = useState(0);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    onComplete();
  };

  const currentStep = t.steps[step];
  const Icon = currentStep.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-[#1a1035] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
      >
        <button onClick={finish} className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {t.steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-emerald-400' : i < step ? 'w-4 bg-emerald-400/40' : 'w-4 bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -30, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="text-center space-y-5"
          >
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Icon className="w-8 h-8 text-emerald-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white tracking-tight">
                <span className="text-emerald-400">{step + 1}.</span> {currentStep.title}
              </h3>
              <p className="text-white/60 text-sm leading-relaxed">{currentStep.desc}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8">
          <button onClick={finish} className="text-white/40 text-sm hover:text-white/60 transition-colors">
            {t.skip}
          </button>

          {step < 2 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
            >
              {t.next} <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={finish}
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 animate-[glow-pulse_2s_ease-in-out_infinite]"
            >
              {t.start} <Rocket className="w-4 h-4" />
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
