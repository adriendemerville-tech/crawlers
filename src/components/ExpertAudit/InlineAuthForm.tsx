import { useState, useRef, useCallback } from 'react';
import { VerificationCodeModal } from '@/components/VerificationCodeModal';
import { PersonaGate, type PersonaType } from '@/components/PersonaGate';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { useTurnstile } from '@/hooks/useTurnstile';
import { supabase } from '@/integrations/supabase/client';

const translations = {
  fr: {
    login: 'Connexion',
    signup: 'Inscription',
    email: 'Email',
    password: 'Mot de passe',
    firstName: 'Prénom',
    lastName: 'Nom',
    loginButton: 'Se connecter',
    signupButton: "S'inscrire",
    googleLogin: 'Continuer avec Google',
    noAccount: "Pas encore de compte ?",
    hasAccount: 'Déjà un compte ?',
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
    existingUserDetected: 'Compte existant détecté',
  },
  en: {
    login: 'Login',
    signup: 'Sign Up',
    email: 'Email',
    password: 'Password',
    firstName: 'First Name',
    lastName: 'Last Name',
    loginButton: 'Sign In',
    signupButton: 'Sign Up',
    googleLogin: 'Continue with Google',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
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
    existingUserDetected: 'Existing account detected',
  },
  es: {
    login: 'Iniciar sesión',
    signup: 'Registrarse',
    email: 'Correo electrónico',
    password: 'Contraseña',
    firstName: 'Nombre',
    lastName: 'Apellido',
    loginButton: 'Iniciar sesión',
    signupButton: 'Registrarse',
    googleLogin: 'Continuar con Google',
    noAccount: '¿No tienes cuenta?',
    hasAccount: '¿Ya tienes cuenta?',
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
    existingUserDetected: 'Cuenta existente detectada',
  },
};

interface InlineAuthFormProps {
  defaultMode?: 'login' | 'signup';
  onSuccess?: () => void;
  showPersonaGate?: boolean;
}

