import { useState, useEffect } from 'react';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { VerificationCodeModal } from '@/components/VerificationCodeModal';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { trackAnalyticsEvent } from '@/hooks/useAnalytics';
import { useTurnstile } from '@/hooks/useTurnstile';
import { useLoginRateLimiter } from '@/hooks/useLoginRateLimiter';

const translations = {
  fr: {
    login: 'Connexion',
    signup: 'Inscription',
    loginTitle: 'Bienvenue !',
    loginDesc: 'Connectez-vous pour accéder à vos rapports',
    signupTitle: 'Créer un compte',
    signupDesc: 'Rejoignez Crawlers AI pour sauvegarder vos analyses',
    email: 'Email',
    password: 'Mot de passe',
    firstName: 'Prénom',
    lastName: 'Nom',
    loginButton: 'Se connecter',
    rememberMe: 'Se souvenir de moi',
    signupButton: "S'inscrire",
    googleLogin: 'Continuer avec Google',
    noAccount: "Pas encore de compte ?",
    hasAccount: 'Déjà un compte ?',
    backToHome: 'Retour à l\'accueil',
    emailRequired: 'Email requis',
    emailInvalid: 'Email invalide',
    passwordRequired: 'Mot de passe requis',
    passwordMin: 'Minimum 6 caractères',
    firstNameRequired: 'Prénom requis',
    lastNameRequired: 'Nom requis',
    loginSuccess: 'Connexion réussie !',
    signupSuccess: 'Compte créé avec succès !',
    loginError: 'Identifiants incorrects',
    signupError: 'Erreur lors de l\'inscription',
    userExists: 'Un compte existe déjà avec cet email',
    or: 'ou',
    rateLimited: 'Trop de tentatives. Réessayez dans {seconds}s.',
  },
  en: {
    login: 'Login',
    signup: 'Sign Up',
    loginTitle: 'Welcome',
    loginDesc: 'Sign in to access your reports',
    signupTitle: 'Create Account',
    signupDesc: 'Join Crawlers AI to save your analyses',
    email: 'Email',
    password: 'Password',
    firstName: 'First Name',
    lastName: 'Last Name',
    loginButton: 'Sign In',
    signupButton: 'Sign Up',
    googleLogin: 'Continue with Google',
    rememberMe: 'Remember me',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    backToHome: 'Back to home',
    emailRequired: 'Email required',
    emailInvalid: 'Invalid email',
    passwordRequired: 'Password required',
    passwordMin: 'Minimum 6 characters',
    firstNameRequired: 'First name required',
    lastNameRequired: 'Last name required',
    loginSuccess: 'Login successful!',
    signupSuccess: 'Account created successfully!',
    loginError: 'Invalid credentials',
    signupError: 'Error during signup',
    userExists: 'An account already exists with this email',
    or: 'or',
    rateLimited: 'Too many attempts. Try again in {seconds}s.',
  },
  es: {
    login: 'Iniciar sesión',
    signup: 'Registrarse',
    loginTitle: 'Bienvenido',
    loginDesc: 'Inicia sesión para acceder a tus informes',
    signupTitle: 'Crear cuenta',
    signupDesc: 'Únete a Crawlers AI para guardar tus análisis',
    email: 'Correo electrónico',
    password: 'Contraseña',
    firstName: 'Nombre',
    lastName: 'Apellido',
    loginButton: 'Iniciar sesión',
    signupButton: 'Registrarse',
    googleLogin: 'Continuar con Google',
    rememberMe: 'Recordarme',
    noAccount: '¿No tienes cuenta?',
    hasAccount: '¿Ya tienes cuenta?',
    backToHome: 'Volver al inicio',
    emailRequired: 'Correo requerido',
    emailInvalid: 'Correo inválido',
    passwordRequired: 'Contraseña requerida',
    passwordMin: 'Mínimo 6 caracteres',
    firstNameRequired: 'Nombre requerido',
    lastNameRequired: 'Apellido requerido',
    loginSuccess: '¡Inicio de sesión exitoso!',
    signupSuccess: '¡Cuenta creada con éxito!',
    loginError: 'Credenciales inválidas',
    signupError: 'Error durante el registro',
    userExists: 'Ya existe una cuenta con este correo',
    or: 'o',
    rateLimited: 'Demasiados intentos. Inténtalo en {seconds}s.',
  },
};

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode');
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('remember_me') === 'true');
  const [showExistsBanner, setShowExistsBanner] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = translations[language];
  useCanonicalHreflang('/auth');
  const inviteToken = searchParams.get('invite');
  const { containerRef, token, reset: resetTurnstile } = useTurnstile();
  const { isLocked, remainingSeconds, recordFailure, recordSuccess } = useLoginRateLimiter();

  const verifyTurnstile = async (): Promise<boolean> => {
    if (!token) {
      toast.error(language === 'fr' ? 'Veuillez compléter la vérification' : 'Please complete the verification');
      return false;
    }
    if (token === 'TURNSTILE_UNAVAILABLE') return true;
    try {
      const { data, error } = await supabase.functions.invoke('verify-turnstile', { body: { token } });
      if (error || !data?.success) {
        toast.error(language === 'fr' ? 'Vérification échouée, réessayez' : 'Verification failed, please retry');
        resetTurnstile();
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  // Accept invitation after login
  useEffect(() => {
    if (user && inviteToken) {
      supabase.functions.invoke('manage-team', {
        body: { action: 'accept_invitation', token: inviteToken },
      }).then(({ error }) => {
        if (error) {
          toast.error(String(error));
        } else {
          toast.success(language === 'fr' ? 'Invitation acceptée !' : 'Invitation accepted!');
        }
        navigate('/app/console');
      });
      return;
    }

    if (user) {
      const returnPath = sessionStorage.getItem('audit_return_path');
      const downloadReturnPath = sessionStorage.getItem('download_return_path');
      if (returnPath) {
        sessionStorage.removeItem('audit_return_path');
        navigate(returnPath);
      } else if (downloadReturnPath) {
        navigate(downloadReturnPath);
      } else {
        const auditUrl = sessionStorage.getItem('audit_url');
        if (auditUrl) {
          navigate('/audit-expert');
        } else {
          navigate('/app/console');
        }
      }
    }
  }, [user, navigate, inviteToken]);

  const loginSchema = z.object({
    email: z.string().min(1, t.emailRequired).email(t.emailInvalid),
    password: z.string().min(1, t.passwordRequired),
  });

  const signupSchema = z.object({
    email: z.string().min(1, t.emailRequired).email(t.emailInvalid),
    password: z.string().min(6, t.passwordMin),
    firstName: z.string().min(1, t.firstNameRequired),
    lastName: z.string().min(1, t.lastNameRequired),
  });

  const prefillEmail = searchParams.get('email') || '';

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefillEmail, password: '' },
  });

  const signupForm = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', firstName: '', lastName: '' },
  });

  const handleLogin = async (data: { email: string; password: string }) => {
    if (isLocked) {
      toast.error(t.rateLimited.replace('{seconds}', String(remainingSeconds)));
      return;
    }
    setIsLoading(true);
    const verified = await verifyTurnstile();
    if (!verified) { setIsLoading(false); return; }
    // Remember me: save email for next visit
    if (rememberMe) {
      localStorage.setItem('remember_me', 'true');
      localStorage.setItem('remember_email', data.email);
    } else {
      localStorage.removeItem('remember_me');
      localStorage.removeItem('remember_email');
    }
    const { error } = await signInWithEmail(data.email, data.password);
    setIsLoading(false);

    if (error) {
      recordFailure();
      toast.error(t.loginError);
      resetTurnstile();
    } else {
      recordSuccess();
      toast.success(t.loginSuccess);
    }
  };

  const handleSignup = async (data: { email: string; password: string; firstName: string; lastName: string }) => {
    setIsLoading(true);
    setShowExistsBanner(false);
    const verified = await verifyTurnstile();
    if (!verified) { setIsLoading(false); return; }

    let { error } = await signUpWithEmail(data.email, data.password, data.firstName, data.lastName);
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
      // Send verification code and show modal
      setVerificationEmail(data.email);
      supabase.functions.invoke('send-verification-code', { body: { email: data.email } });
      setShowVerification(true);
    }
  };

  const handleForgotPassword = async () => {
    const email = loginForm.getValues('email');
    if (!email) {
      toast.error(language === 'fr' ? 'Saisissez votre email d\'abord' : language === 'es' ? 'Ingrese su email primero' : 'Enter your email first');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(language === 'fr' ? 'Erreur, réessayez' : 'Error, try again');
    } else {
      toast.success(language === 'fr' ? 'Email de réinitialisation envoyé !' : language === 'es' ? '¡Email de restablecimiento enviado!' : 'Password reset email sent!');
    }
  };

  const handleSwitchToLogin = () => {
    setShowExistsBanner(false);
    setIsLogin(true);
    // Pre-fill login email from signup form
    const signupEmail = signupForm.getValues('email');
    if (signupEmail) {
      loginForm.setValue('email', signupEmail);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(t.loginError);
      setIsLoading(false);
    }
    // Don't set loading to false here - the redirect will handle that
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Helmet>
        <title>Connexion | Crawlers.fr</title>
        <meta name="description" content="Connectez-vous à Crawlers.fr pour accéder à vos audits SEO & GEO, suivre vos sites et optimiser votre visibilité IA." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent mb-6 transition-colors" aria-label={t.backToHome}>
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <Card className="border-border/50 shadow-xl backdrop-blur-sm">
          <CardHeader className="text-center pb-2 pt-4">
            <CardTitle className="text-2xl font-bold">
              {isLogin ? t.loginTitle : t.signupTitle}
            </CardTitle>
            <CardDescription>
              {isLogin ? t.loginDesc : t.signupDesc}
            </CardDescription>
            {!isLogin && (
              <p className="text-xs text-primary font-medium mt-1">
                {language === 'fr' ? '🎁 20 crédits offerts à l\'inscription' : language === 'es' ? '🎁 20 créditos gratis al registrarse' : '🎁 20 free credits on signup'}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-5 pb-4">
            {/* Google OAuth Button */}
            <Button
              variant="outline"
              className="w-full gap-2 h-11"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t.googleLogin}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t.or}</span>
              </div>
            </div>

            {isLogin ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.email}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input {...field} type="email" className="pl-10 caret-primary" autoFocus placeholder="email@example.com" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.password}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? 'text' : 'password'}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-center">
                    <Button type="submit" className="w-2/3 h-11 bg-[hsl(215,20%,28%)] hover:bg-[hsl(215,25%,35%)] text-white border-0 shadow-lg" disabled={isLoading || isLocked}>
                      {isLocked
                        ? t.rateLimited.replace('{seconds}', String(remainingSeconds))
                        : isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.loginButton}
                    </Button>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {language === 'fr' ? 'Mot de passe oublié ?' : language === 'es' ? '¿Contraseña olvidada?' : 'Forgot password?'}
                    </button>
                  </div>
                </form>
              </Form>
            ) : (
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                  {showExistsBanner && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3"
                    >
                      <AlertCircle className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm text-foreground flex-1">
                        {language === 'en' ? 'Already registered, would you like to ' : language === 'es' ? 'Ya registrado, ¿desea ' : 'Déjà inscrit, voulez-vous vous '}{' '}
                        <button
                          type="button"
                          onClick={handleSwitchToLogin}
                          className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                        >
                          {language === 'en' ? 'sign in' : language === 'es' ? 'iniciar sesión' : 'connecter'}
                        </button>
                        {' '}?
                      </p>
                    </motion.div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={signupForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.firstName}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input {...field} className="pl-10" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.lastName}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.email}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input {...field} type="email" className="pl-10 caret-primary" autoFocus placeholder="email@example.com" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.password}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? 'text' : 'password'}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.signupButton}
                  </Button>
                </form>
              </Form>
            )}

            {/* Turnstile CAPTCHA */}
            <div ref={containerRef} className="flex justify-center" />

            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {isLogin ? t.noAccount : t.hasAccount}{' '}
              </span>
              {isLogin ? (
                <Link to="/signup" className="text-primary hover:underline font-medium" onClick={() => trackAnalyticsEvent('signup_click')}>
                  {t.signup}
                </Link>
              ) : (
                <button type="button" onClick={() => setIsLogin(true)} className="text-primary hover:underline font-medium">
                  {t.login}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <VerificationCodeModal
        open={showVerification}
        email={verificationEmail}
        onVerified={() => {
          setShowVerification(false);
          toast.success(t.signupSuccess);
        }}
        onClose={() => setShowVerification(false)}
      />
    </div>
  );
}
