import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Search, Megaphone, ShoppingBag, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export type PersonaType = 'entrepreneur' | 'seo_pro' | 'marketing' | 'ecommerce';

interface PersonaGateProps {
  onSelect: (persona: PersonaType) => void;
}

const translations = {
  fr: {
    question: 'Pour personnaliser votre expérience Crawlers, quel est votre profil ?',
    entrepreneur: 'Entrepreneur / Dirigeant',
    seo_pro: 'Expert SEO / SIO',
    marketing: 'Responsable Audience / Marketing',
  },
  en: {
    question: 'To personalize your Crawlers experience, what is your profile?',
    entrepreneur: 'Entrepreneur / Executive',
    seo_pro: 'SEO / SIO Expert',
    marketing: 'Audience / Marketing Manager',
  },
  es: {
    question: 'Para personalizar tu experiencia Crawlers, ¿cuál es tu perfil?',
    entrepreneur: 'Emprendedor / Directivo',
    seo_pro: 'Experto SEO / SIO',
    marketing: 'Responsable de Audiencia / Marketing',
  },
};

const personas: { id: PersonaType; icon: typeof Briefcase; gradient: string }[] = [
  { id: 'entrepreneur', icon: Briefcase, gradient: 'from-violet-600 to-violet-400' },
  { id: 'seo_pro', icon: Search, gradient: 'from-violet-500 to-amber-400' },
  { id: 'marketing', icon: Megaphone, gradient: 'from-amber-500 to-amber-300' },
];

export function PersonaGate({ onSelect }: PersonaGateProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [selected, setSelected] = useState<PersonaType | null>(null);

  const handleClick = (id: PersonaType) => {
    setSelected(id);
    setTimeout(() => onSelect(id), 500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/98 backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-8 px-6 max-w-lg w-full">
        {/* Question */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-xl sm:text-2xl font-bold text-center leading-tight"
          style={{ fontFamily: "'Space Grotesk Variable', sans-serif" }}
        >
          <span className="bg-gradient-to-r from-violet-600 via-violet-400 to-amber-400 bg-clip-text text-transparent">
            {t.question}
          </span>
        </motion.h1>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          {personas.map((p, i) => {
            const Icon = p.icon;
            const isSelected = selected === p.id;
            const isDisabled = selected !== null && !isSelected;

            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: isDisabled ? 0.4 : 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.3 }}
                onClick={() => !selected && handleClick(p.id)}
                disabled={!!selected}
                className={`
                  group relative w-full rounded-xl border-2 p-4 sm:p-5
                  transition-all duration-300 cursor-pointer
                  ${isSelected
                    ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20'
                    : 'border-border/60 bg-card hover:border-violet-400/60 hover:shadow-md hover:shadow-violet-500/10'
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                    bg-gradient-to-br ${p.gradient} shadow-sm
                  `}>
                    {isSelected ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Icon className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-foreground text-left">
                    {t[p.id]}
                  </span>
                </div>

                {/* Subtle glow on hover */}
                <div className={`
                  absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300
                  bg-gradient-to-r ${p.gradient} blur-xl -z-10
                  ${isSelected ? 'opacity-30' : ''}
                `} style={{ transform: 'scale(0.95)' }} />
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
