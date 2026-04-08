import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  /** Label for the next step */
  nextStepLabel?: string;
  /** Called after scroll-to-top + 1s delay */
  onNextStep: () => void;
  /** Scroll threshold to show the button (0-1) */
  scrollThreshold?: number;
}

const translations = {
  fr: { nextStep: 'Étape suivante' },
  en: { nextStep: 'Next step' },
  es: { nextStep: 'Siguiente paso' },
};

export function NextStepFloatingButton({ nextStepLabel, onNextStep, scrollThreshold = 0.3 }: Props) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const [visible, setVisible] = useState(false);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (triggered) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight <= 0) return;
      const scrollPct = scrollTop / docHeight;
      setVisible(scrollPct >= scrollThreshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollThreshold, triggered]);

  const handleClick = () => {
    setTriggered(true);
    setVisible(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      onNextStep();
    }, 1000);
  };

  return (
    <AnimatePresence>
      {visible && !triggered && (
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleClick}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 bg-card/80 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200 hover:border-foreground/30 group cursor-pointer"
        >
          <span className="text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors">
            {nextStepLabel || t.nextStep}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors group-hover:translate-x-0.5 duration-200" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
