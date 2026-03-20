import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { PersonaGate, type PersonaType } from '@/components/PersonaGate';
import { AnimatePresence, motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { trackAnalyticsEvent } from '@/hooks/useAnalytics';
import { useTurnstile } from '@/hooks/useTurnstile';
import { PasswordStrengthBar, isPasswordAcceptable } from '@/components/PasswordStrengthBar';

const translations = {
  fr: {
    signupTitle: 'Créer un compte',
    signupDesc: 'Rejoignez Crawlers AI pour sauvegarder vos analyses',
    email: 'Email',
    password: 'Mot de passe',
    confirmPassword: 'Confirmation',
    firstName: 'Prénom',
    lastName: 'Nom',
    signupButton: "S'inscrire",
    googleLogin: 'Continuer avec Google',
    hasAccount: 'Déjà un compte ?',
    login: 'Connexion',
    backToHome: 'Retour à l\'accueil',
    emailRequired: 'Email requis',
    emailInvalid: 'Email invalide',
    passwordMin: 'Minimum 6 caractères',
    passwordWeak: 'Mot de passe trop faible',
    passwordMismatch: 'Les mots de passe ne correspondent pas',
    signupSuccess: 'Inscription réussie !',
    signupError: 'Erreur lors de l\'inscription',
    or: 'ou',
    verifyTitle: 'Vérifiez votre email',
    verifyDesc: 'Nous vous avons envoyé un mail de confirmation avec un code de vérification à',
    verifyConfirm: 'Vérifier',
    verifying: 'Vérification...',
    invalidCode: 'Code invalide ou expiré',
    resend: 'Renvoyer le code',
    resending: 'Envoi...',
    resent: 'Code renvoyé !',
    checkSpam: 'Vérifiez aussi vos spams.',
  },
  en: {
    signupTitle: 'Create Account',
    signupDesc: 'Join Crawlers AI to save your analyses',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirmation',
    firstName: 'First Name',
    lastName: 'Last Name',
    signupButton: 'Sign Up',
    googleLogin: 'Continue with Google',
    hasAccount: 'Already have an account?',
    login: 'Log in',
    backToHome: 'Back to home',
    emailRequired: 'Email required',
    emailInvalid: 'Invalid email',
    passwordMin: 'Minimum 6 characters',
    passwordWeak: 'Password too weak',
    passwordMismatch: 'Passwords do not match',
    signupSuccess: 'Registration successful!',
    signupError: 'Error during signup',
    or: 'or',
    verifyTitle: 'Verify your email',
    verifyDesc: 'We sent you a confirmation email with a verification code to',
    verifyConfirm: 'Verify',
    verifying: 'Verifying...',
    invalidCode: 'Invalid or expired code',
    resend: 'Resend code',
    resending: 'Sending...',
    resent: 'Code resent!',
    checkSpam: 'Also check your spam folder.',
  },
  es: {
    signupTitle: 'Crear cuenta',
    signupDesc: 'Únete a Crawlers AI para guardar tus análisis',
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmación',
    firstName: 'Nombre',
    lastName: 'Apellido',
    signupButton: 'Registrarse',
    googleLogin: 'Continuar con Google',
    hasAccount: '¿Ya tienes cuenta?',
    login: 'Iniciar sesión',
    backToHome: 'Volver al inicio',
    emailRequired: 'Correo requerido',
    emailInvalid: 'Correo inválido',
    passwordMin: 'Mínimo 6 caracteres',
    passwordWeak: 'Contraseña demasiado débil',
    passwordMismatch: 'Las contraseñas no coinciden',
    signupSuccess: '¡Registro exitoso!',
    signupError: 'Error durante el registro',
    or: 'o',
    verifyTitle: 'Verifica tu email',
    verifyDesc: 'Le hemos enviado un correo de confirmación con un código de verificación a',
    verifyConfirm: 'Verificar',
    verifying: 'Verificando...',
    invalidCode: 'Código inválido o expirado',
    resend: 'Reenviar código',
    resending: 'Enviando...',
    resent: '¡Código reenviado!',
    checkSpam: 'Revisa también tu carpeta de spam.',
  },
};

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showExistsBanner, setShowExistsBanner] = useState(false);
  const [personaSelected, setPersonaSelected] = useState(!!sessionStorage.getItem('pending_persona_type'));
  const [isSigningUp, setIsSigningUp] = useState(false); // blocks auto-redirect during signup flow

  // Verification state
  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [otpShake, setOtpShake] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { user, signUpWithEmail, signInWithGoogle } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = translations[language] || translations.fr;
  const { containerRef, token, reset: resetTurnstile } = useTurnstile();

  // Handle email link verification (user clicked link in email)
  useEffect(() => {
    const verified = searchParams.get('verified');
    if (verified === 'true') {
      setStep('success');
      const doRedirect = () => setTimeout(() => navigate('/console'), 1500);
      if (!document.hidden) {
        doRedirect();
      } else {
        const handler = () => {
          if (!document.hidden) {
            document.removeEventListener('visibilitychange', handler);
            doRedirect();
          }
        };
        document.addEventListener('visibilitychange', handler);
      }
    }
  }, [searchParams]);

  // Track abandoned signups: user reached verify step but navigated away
  useEffect(() => {
    return () => {
      if (step === 'verify') {
        trackAnalyticsEvent('signup_abandoned' as any);
      }
    };
  }, [step]);

  useEffect(() => {
    if (user && step === 'form' && !isSigningUp) {
      const returnPath = sessionStorage.getItem('audit_return_path');
      const downloadReturnPath = sessionStorage.getItem('download_return_path');
      if (returnPath) {
        sessionStorage.removeItem('audit_return_path');
        navigate(returnPath);
      } else if (downloadReturnPath) {
        navigate(downloadReturnPath);
      } else {
        navigate('/');
      }
    }
  }, [user, navigate, step, isSigningUp]);

  const verifyTurnstile = async (): Promise<boolean> => {
    // Non-blocking: if token isn't ready yet, skip silently
    if (!token || token === 'TURNSTILE_UNAVAILABLE') return true;
    try {
      const { data, error } = await supabase.functions.invoke('verify-turnstile', { body: { token } });
      if (error || !data?.success) {
        resetTurnstile();
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const signupSchema = z.object({
    email: z.string().min(1, t.emailRequired).email(t.emailInvalid),
    password: z.string(),
    confirmPassword: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }).superRefine((data, ctx) => {
    if (!isPasswordAcceptable(data.password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: t.passwordWeak,
      });
      return;
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: t.passwordMismatch,
      });
    }
  });

  const signupForm = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', firstName: '', lastName: '' },
  });

  const watchedPassword = signupForm.watch('password');

  const handlePersonaSelect = (persona: PersonaType) => {
    sessionStorage.setItem('pending_persona_type', persona);
    setPersonaSelected(true);
  };

  // Check if user already exists before doing password validation
  const checkUserExistsFirst = async () => {
    const email = signupForm.getValues('email');
    if (!email || !z.string().email().safeParse(email).success) {
      await signupForm.trigger('email');
      return;
    }

    setIsLoading(true);
    setShowExistsBanner(false);

    try {
      const { data, error } = await supabase.functions.invoke('auth-actions', {
        body: { action: 'check-email', email },
      });

      if (!error && data?.exists === true) {
        setShowExistsBanner(true);
        setIsLoading(false);
        return;
      }
    } catch {
      // continue with normal validation flow if pre-check fails
    }

    setIsLoading(false);
    await signupForm.trigger(['password', 'confirmPassword']);
    signupForm.handleSubmit(handleSignup)();
  };

  const handleSignup = async (data: { email: string; password: string; confirmPassword: string; firstName?: string; lastName?: string }) => {
    setIsLoading(true);
    setShowExistsBanner(false);
    const verified = await verifyTurnstile();
    if (!verified) { setIsLoading(false); return; }

    let { error } = await signUpWithEmail(data.email, data.password, data.firstName || '', data.lastName || '');

    if (error && (error.message.includes('already registered') || error.message.includes('already exists'))) {
      try {
        const { data: emailCheck, error: emailCheckError } = await supabase.functions.invoke('auth-actions', {
          body: { action: 'check-email', email: data.email },
        });

        if (!emailCheckError && emailCheck?.exists === false) {
          const retry = await signUpWithEmail(data.email, data.password, data.firstName || '', data.lastName || '');
          error = retry.error;
        } else if (!emailCheckError && emailCheck?.exists === true) {
          setShowExistsBanner(true);
          setIsLoading(false);
          return;
        }
      } catch {
        // keep original signup error below
      }
    }

    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        try {
          const { data: emailCheck, error: emailCheckError } = await supabase.functions.invoke('auth-actions', {
            body: { action: 'check-email', email: data.email },
          });

          if (!emailCheckError && emailCheck?.exists === true) {
            setShowExistsBanner(true);
          } else {
            toast.error(t.signupError);
          }
        } catch {
          toast.error(t.signupError);
        }
      } else {
        toast.error(t.signupError);
      }
      resetTurnstile();
    } else {
      trackAnalyticsEvent('signup_complete');
      trackAnalyticsEvent('verification_email_sent' as any);
      setVerificationEmail(data.email);
      supabase.functions.invoke('send-verification-code', { body: { email: data.email } });
      setStep('verify');
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otpCode;
    if (code.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setOtpError(false);
    setOtpShake(false);

    try {
      const { data, error } = await supabase.functions.invoke('auth-actions', {
        body: { action: 'verify-code', email: verificationEmail, code },
      });
      if (error || !data?.success) {
        setOtpError(true);
        setOtpShake(true);
        setTimeout(() => setOtpShake(false), 600);
        setTimeout(() => { setOtpError(false); setOtpCode(''); }, 3000);
        setIsVerifying(false);
        return;
      }
      setOtpSuccess(true);
      setTimeout(() => {
        setStep('success');
        setTimeout(() => navigate('/console'), 1500);
      }, 800);
    } catch {
      setOtpError(true);
      setOtpShake(true);
      setTimeout(() => setOtpShake(false), 600);
      setTimeout(() => { setOtpError(false); setOtpCode(''); }, 3000);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setOtpError(false);
    setOtpCode('');
    try {
      await supabase.functions.invoke('auth-actions', {
        body: { action: 'send-code', email: verificationEmail },
      });
      toast.success(t.resent);
    } catch {
      toast.error('Error');
    } finally {
      setIsResending(false);
    }
  };

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (otpCode.length === 6 && step === 'verify' && !isVerifying) {
      handleVerifyCode(otpCode);
    }
  }, [otpCode]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(t.signupError);
      setIsLoading(false);
    }
  };

  const signupJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": language === 'en' ? 'Sign Up - Crawlers' : language === 'es' ? 'Registrarse - Crawlers' : 'Inscription - Crawlers',
    "description": language === 'en' ? 'Create your free Crawlers account. Access SEO, GEO, and AI audits.' : language === 'es' ? 'Crea tu cuenta gratuita en Crawlers.' : 'Créez votre compte Crawlers gratuitement. Accédez aux audits SEO, GEO et IA.',
    "url": "https://crawlers.fr/signup",
    "isPartOf": { "@type": "WebSite", "name": "Crawlers", "url": "https://crawlers.fr" },
    "potentialAction": { "@type": "RegisterAction", "target": "https://crawlers.fr/signup", "name": language === 'en' ? 'Create account' : language === 'es' ? 'Crear cuenta' : 'Créer un compte' }
  };

  useCanonicalHreflang('/signup');

  // Step 1: PersonaGate
  if (!personaSelected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Helmet>
          <title>{language === 'en' ? 'Sign Up - Crawlers' : language === 'es' ? 'Registrarse - Crawlers' : 'Inscription - Crawlers'}</title>
          <meta name="description" content={language === 'en' ? 'Create your free Crawlers account. Access SEO, GEO, and AI visibility audits.' : language === 'es' ? 'Crea tu cuenta gratuita en Crawlers. Auditorías SEO, GEO e IA.' : 'Créez votre compte Crawlers gratuit. Accédez aux audits SEO, GEO et de visibilité IA.'} />
          <meta name="robots" content="index, follow" />
          <script type="application/ld+json">{JSON.stringify(signupJsonLd)}</script>
        </Helmet>
        <AnimatePresence>
          <PersonaGate onSelect={handlePersonaSelect} />
        </AnimatePresence>
      </div>
    );
  }

  // Step 3: Success
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto"
          >
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </motion.div>
          <h2 className="text-xl font-bold text-green-500">{t.signupSuccess}</h2>
        </motion.div>
      </div>
    );
  }

  // Step 2b: Verification code (inline, not modal)
  if (step === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Helmet>
          <title>{language === 'en' ? 'Verify Email - Crawlers' : language === 'es' ? 'Verificar Email - Crawlers' : 'Vérification - Crawlers'}</title>
        </Helmet>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Card className="border-border/50 shadow-xl backdrop-blur-sm">
            <CardContent className="pt-8 pb-6 space-y-6">
              <div className="text-center space-y-2">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3"
                >
                  <Mail className="w-6 h-6 text-primary" />
                </motion.div>
                <h2 className="text-lg font-bold text-foreground">{t.verifyTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.verifyDesc}{' '}
                  <span className="font-medium text-foreground">{verificationEmail}</span>
                </p>
                <p className="text-xs text-muted-foreground">{t.checkSpam}</p>
              </div>

              <motion.div
                className="flex justify-center"
                animate={otpShake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.5 }}
              >
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => {
                    setOtpCode(value);
                    if (otpError) setOtpError(false);
                  }}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className={otpError ? 'border-destructive' : otpSuccess ? 'border-green-500 text-green-500' : ''}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </motion.div>

              <AnimatePresence>
                {otpError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2 text-sm text-destructive"
                  >
                    <XCircle className="w-4 h-4" />
                    {t.invalidCode}
                  </motion.div>
                )}
                {otpSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 text-sm text-green-500"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {t.signupSuccess}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                variant="outline"
                onClick={() => handleVerifyCode()}
                disabled={otpCode.length !== 6 || isVerifying}
                className="w-full border-primary text-primary hover:bg-primary/5 hover:text-primary"
              >
                {isVerifying ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t.verifying}</>
                ) : (
                  t.verifyConfirm
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isResending ? t.resending : t.resend}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Step 2a: Signup form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Helmet>
        <title>{language === 'en' ? 'Sign Up - Crawlers' : language === 'es' ? 'Registrarse - Crawlers' : 'Inscription - Crawlers'}</title>
        <meta name="description" content={language === 'en' ? 'Create your free Crawlers account. Access SEO, GEO, and AI visibility audits.' : language === 'es' ? 'Crea tu cuenta gratuita en Crawlers. Auditorías SEO, GEO e IA.' : 'Créez votre compte Crawlers gratuit. Accédez aux audits SEO, GEO et de visibilité IA.'} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(signupJsonLd)}</script>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent mb-4 transition-colors" aria-label={t.backToHome}>
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <Card className="border-border/50 shadow-xl backdrop-blur-sm">
          <CardHeader className="text-center pb-1 pt-3 px-5">
            <CardTitle className="text-lg font-bold">{t.signupTitle}</CardTitle>
            <CardDescription className="text-xs">{t.signupDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 px-5 pb-3 pt-1">
            {/* Google OAuth */}
            <Button variant="outline" className="w-full gap-2 h-9" onClick={handleGoogleLogin} disabled={isLoading}>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t.googleLogin}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t.or}</span></div>
            </div>

            <Form {...signupForm}>
              <form onSubmit={(e) => { e.preventDefault(); checkUserExistsFirst(); }} className="space-y-2.5">
                {showExistsBanner && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--brand-violet)/0.35)] bg-[hsl(var(--brand-violet-muted)/0.35)] p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-[hsl(var(--brand-violet))]" />
                    <p className="text-sm text-foreground flex-1">
                      {language === 'en' ? 'Already registered, would you like to ' : language === 'es' ? 'Ya registrado, ¿desea ' : 'Déjà inscrit, voulez-vous vous '}{' '}
                      <Link to={`/auth?email=${encodeURIComponent(signupForm.getValues('email'))}`} className="font-semibold text-[hsl(var(--brand-violet))] underline underline-offset-2 transition-colors hover:text-[hsl(var(--brand-violet)/0.8)]">
                        {language === 'en' ? 'sign in' : language === 'es' ? 'iniciar sesión' : 'connecter'}
                      </Link> ?
                    </p>
                  </motion.div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={signupForm.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t.firstName}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input {...field} className="pl-9 h-9 text-sm" autoFocus />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={signupForm.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t.lastName}</FormLabel>
                      <FormControl><Input {...field} className="h-9 text-sm" /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>

                <FormField control={signupForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t.email}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input {...field} type="email" className="pl-9 h-9 text-sm caret-primary" placeholder="email@example.com" />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={signupForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t.password}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        {!field.value && <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />}
                        <Input {...field} type={showPassword ? 'text' : 'password'} className={`${field.value ? 'pl-3' : 'pl-9'} pr-9 h-9 text-sm`} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </FormControl>
                    <PasswordStrengthBar password={watchedPassword} compact />
                  </FormItem>
                )} />

                <FormField control={signupForm.control} name="confirmPassword" render={({ field }) => (
                  <FormItem className="-mt-0.5">
                    <FormLabel className="text-xs">{t.confirmPassword}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        {!field.value && <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />}
                        <Input {...field} type={showConfirmPassword ? 'text' : 'password'} className={`${field.value ? 'pl-3' : 'pl-9'} pr-9 h-9 text-sm`} />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs text-primary" />
                  </FormItem>
                )} />

                {/* Turnstile */}
                <div ref={containerRef} className="flex justify-center" />

                <Button type="submit" className="w-full h-10 text-sm" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.signupButton}
                </Button>
              </form>
            </Form>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">{t.hasAccount}{' '}</span>
              <Link to="/auth" className="text-primary hover:underline font-medium">{t.login}</Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
