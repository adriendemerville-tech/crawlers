import { useEffect, useState } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";

type ConsentDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scopes?: string[] | null;
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Paramètre authorization_id manquant.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const anyAuth = (supabase.auth as any).oauth;
      if (!anyAuth?.getAuthorizationDetails) {
        setError("SDK OAuth Supabase indisponible.");
        return;
      }
      const { data, error: err } = await anyAuth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) { setError(err.message); return; }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const anyAuth = (supabase.auth as any).oauth;
    const call = approve ? anyAuth.approveAuthorization : anyAuth.denyAuthorization;
    const { data, error: err } = await call(authorizationId);
    if (err) { setBusy(false); setError(err.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("Aucune URL de redirection renvoyée."); return; }
    window.location.href = target;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <main className="w-full max-w-md border border-border rounded-lg p-6 space-y-5">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Autoriser l'accès</h1>
          <p className="text-sm text-muted-foreground">
            Une application externe souhaite se connecter à votre compte Crawlers.
          </p>
        </header>

        {error && (
          <p className="text-sm border border-destructive text-destructive rounded-md p-3">
            {error}
          </p>
        )}

        {!error && !details && (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        )}

        {details && (
          <>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Client&nbsp;: </span>
                <span className="font-medium">{details.client?.name ?? "Application inconnue"}</span>
              </p>
              {details.client?.redirect_uri && (
                <p className="break-all">
                  <span className="text-muted-foreground">Redirection&nbsp;: </span>
                  <span className="font-mono text-xs">{details.client.redirect_uri}</span>
                </p>
              )}
              <p className="text-muted-foreground">
                Ce client pourra appeler les outils MCP de Crawlers en agissant en votre nom.
                Vos règles d'accès (RLS) restent appliquées.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 border border-foreground rounded-md px-4 py-2 text-sm hover:bg-foreground/5 disabled:opacity-50"
              >
                Autoriser
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 border border-border rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Refuser
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
