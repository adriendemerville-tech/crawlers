import { motion } from 'framer-motion';
import { Lock, Sparkles, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const translations = {
  fr: {
    title: 'Rapport IA Prêt',
    subtitle: 'Inscrivez-vous gratuitement pour révéler l\'analyse de sentiment et les hallucinations détectées.',
    button: 'S\'inscrire pour voir les résultats',
    loginLink: 'Déjà inscrit ? Se connecter',
  },
  en: {
    title: 'AI Report Ready',
    subtitle: 'Sign up for free to reveal the sentiment analysis and detected hallucinations.',
    button: 'Sign up to see results',
    loginLink: 'Already registered? Log in',
  },
  es: {
    title: 'Informe IA Listo',
    subtitle: 'Regístrate gratis para revelar el análisis de sentimiento y las alucinaciones detectadas.',
    button: 'Registrarse para ver resultados',
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

  const handleLogin = () => {
    navigate('/auth');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
      className="absolute inset-0 z-10 flex items-center justify-center p-4"
    >
      <motion.div 
        className="bg-background/95 backdrop-blur-md border border-border/60 p-8 rounded-2xl shadow-2xl max-w-sm text-center"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 500 }}
          className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5"
        >
          <Lock className="w-8 h-8 text-primary" />
        </motion.div>

        <motion.h3 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-bold mb-2 text-foreground"
        >
          {t.title}
        </motion.h3>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground mb-6 text-sm leading-relaxed"
        >
          {t.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <Button 
            onClick={onRegister} 
            className="w-full gap-2 h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <UserPlus className="w-4 h-4" />
            {t.button}
          </Button>

          <button 
            onClick={handleLogin}
            className="text-sm text-primary hover:underline transition-all"
          >
            {t.loginLink}
          </button>
        </motion.div>

        {/* Decorative sparkles */}
        <motion.div
          animate={{ 
            rotate: [0, 10, -10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 3,
            ease: "easeInOut"
          }}
          className="absolute -top-3 -right-3"
        >
          <Sparkles className="w-6 h-6 text-amber-400" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
