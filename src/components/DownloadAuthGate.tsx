import { motion } from 'framer-motion';
import { FileText, UserPlus, LogIn, X, BarChart3, Compass, Briefcase, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const translations = {
  fr: {
    title: 'Téléchargez vos rapports',
    subtitle: 'Connectez-vous pour accéder à tous vos outils SEO.',
    benefit1: 'Suivi des statistiques',
    benefit2: 'Conseils 360°',
    benefit3: 'Fonctions dédiées aux Pros',
    tagline1: 'Autonomie',
    tagline2: 'Pédagogie',
    signup: 'S\'inscrire gratuitement',
    login: 'Se connecter',
  },
  en: {
    title: 'Download your reports',
    subtitle: 'Log in to access all your SEO tools.',
    benefit1: 'Statistics tracking',
    benefit2: '360° advice',
    benefit3: 'Pro-dedicated features',
    tagline1: 'Autonomy',
    tagline2: 'Education',
    signup: 'Sign up for free',
    login: 'Log in',
  },
  es: {
    title: 'Descarga tus informes',
    subtitle: 'Inicia sesión para acceder a todas tus herramientas SEO.',
    benefit1: 'Seguimiento de estadísticas',
    benefit2: 'Consejos 360°',
    benefit3: 'Funciones dedicadas a Pros',
    tagline1: 'Autonomía',
    tagline2: 'Pedagogía',
    signup: 'Registrarse gratis',
    login: 'Iniciar sesión',
  },
};

interface DownloadAuthGateProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  returnPath?: string;
  pendingAction?: string;
}

export function DownloadAuthGate({ isOpen, onClose, onAuthenticated, returnPath = '/', pendingAction = 'true' }: DownloadAuthGateProps) {
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
    sessionStorage.setItem('download_pending', pendingAction);
    sessionStorage.setItem('download_return_path', returnPath);
    navigate('/auth?mode=signup');
  };

  const handleLogin = () => {
    sessionStorage.setItem('download_pending', pendingAction);
    sessionStorage.setItem('download_return_path', returnPath);
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
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
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

        {/* Benefits with marketing copy */}
        <div className="px-8 py-4 space-y-3">
          {/* Main marketing message */}
          <div className="bg-muted/50 rounded-xl p-4 mb-4">
            <p className="text-sm text-foreground leading-relaxed">
              <span className="font-medium">{t.benefit1}</span>, {t.benefit2.toLowerCase()} et vos <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">codes</code> correctifs.
            </p>
          </div>

          {/* Benefits list */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FolderCheck className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-foreground">{t.benefit1}</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-foreground">{t.benefit2}</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Code2 className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-foreground">
              Vos <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">codes</code> correctifs
            </span>
          </motion.div>
        </div>

        {/* Taglines */}
        <div className="px-8 py-3 border-t border-border/40">
          <div className="flex items-center justify-center gap-6 text-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-2 text-primary font-medium"
            >
              <span>✨</span>
              <span>{t.tagline1}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-2 text-success font-medium"
            >
              <PiggyBank className="w-4 h-4" />
              <span>{t.tagline2}</span>
            </motion.div>
          </div>
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
