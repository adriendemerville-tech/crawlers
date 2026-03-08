import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
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

const translations = {
  fr: {
    login: 'Connexion',
    signup: 'Inscription',
    loginTitle: 'Bienvenue',
    loginDesc: 'Connectez-vous pour accéder à vos rapports',
    signupTitle: 'Créer un compte',
    signupDesc: 'Rejoignez Crawlers AI pour sauvegarder vos analyses',
    email: 'Email',
    password: 'Mot de passe',
    firstName: 'Prénom',
    lastName: 'Nom',
    loginButton: 'Se connecter',
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
  },
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = translations[language];
  const inviteToken = searchParams.get('invite');

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
        navigate('/console');
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
          navigate('/');
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
    const { error } = await signInWithEmail(data.email, data.password);
    setIsLoading(false);

    if (error) {
      toast.error(t.loginError);
    } else {
      toast.success(t.loginSuccess);
      // Navigation handled by useEffect when user state updates
    }
  };

  const handleSignup = async (data: { email: string; password: string; firstName: string; lastName: string }) => {
    setIsLoading(true);
    const { error } = await signUpWithEmail(data.email, data.password, data.firstName, data.lastName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        toast.error(t.userExists);
      } else {
        toast.error(t.signupError);
      }
    } else {
      // Track signup completion
      trackAnalyticsEvent('signup_complete');
      toast.success(t.signupSuccess);
      // Navigation handled by useEffect when user state updates
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t.backToHome}
        </Link>

        <Card className="border-border/50 shadow-xl backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {isLogin ? t.loginTitle : t.signupTitle}
            </CardTitle>
            <CardDescription>
              {isLogin ? t.loginDesc : t.signupDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                <span className="bg-card px-2 text-muted-foreground">ou</span>
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
                            <Input {...field} type="email" className="pl-10" placeholder="email@example.com" />
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
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.loginButton}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
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
                            <Input {...field} type="email" className="pl-10" placeholder="email@example.com" />
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

            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {isLogin ? t.noAccount : t.hasAccount}{' '}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (isLogin) {
                    // Track signup click when switching to signup form
                    trackAnalyticsEvent('signup_click');
                  }
                  setIsLogin(!isLogin);
                }}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? t.signup : t.login}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
