import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Lock, LogIn, UserPlus, Star, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CocoonAccessGateProps {
  language: "fr" | "en" | "es";
}

const i18n = {
  fr: {
    heroTitle: "Réservé aux Pros",
    heroDesc: "Le module Cocoon est réservé aux abonnés Pro Agency. Visualisez l'architecture sémantique de votre site.",
    subscribeCta: "S'abonner · dès 26,10€/mois",
    features: ["Audit expert illimité", "Code correctif illimité", "Benchmark visibilité LLM", "Cocoon sémantique illimité", "Marque Blanche"],
    authTitle: "Vous avez déjà un compte ?",
    authDesc: "Connectez-vous pour accéder à Cocoon ou créez votre compte.",
    loginCta: "Se connecter",
    signupCta: "S'inscrire",
    redirecting: "Redirection…",
    back: "Accueil",
    errorGeneric: "Erreur",
  },
  en: {
    heroTitle: "Reserved for Pros",
    heroDesc: "The Cocoon module is reserved for Pro Agency subscribers. Visualize your site's semantic architecture.",
    subscribeCta: "Subscribe · €29/mo",
    features: ["Unlimited expert audit", "Unlimited corrective code", "LLM Visibility Benchmark", "Unlimited semantic Cocoon", "White Label"],
    authTitle: "Already have an account?",
    authDesc: "Sign in to access Cocoon or create your account.",
    loginCta: "Sign in",
    signupCta: "Sign up",
    redirecting: "Redirecting…",
    back: "Home",
    errorGeneric: "Error",
  },
  es: {
    heroTitle: "Reservado para Pros",
    heroDesc: "El módulo Cocoon está reservado para suscriptores Pro Agency. Visualice la arquitectura semántica de su sitio.",
    subscribeCta: "Suscribirse · 29€/mes",
    features: ["Auditoría experta ilimitada", "Código correctivo ilimitado", "Benchmark visibilidad LLM", "Cocoon semántico ilimitado", "Marca Blanca"],
    authTitle: "¿Ya tiene una cuenta?",
    authDesc: "Inicie sesión para acceder a Cocoon o cree su cuenta.",
    loginCta: "Iniciar sesión",
    signupCta: "Registrarse",
    redirecting: "Redirigiendo…",
    back: "Inicio",
    errorGeneric: "Error",
  },
};

export function CocoonAccessGate({ language }: CocoonAccessGateProps) {
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const t = i18n[language] || i18n.fr;
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleSubscribe = async () => {
    setSubscribeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-actions", {
        body: { action: 'subscription', returnUrl: window.location.href },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank", "noopener");
    } catch (e: any) {
      toast({ title: t.errorGeneric, description: e.message, variant: "destructive" });
    } finally {
      setSubscribeLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const { error } = await signInWithGoogle(`${window.location.origin}/cocoon`);
      if (error) throw error;
    } catch (e: any) {
      toast({ title: t.errorGeneric, description: e.message, variant: "destructive" });
      setLoginLoading(false);
    }
  };

  const handleSignup = () => {
    navigate("/auth?returnTo=/");
  };

  return (
    <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.back}
        </button>
        {/* Hero 1: Subscribe */}
        <Card className="border-2 border-violet-500 ring-2 ring-violet-500/30 bg-gradient-to-br from-violet-500/5 via-[#0f0a1e] to-yellow-500/5 shadow-xl shadow-violet-500/10">
          <div className="absolute top-0 left-0">
            <Badge className="rounded-none rounded-br-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black border-0 px-3 py-1 text-xs font-bold gap-1.5 shadow-lg">
              <Star className="h-3 w-3 fill-current" />
              Pro Agency
            </Badge>
          </div>
          <CardHeader className="pt-10 pb-2">
            <CardTitle className="text-xl flex items-center gap-3 text-white">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-yellow-500/10 border border-violet-500/20">
                <Crown className="h-5 w-5 text-yellow-500" />
              </div>
              {t.heroTitle}
            </CardTitle>
            <CardDescription className="text-white/50">{t.heroDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-1.5">
              {t.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-violet-500/10">
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                  <span className="text-sm text-white/80">{f}</span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="w-full gap-2 font-bold bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white shadow-lg shadow-violet-500/25"
              disabled={subscribeLoading}
              onClick={handleSubscribe}
            >
              <Crown className="h-4 w-4 text-yellow-300" />
              {subscribeLoading ? t.redirecting : t.subscribeCta}
            </Button>
          </CardContent>
        </Card>

        {/* Hero 2: Login / Signup */}
        <Card className="border border-white/10 bg-[#1a1035]/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <LogIn className="h-4 w-4 text-violet-400" />
              {t.authTitle}
            </CardTitle>
            <CardDescription className="text-white/40 text-sm">{t.authDesc}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              className="flex-1 gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/10"
              variant="outline"
              disabled={loginLoading}
              onClick={handleLogin}
            >
              <LogIn className="h-4 w-4" />
              {loginLoading ? "…" : t.loginCta}
            </Button>
            <Button
              className="flex-1 gap-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/20"
              variant="outline"
              onClick={handleSignup}
            >
              <UserPlus className="h-4 w-4" />
              {t.signupCta}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
