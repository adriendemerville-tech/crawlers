import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, FileText, UserPlus, LogIn, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const translations = {
  fr: {
    title: 'Accédez à votre rapport',
    subtitle: 'Connectez-vous ou inscrivez-vous gratuitement pour consulter et sauvegarder vos rapports d\'audit.',
    signup: 'S\'inscrire gratuitement',
    login: 'Se connecter',
    benefit1: 'Rapports sauvegardés dans votre espace',
    benefit2: 'Téléchargement PDF illimité',
    benefit3: 'Partage par lien sécurisé',
  },
  en: {
    title: 'Access your report',
    subtitle: 'Log in or sign up for free to view and save your audit reports.',
    signup: 'Sign up for free',
    login: 'Log in',
    benefit1: 'Reports saved to your account',
    benefit2: 'Unlimited PDF downloads',
    benefit3: 'Secure link sharing',
  },
  es: {
    title: 'Accede a tu informe',
    subtitle: 'Inicia sesión o regístrate gratis para consultar y guardar tus informes de auditoría.',
    signup: 'Registrarse gratis',
    login: 'Iniciar sesión',
    benefit1: 'Informes guardados en tu cuenta',
    benefit2: 'Descargas PDF ilimitadas',
    benefit3: 'Compartir con enlace seguro',
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
  const navigate = useNavigate();
  const { user } = useAuth();

  // If user is already logged in, call onAuthenticated immediately
  if (user && isOpen) {
    onAuthenticated();
    return null;
  }

  if (!isOpen) return null;

  const handleSignup = () => {
    // Always store return path to /audit-expert for after auth
    sessionStorage.setItem('audit_return_path', '/audit-expert');
    sessionStorage.setItem('audit_pending_action', 'open_report');
    navigate('/auth?mode=signup');
  };

  const handleLogin = () => {
    // Always store return path to /audit-expert for after auth
    sessionStorage.setItem('audit_return_path', '/audit-expert');
    sessionStorage.setItem('audit_pending_action', 'open_report');
    navigate('/auth?mode=login');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative bg-card border border-border/60 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="pt-8 pb-4 px-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"
          >
            <FileText className="w-8 h-8 text-primary" />
          </motion.div>
          
          <h2 className="text-xl font-bold text-foreground mb-2">
            {t.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t.subtitle}
          </p>
        </div>

        {/* Benefits */}
        <div className="px-8 py-4 space-y-3">
          {[t.benefit1, t.benefit2, t.benefit3].map((benefit, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-success" />
              </div>
              <span className="text-sm text-foreground">{benefit}</span>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="p-8 pt-4 space-y-3">
          <Button 
            onClick={handleSignup} 
            className="w-full h-12 text-base font-medium gap-2 shadow-lg"
          >
            <UserPlus className="w-4 h-4" />
            {t.signup}
          </Button>
          
          <Button 
            onClick={handleLogin}
            variant="outline"
            className="w-full h-12 text-base font-medium gap-2"
          >
            <LogIn className="w-4 h-4" />
            {t.login}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
