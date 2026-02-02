import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderCheck, ClipboardList, Code2, PiggyBank, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { InlineAuthForm } from './InlineAuthForm';

const translations = {
  fr: {
    title: 'Accédez à votre rapport',
    subtitle: 'Connectez-vous pour consulter et sauvegarder vos rapports d\'audit.',
    benefit1: 'Retrouvez tous vos rapports',
    benefit2: 'Vos plans d\'action',
    benefit3: 'Vos codes correctifs',
    tagline1: 'Devenez autonome',
    tagline2: 'Faites des économies',
  },
  en: {
    title: 'Access your report',
    subtitle: 'Log in to view and save your audit reports.',
    benefit1: 'Find all your reports',
    benefit2: 'Your action plans',
    benefit3: 'Your corrective codes',
    tagline1: 'Become autonomous',
    tagline2: 'Save money',
  },
  es: {
    title: 'Accede a tu informe',
    subtitle: 'Inicia sesión para consultar y guardar tus informes de auditoría.',
    benefit1: 'Encuentra todos tus informes',
    benefit2: 'Tus planes de acción',
    benefit3: 'Tus códigos correctivos',
    tagline1: 'Sé autónomo',
    tagline2: 'Ahorra dinero',
  },
};

interface ReportAuthGateProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  returnPath?: string;
}

export function ReportAuthGate({ isOpen, onClose, onAuthenticated, returnPath }: ReportAuthGateProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const { user } = useAuth();
  const [isExiting, setIsExiting] = useState(false);

  // If user is already logged in, call onAuthenticated immediately
  if (user && isOpen) {
    onAuthenticated();
    return null;
  }

  if (!isOpen) return null;

  const handleAuthSuccess = () => {
    setIsExiting(true);
    setTimeout(() => {
      onAuthenticated();
    }, 300);
  };

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
            className="relative bg-background/95 backdrop-blur-md border border-border/60 p-4 rounded-xl shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

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
                defaultMode="login" 
                onSuccess={handleAuthSuccess}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
