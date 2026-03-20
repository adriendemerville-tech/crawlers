import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFreemiumMode } from '@/contexts/FreemiumContext';
import { trackAnalyticsEvent } from '@/hooks/useAnalytics';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: {
    message: 'Pour conserver les données de votre analyse dans la Console, inscrivez-vous.',
    cta: "S'inscrire",
  },
  en: {
    message: 'To save your analysis data in the Console, sign up.',
    cta: 'Sign up',
  },
  es: {
    message: 'Para conservar los datos de su análisis en la Consola, regístrese.',
    cta: 'Registrarse',
  },
};

/**
 * Conditions for showing the modal:
 * - Freemium open mode is ON
 * - User is NOT authenticated
 * - One of:
 *   1. User navigates to /console
 *   2. User stays on a feature page > 20s
 *   3. 30s after an expert audit completes (signalled via custom event)
 */
export function SignupPromptModal() {
  const { user } = useAuth();
  const { openMode } = useFreemiumMode();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const dismissed = useRef(false);
  const tracked = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Don't show if user is logged in, freemium is off, or already dismissed this session
  const shouldActivate = openMode && !user && !dismissed.current;

  // Track modal shown
  useEffect(() => {
    if (visible && !tracked.current) {
      tracked.current = true;
      trackAnalyticsEvent('signup_prompt_shown' as any);
    }
  }, [visible]);

  // Trigger 1: detect /console navigation
  useEffect(() => {
    if (!shouldActivate) return;
    if (window.location.pathname === '/console') {
      setVisible(true);
    }
  }, [shouldActivate]);

  // Trigger 2: 20s on any feature page (has URL in path or query)
  useEffect(() => {
    if (!shouldActivate || visible) return;
    const featurePages = ['/audit', '/console', '/cocoon', '/matrice'];
    const isFeaturePage = featurePages.some(p => window.location.pathname.startsWith(p));
    if (!isFeaturePage) return;

    timerRef.current = setTimeout(() => {
      if (!dismissed.current) setVisible(true);
    }, 20_000);

    return () => clearTimeout(timerRef.current);
  }, [shouldActivate, visible]);

  // Trigger 3: 30s after expert audit completes (listen for custom event)
  useEffect(() => {
    if (!shouldActivate) return;
    const handler = () => {
      setTimeout(() => {
        if (!dismissed.current && !user) setVisible(true);
      }, 30_000);
    };
    window.addEventListener('expert-audit-complete', handler);
    return () => window.removeEventListener('expert-audit-complete', handler);
  }, [shouldActivate, user]);

  if (!visible) return null;

  const handleClose = () => {
    dismissed.current = true;
    setVisible(false);
    trackAnalyticsEvent('signup_prompt_closed' as any);
  };

  const handleSignup = () => {
    navigate('/signup');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-background border border-border rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <p className="text-sm text-foreground/80 leading-relaxed pr-6 mt-1">
          {t.message}
        </p>

        {/* CTA */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSignup}
            className="px-5 py-2 text-sm font-medium text-primary border border-primary rounded-lg bg-transparent hover:bg-primary/5 transition-colors"
          >
            {t.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