export function InlineAuthForm({ defaultMode = 'signup', onSuccess, showPersonaGate = false }: InlineAuthFormProps) {
  const [personaSelected, setPersonaSelected] = useState<boolean>(!showPersonaGate || !!sessionStorage.getItem('pending_persona_type'));
  const [isLogin, setIsLogin] = useState(defaultMode === 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingUser, setExistingUser] = useState(false);
  const [cgvuAccepted, setCgvuAccepted] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const { containerRef, token, reset: resetTurnstile } = useTurnstile();
  const emailCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkEmailExists = useCallback(async (email: string) => {
    if (!email || !email.includes('@') || email.length < 5) {
      setExistingUser(false);
      return;
    }
    try {
      const { data } = await supabase.functions.invoke('auth-actions', { body: { action: 'check-email', email } });
      setExistingUser(data?.exists === true);
    } catch {
      setExistingUser(false);
    }
  }, []);

  const debouncedEmailCheck = useCallback((email: string) => {
    if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current);
    emailCheckTimerRef.current = setTimeout(() => checkEmailExists(email), 500);
  }, [checkEmailExists]);
  
  const handlePersonaSelect = (persona: PersonaType) => {
    sessionStorage.setItem('pending_persona_type', persona);
    setPersonaSelected(true);
  };

  if (!personaSelected) {
    return <PersonaGate onSelect={handlePersonaSelect} />;
  }



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

  const loginSchema = z.object({
    email: z.string().min(1, t.emailRequired).email(t.emailInvalid),
    password: z.string().min(1, t.passwordRequired),
  });

  // When existing user detected, we only need email + password
  const signupSchema = existingUser
    ? z.object({
        email: z.string().min(1, t.emailRequired).email(t.emailInvalid),
        password: z.string().min(1, t.passwordRequired),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })
    : z.object({
        email: z.string().min(1, t.emailRequired).email(t.emailInvalid),
        password: z.string().min(6, t.passwordMin),
        firstName: z.string().min(1, t.firstNameRequired),
        lastName: z.string().min(1, t.lastNameRequired),
      });

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', firstName: '', lastName: '' },
  });

  const handleLogin = async (data: { email: string; password: string }) => {
    setIsLoading(true);
    const verified = await verifyTurnstile();
    if (!verified) { setIsLoading(false); return; }
    const { error } = await signInWithEmail(data.email, data.password);
    setIsLoading(false);

    if (error) {
      toast.error(t.loginError);
      resetTurnstile();
    } else {
      toast.success(t.loginSuccess);
      onSuccess?.();
    }
  };

  const handleSignup = async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    setIsLoading(true);
    const verified = await verifyTurnstile();
    if (!verified) { setIsLoading(false); return; }

    // If existing user detected, login instead of signup
    if (existingUser) {
      const { error } = await signInWithEmail(data.email, data.password);
      setIsLoading(false);
      if (error) {
        toast.error(t.loginError);
        resetTurnstile();
      } else {
        toast.success(t.loginSuccess);
        onSuccess?.();
      }
      return;
    }

    const { error } = await signUpWithEmail(data.email, data.password, data.firstName || '', data.lastName || '');
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        toast.error(t.userExists);
      } else {
        toast.error(t.signupError);
      }
      resetTurnstile();
    } else {
      // Send verification code and show modal
      setVerificationEmail(data.email);
      supabase.functions.invoke('auth-actions', { body: { action: 'send-code', email: data.email } });
      setShowVerification(true);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const currentUrl = window.location.href;
    const { error } = await signInWithGoogle(currentUrl);
    if (error) {
      toast.error(t.loginError);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = loginForm.getValues('email');
    if (!email) {
      toast.error(language === 'fr' ? 'Saisissez votre email d\'abord' : 'Enter your email first');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(language === 'fr' ? 'Erreur, réessayez' : 'Error, try again');
    } else {
      toast.success(language === 'fr' ? 'Email de réinitialisation envoyé !' : 'Password reset email sent!');
    }
  };

  const handleSignupEmailChange = (value: string, onChange: (v: string) => void) => {
    onChange(value);
    debouncedEmailCheck(value);
  };

  return (
    <>
    <div className="space-y-4">
      {/* Google OAuth Button */}
      <Button
        variant="outline"
        className="w-full gap-2 h-10 text-sm"
        onClick={handleGoogleLogin}
        disabled={isLoading}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {t.googleLogin}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">ou</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLogin ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-3">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t.email}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input {...field} type="email" className="pl-8 h-9 text-sm" placeholder="email@example.com" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t.password}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            className="pl-8 pr-8 h-9 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-9 text-sm" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.loginButton}
                </Button>
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
          </motion.div>
        ) : (
          <motion.div
            key="signup"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-3">
                {/* Existing user banner */}
                <AnimatePresence>
                  {existingUser && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-primary"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span>{t.existingUserDetected}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Name fields — hidden when existing user */}
                <AnimatePresence>
                  {!existingUser && (
                    <motion.div
                      initial={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.25 }}
                      className="grid grid-cols-2 gap-2 overflow-hidden"
                    >
                      <FormField
                        control={signupForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t.firstName}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input {...field} className="pl-8 h-9 text-sm" />
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={signupForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t.lastName}</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-9 text-sm" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <FormField
                  control={signupForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t.email}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            className="pl-8 h-9 text-sm"
                            placeholder="email@example.com"
                            onChange={(e) => handleSignupEmailChange(e.target.value, field.onChange)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signupForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t.password}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            className="pl-8 pr-8 h-9 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                {/* CGVU Checkbox — only for new signups */}
                {!existingUser && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="cgvu-accept"
                      checked={cgvuAccepted}
                      onCheckedChange={(v) => setCgvuAccepted(v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="cgvu-accept" className="text-[11px] leading-tight text-muted-foreground cursor-pointer">
                      {language === 'fr' ? (
                        <>J'accepte les <Link to="/cgvu" target="_blank" className="text-primary hover:underline">CGVU</Link></>
                      ) : language === 'es' ? (
                        <>Acepto los <Link to="/cgvu" target="_blank" className="text-primary hover:underline">términos y condiciones</Link></>
                      ) : (
                        <>I accept the <Link to="/cgvu" target="_blank" className="text-primary hover:underline">Terms & Conditions</Link></>
                      )}
                    </label>
                  </div>
                )}

                <Button type="submit" className="w-full h-9 text-sm" disabled={isLoading || (!existingUser && !cgvuAccepted)}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (existingUser ? t.loginButton : t.signupButton)}
                </Button>
              </form>
            </Form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turnstile CAPTCHA */}
      <div ref={containerRef} className="flex justify-center" />

      <div className="text-center text-xs">
        <span className="text-muted-foreground">
          {isLogin ? t.noAccount : t.hasAccount}{' '}
        </span>
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setExistingUser(false);
          }}
          className="text-primary hover:underline font-medium"
        >
          {isLogin ? t.signup : t.login}
        </button>
      </div>
    </div>

      <VerificationCodeModal
        open={showVerification}
        email={verificationEmail}
        onVerified={() => {
          setShowVerification(false);
          toast.success(t.signupSuccess);
          onSuccess?.();
        }}
        onClose={() => setShowVerification(false)}
      />
    </>
  );
}
