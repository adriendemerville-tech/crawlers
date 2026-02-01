import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary] Render error", error, info);
  }

  private handleReload = () => {
    try {
      localStorage.removeItem("lazy_retry_once");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  private handleSoftReset = () => {
    // Try to recover from bad persisted state without touching auth/session storage.
    try {
      localStorage.removeItem("crawlers_last_url");
      localStorage.removeItem("lazy_retry_once");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Erreur au chargement</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Une erreur JavaScript empêche l’application de s’afficher. Rechargez la page pour récupérer.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="default" onClick={this.handleReload}>
              Recharger
            </Button>
            <Button variant="outline" onClick={this.handleSoftReset}>
              Réinitialiser & recharger
            </Button>
          </div>

          <details className="mt-4 rounded-md border border-border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Détails techniques
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {String(this.state.error ?? "(aucun détail)")}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
