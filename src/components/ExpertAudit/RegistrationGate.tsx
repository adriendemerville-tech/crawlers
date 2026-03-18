import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderCheck, ClipboardList, Code2, PiggyBank } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { InlineAuthForm } from './InlineAuthForm';

const translations = {
  fr: {
    title: 'Rapport IA prêt',
    subtitle: 'Révélez l\'analyse de sentiment et les hallucinations détectées.',
    benefit1: 'Retrouvez tous vos rapports',
    benefit2: 'Vos plans d\'action',
    benefit3: 'Vos codes correctifs',
    tagline1: 'Devenez autonome',
    tagline2: 'Faites des économies',
  },
  en: {
    title: 'AI Report ready',
    subtitle: 'Reveal the sentiment analysis and detected hallucinations.',
    benefit1: 'Find all your reports',
    benefit2: 'Your action plans',
    benefit3: 'Your corrective codes',
    tagline1: 'Become autonomous',
    tagline2: 'Save money',
  },
  es: {
    title: 'Informe IA listo',
    subtitle: 'Revela el análisis de sentimiento y las alucinaciones detectadas.',
    benefit1: 'Encuentra todos tus informes',
    benefit2: 'Tus planes de acción',
    benefit3: 'Tus códigos correctivos',
    tagline1: 'Sé autónomo',
    tagline2: 'Ahorra dinero',
  },
};

export function RegistrationGate() {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const { user } = useAuth();
  const [isExiting, setIsExiting] = useState(false);

  // If user is logged in, don't show the gate at all
  if (user) return null;

  const handleAuthSuccess = () => {
    // Trigger exit animation
    setIsExiting(true);
  };

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
          className="absolute inset-x-0 top-0 z-10 flex items-start justify-center pt-8 px-4"
        >
          <motion.div 
            className="bg-background/95 backdrop-blur-md border border-border/60 p-4 rounded-xl shadow-2xl max-w-sm w-full"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Header */}
            <div className="text-center mb-3">
              <motion.h3
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 500 }}
                className="text-base font-bold text-foreground mb-1"
              >
                {t.title}
              </motion.h3>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground text-xs leading-relaxed"
              >
                {t.subtitle}
              </motion.p>
            </div>

            {/* Benefits with marketing copy */}
            <div className="space-y-1.5 mb-3">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
                className="flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FolderCheck className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs text-foreground">{t.benefit1}</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs text-foreground">{t.benefit2}</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 }}
                className="flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Code2 className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs text-foreground">
                  Vos <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">codes</code> correctifs
                </span>
              </motion.div>
            </div>

            {/* Taglines */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-3 text-[10px] mb-3 py-1.5 border-t border-border/40"
            >
              <div className="flex items-center gap-1 text-primary font-medium">
                <span>✨</span>
                <span>{t.tagline1}</span>
              </div>
              <div className="flex items-center gap-1 text-success font-medium">
                <PiggyBank className="w-3 h-3" />
                <span>{t.tagline2}</span>
              </div>
            </motion.div>

            {/* Inline Auth Form */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              <InlineAuthForm 
                defaultMode="signup" 
                onSuccess={handleAuthSuccess}
                showPersonaGate
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
