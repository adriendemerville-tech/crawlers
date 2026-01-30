import { motion } from 'framer-motion';
import { Lock, UserPlus, LogIn, FolderCheck, ClipboardList, Code2, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const translations = {
  fr: {
    title: 'Rapport IA Prêt',
    subtitle: 'Inscrivez-vous gratuitement pour révéler l\'analyse de sentiment et les hallucinations détectées.',
    benefit1: 'Retrouvez tous vos rapports',
    benefit2: 'Vos plans d\'action',
    benefit3: 'Vos codes correctifs',
    tagline1: 'Devenez autonome sur le SEO',
    tagline2: 'Faites des économies',
    button: 'S\'inscrire gratuitement',
    loginLink: 'Déjà inscrit ? Se connecter',
  },
  en: {
    title: 'AI Report Ready',
    subtitle: 'Sign up for free to reveal the sentiment analysis and detected hallucinations.',
    benefit1: 'Find all your reports',
    benefit2: 'Your action plans',
    benefit3: 'Your corrective codes',
    tagline1: 'Become SEO autonomous',
    tagline2: 'Save money',
    button: 'Sign up for free',
    loginLink: 'Already registered? Log in',
  },
  es: {
    title: 'Informe IA Listo',
    subtitle: 'Regístrate gratis para revelar el análisis de sentimiento y las alucinaciones detectadas.',
    benefit1: 'Encuentra todos tus informes',
    benefit2: 'Tus planes de acción',
    benefit3: 'Tus códigos correctivos',
    tagline1: 'Sé autónomo en SEO',
    tagline2: 'Ahorra dinero',
    button: 'Registrarse gratis',
    loginLink: '¿Ya registrado? Iniciar sesión',
  },
};

interface RegistrationGateProps {
  onRegister: () => void;
}

export function RegistrationGate({ onRegister }: RegistrationGateProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const navigate = useNavigate();

  const handleRegisterClick = () => {
    // Save pending action for after auth
    sessionStorage.setItem('audit_pending_action', 'unblur_strategic');
    sessionStorage.setItem('audit_return_path', '/audit-expert');
    onRegister();
  };

  const handleLogin = () => {
    sessionStorage.setItem('audit_pending_action', 'unblur_strategic');
    sessionStorage.setItem('audit_return_path', '/audit-expert');
    navigate('/auth?mode=login');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
      className="absolute inset-x-0 top-0 z-10 flex items-start justify-center pt-8 px-4"
    >
      <motion.div 
        className="bg-background/95 backdrop-blur-md border border-border/60 p-6 rounded-xl shadow-2xl max-w-sm w-full"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Header */}
        <div className="text-center mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 500 }}
            className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3"
          >
            <Lock className="w-6 h-6 text-primary" />
          </motion.div>
          <motion.h3 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg font-bold text-foreground mb-1"
          >
            {t.title}
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground text-sm leading-relaxed"
          >
            {t.subtitle}
          </motion.p>
        </div>

        {/* Benefits with marketing copy */}
        <div className="space-y-2 mb-4">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FolderCheck className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm text-foreground">{t.benefit1}</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm text-foreground">{t.benefit2}</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Code2 className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm text-foreground">
              Vos <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">codes</code> correctifs
            </span>
          </motion.div>
        </div>

        {/* Taglines */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-4 text-xs mb-4 py-2 border-t border-border/40"
        >
          <div className="flex items-center gap-1.5 text-primary font-medium">
            <span>✨</span>
            <span>{t.tagline1}</span>
          </div>
          <div className="flex items-center gap-1.5 text-success font-medium">
            <PiggyBank className="w-3.5 h-3.5" />
            <span>{t.tagline2}</span>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="space-y-2"
        >
          <Button 
            onClick={handleRegisterClick} 
            className="w-full gap-2 h-10 text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <UserPlus className="w-4 h-4" />
            {t.button}
          </Button>

          <Button 
            onClick={handleLogin}
            variant="outline"
            className="w-full gap-2 h-9 text-sm"
          >
            <LogIn className="w-3.5 h-3.5" />
            {t.loginLink}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

