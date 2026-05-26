import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import DevLayout from "./DevLayout";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props { mode: "login" | "signup"; }

export default function DevAuth({ mode }: Props) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/developers/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fn = mode === "login" ? signInWithEmail(email, password) : signUpWithEmail(email, password, "", "");
    const { error } = await fn;
    setLoading(false);
    if (error) return toast.error(error.message);
    if (mode === "signup") {
      toast.success("Compte créé — vérifie ton email pour confirmer.");
    }
    navigate(next);
  };

  const google = async () => {
    const { error } = await signInWithGoogle();
    if (error) toast.error(error.message);
  };

  return (
    <DevLayout title={mode === "login" ? "Connexion" : "Inscription"}>
      <div className="max-w-sm mx-auto py-12">
        <h1 className="text-3xl font-light tracking-tight mb-2">
          {mode === "login" ? "Bonjour !" : "Créer un compte."}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {mode === "login" ? "Accède à tes clés API et ta consommation." : "100 jobs/mois offerts, sans carte bancaire."}
        </p>

        <button
          onClick={google}
          className="w-full h-11 border border-border rounded text-sm font-medium hover:border-foreground transition-colors mb-4"
        >
          Continuer avec Google
        </button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground my-4">
          <div className="flex-1 h-px bg-border" />
          <span>ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            placeholder="email@dev.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full h-11 px-3 rounded border border-border bg-background text-sm"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full h-11 px-3 rounded border border-border bg-background text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 border border-foreground rounded text-sm font-medium hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
          >
            {loading ? "…" : (mode === "login" ? "Se connecter" : "Créer le compte")}
          </button>
        </form>

        <div className="mt-6 text-xs text-muted-foreground text-center">
          {mode === "login" ? (
            <>
              <Link to="/signup" className="text-foreground border-b border-foreground">Créer un compte</Link>
              {" · "}
              <Link to="/developers/signup" className="text-foreground border-b border-foreground">Compte développeur</Link>
              {" · "}
              <Link to="/reset-password" className="text-foreground border-b border-foreground">Mot de passe oublié</Link>
            </>
          ) : (
            <>Déjà inscrit ? <Link to="/developers/login" className="text-foreground border-b border-foreground">Se connecter</Link></>
          )}
        </div>
      </div>
    </DevLayout>
  );
}
