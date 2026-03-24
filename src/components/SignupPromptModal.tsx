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
 *   2. User stays on a feature page > 60s
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

  const shouldActivate = openMode && !user && !dismissed.current;

  useEffect(() => {
    if (visible && !tracked.current) {
      tracked.current = true;
      trackAnalyticsEvent('signup_prompt_shown' as any);
    }
  }, [visible]);

  useEffect(() => {
    if (!shouldActivate) return;
    if (window.location.pathname === '/app/console') {
      setVisible(true);
    }
  }, [shouldActivate]);

  // Trigger 2: 60s on any feature page
  useEffect(() => {
    if (!shouldActivate || visible) return;
    const featurePages = ['/audit', '/app/console', '/app/cocoon', '/matrice'];
    const isFeaturePage = featurePages.some(p => window.location.pathname.startsWith(p));
    if (!isFeaturePage) return;

    timerRef.current = setTimeout(() => {
      if (!dismissed.current) setVisible(true);
    }, 60_000);

    return () => clearTimeout(timerRef.current);
  }, [shouldActivate, visible]);

  // Trigger 3: 30s after expert audit completes
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="relative bg-background border border-primary/30 rounded-lg shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        {/* Top accent line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <div className="p-5">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Robot logo + Content */}
          <div className="flex items-start gap-3 pr-5">
            <div className="shrink-0 mt-0.5">
              <svg className="h-8 w-8" viewBox="0 0 48 48" aria-hidden="true">
                <defs>
                  <linearGradient id="signupRobotGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#d4a853"/>
                    <stop offset="30%" stopColor="#8b5cf6"/>
                    <stop offset="70%" stopColor="#7c3aed"/>
                    <stop offset="100%" stopColor="#3b5998"/>
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="48" height="48" rx="10" ry="10" fill="url(#signupRobotGrad)"/>
                <g transform="translate(8.4, 8.4) scale(1.3)" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <path d="M12 8V4H8"/>
                  <rect x="4" y="8" width="16" height="12" rx="2"/>
                  <path d="M2 14h2"/>
                  <path d="M20 14h2"/>
                  <path d="M9 13v2"/>
                  <path d="M15 13v2"/>
                </g>
              </svg>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {t.message}
            </p>
          </div>

          {/* CTA */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSignup}
              className="px-5 py-2 text-sm font-medium text-primary border border-primary/40 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors active:scale-[0.97]"
            >
              {t.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
