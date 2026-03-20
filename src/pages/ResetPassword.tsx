import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const translations = {
  fr: {
    title: 'Nouveau mot de passe',
    description: 'Choisissez un nouveau mot de passe pour votre compte.',
    password: 'Nouveau mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    submit: 'Enregistrer',
    success: 'Mot de passe mis à jour avec succès !',
    error: 'Erreur lors de la mise à jour du mot de passe.',
    mismatch: 'Les mots de passe ne correspondent pas.',
    min: 'Minimum 6 caractères',
    required: 'Champ requis',
    loginNow: 'Se connecter',
    invalidLink: 'Lien invalide ou expiré. Veuillez demander un nouveau lien de réinitialisation.',
  },
  en: {
    title: 'New password',
    description: 'Choose a new password for your account.',
    password: 'New password',
    confirmPassword: 'Confirm password',
    submit: 'Save',
    success: 'Password updated successfully!',
    error: 'Error updating password.',
    mismatch: 'Passwords do not match.',
    min: 'Minimum 6 characters',
    required: 'Required',
    loginNow: 'Sign in',
    invalidLink: 'Invalid or expired link. Please request a new reset link.',
  },
  es: {
    title: 'Nueva contraseña',
    description: 'Elija una nueva contraseña para su cuenta.',
    password: 'Nueva contraseña',
    confirmPassword: 'Confirmar contraseña',
    submit: 'Guardar',
    success: '¡Contraseña actualizada con éxito!',
    error: 'Error al actualizar la contraseña.',
    mismatch: 'Las contraseñas no coinciden.',
    min: 'Mínimo 6 caracteres',
    required: 'Obligatorio',
    loginNow: 'Iniciar sesión',
    invalidLink: 'Enlace inválido o expirado. Solicite un nuevo enlace de restablecimiento.',
  },
};

const ResetPassword = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const navigate = useNavigate();

  // noindex this page
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    return () => { meta?.remove(); };
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  const schema = z.object({
    password: z.string().min(6, t.min),
    confirmPassword: z.string().min(1, t.required),
  }).refine(d => d.password === d.confirmPassword, {
    message: t.mismatch,
    path: ['confirmPassword'],
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // Check for recovery session from the URL hash
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (type === 'recovery' && accessToken) {
      // Set the session from the recovery tokens
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      }).then(({ error }) => {
        if (error) {
          console.error('Recovery session error:', error);
          setValidSession(false);
        } else {
          setValidSession(true);
        }
      });
    } else {
      // Also check if there's already a session (user might have been redirected with PKCE flow)
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setValidSession(true);
        } else {
          setValidSession(false);
        }
      });
    }
  }, []);

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) throw error;

      // Sign out so the user logs in fresh with their new password
      await supabase.auth.signOut();
      setDone(true);
      toast.success(t.success);
    } catch (err: any) {
      toast.error(err.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/auth');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Helmet>
        <title>Réinitialiser le mot de passe | Crawlers.fr</title>
        <meta name="description" content="Réinitialisez votre mot de passe Crawlers.fr pour retrouver l'accès à vos audits SEO et GEO." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {done ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            ) : (
              <Lock className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl font-bold">{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {validSession === false && (
            <div className="text-center space-y-4">
              <p className="text-sm text-destructive">{t.invalidLink}</p>
              <Button onClick={handleGoToLogin} className="w-full">
                {t.loginNow}
              </Button>
            </div>
          )}

          {validSession === null && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {validSession && !done && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.password}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.confirmPassword}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowConfirm(!showConfirm)}
                          >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.submit}
                </Button>
              </form>
            </Form>
          )}

          {done && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">{t.success}</p>
              <Button onClick={handleGoToLogin} className="w-full">
                {t.loginNow}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
