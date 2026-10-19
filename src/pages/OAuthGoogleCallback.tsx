import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Page de retour OAuth Google (https://crawlers.fr/oauth/google/callback).
 * Google renvoie ici ?code=...&state=... (ou ?error=...). La page transmet
 * ces paramètres à gsc-auth (action "exchange") qui échange le code contre
 * les tokens, puis redirige vers /console comme le callback historique.
 */
export default function OAuthGoogleCallback() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state") || "";
    const error = params.get("error");

    const fallback = (reason: string) => {
      window.location.replace(`/console?gsc_error=${encodeURIComponent(reason)}`);
    };

    if (error) {
      fallback(error);
      return;
    }
    if (!code) {
      fallback("missing_code");
      return;
    }

    supabase.functions
      .invoke("gsc-auth", { body: { action: "exchange", code, state } })
      .then(({ data, error: fnError }) => {
        if (fnError || !data?.redirect_url) {
          fallback("token_exchange_failed");
          return;
        }
        window.location.replace(data.redirect_url);
      })
      .catch(() => fallback("internal"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Connexion à Google en cours…</p>
    </div>
  );
}
