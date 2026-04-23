import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, LogIn, UserPlus, Star, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ProAccessGateProps {
  featureName: string;
  featureDescription: string;
  returnPath?: string;
  returnLabel?: string;
}

const FEATURES = [
  "Audit expert illimité",
  "Code correctif illimité",
  "Conversion Optimizer",
  "Cocoon sémantique",
  "Marque Blanche",
];

export function ProAccessGate({
  featureName,
  featureDescription,
  returnPath = "/",
  returnLabel = "Retour",
}: ProAccessGateProps) {
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleSubscribe = async () => {
    setSubscribeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-actions", {
        body: { action: "subscription", returnUrl: window.location.href },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank", "noopener");
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSubscribeLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const { error } = await signInWithGoogle(window.location.pathname);
      if (error) throw error;
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <button
          onClick={() => navigate(returnPath)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {returnLabel}
        </button>

        {/* Subscribe card */}
        <Card className="border-2 border-violet-500 ring-2 ring-violet-500/30 bg-gradient-to-br from-violet-500/5 via-background to-yellow-500/5 shadow-xl shadow-violet-500/10 relative overflow-hidden">
          <div className="absolute top-0 left-0">
            <Badge className="rounded-none rounded-br-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black border-0 px-3 py-1 text-xs font-bold gap-1.5 shadow-lg">
              <Star className="h-3 w-3 fill-current" />
              Pro Agency
            </Badge>
          </div>
          <CardHeader className="pt-10 pb-2">
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-yellow-500/10 border border-violet-500/20">
                <Crown className="h-5 w-5 text-yellow-500" />
              </div>
              Réservé aux Pros
            </CardTitle>
            <CardDescription>
              {featureName} est réservé aux abonnés Pro Agency. {featureDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-1.5">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-violet-500/10">
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                  <span className="text-sm text-muted-foreground">{f}</span>
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
              {subscribeLoading ? "Redirection…" : "S'abonner · dès 26,10€/mois"}
            </Button>
          </CardContent>
        </Card>

        {/* Login / Signup */}
        <Card className="border border-border bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <LogIn className="h-4 w-4 text-violet-400" />
              Vous avez déjà un compte ?
            </CardTitle>
            <CardDescription className="text-sm">
              Connectez-vous pour accéder à {featureName} ou créez votre compte.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              className="flex-1 gap-2"
              variant="outline"
              disabled={loginLoading}
              onClick={handleLogin}
            >
              <LogIn className="h-4 w-4" />
              {loginLoading ? "…" : "Se connecter"}
            </Button>
            <Button
              className="flex-1 gap-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-500 border border-violet-500/20"
              variant="outline"
              onClick={() => navigate("/auth?returnTo=" + encodeURIComponent(window.location.pathname))}
            >
              <UserPlus className="h-4 w-4" />
              S'inscrire
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
