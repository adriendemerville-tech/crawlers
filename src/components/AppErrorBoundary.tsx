import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep this log: it’s critical when users report a blank screen in production.
    console.error("[AppErrorBoundary] render error", error, info);
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      // no-op
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const showDetails = import.meta.env.DEV;
    const message = this.state.error?.message ?? "Erreur inconnue";

    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-4 px-6 py-10">
          <h1 className="text-balance text-2xl font-semibold">
            Une erreur empêche l’affichage de la page
          </h1>
          <p className="text-muted-foreground">
            La page s’est chargée mais un conflit JavaScript a interrompu le rendu.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={this.handleReload}>Recharger</Button>
          </div>

          {showDetails ? (
            <div className="mt-4 w-full rounded-lg border bg-card p-4">
              <p className="text-sm font-medium">Détails (dev)</p>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {message}
                {this.state.error?.stack ? `\n\n${this.state.error.stack}` : ""}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
