import { Component, ReactNode, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Fallback pendant le chargement du chunk */
  fallback?: ReactNode;
  /** Libellé du bloc en cas d'échec (ex. « le graphe 3D ») */
  label?: string;
  /** Hauteur minimale réservée (anti-CLS) */
  minHeight?: string;
}

interface State {
  hasError: boolean;
  message: string | null;
  attempt: number;
}

const MAX_MANUAL_RETRIES = 2;

function isChunkError(error: unknown): boolean {
  const msg = `${(error as Error)?.name ?? ""} ${(error as Error)?.message ?? ""}`.toLowerCase();
  return (
    msg.includes("dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("chunkloaderror") ||
    msg.includes("unable to preload")
  );
}

/**
 * Frontière locale pour un composant chargé en `lazy()`.
 * Un chunk qui ne se télécharge pas ne casse plus la page entière : le bloc
 * concerné affiche un état d'échec avec un retry contrôlé (remontage du
 * Suspense), puis propose un rechargement complet au-delà de 2 tentatives.
 */
export class LazyBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error?.message ?? null };
  }

  componentDidCatch(error: Error) {
    console.error("[LazyBoundary] échec de chargement dynamique:", error);
  }

  private retry = () => {
    this.setState((s) => ({ hasError: false, message: null, attempt: s.attempt + 1 }));
  };

  render() {
    const { children, fallback = null, label = "ce module", minHeight } = this.props;
    const { hasError, message, attempt } = this.state;

    if (hasError) {
      const exhausted = attempt >= MAX_MANUAL_RETRIES;
      return (
        <div
          style={minHeight ? { minHeight } : undefined}
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border p-6 text-center"
        >
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-sm">
            {exhausted
              ? `Impossible de charger ${label}. Rechargez la page pour récupérer la dernière version.`
              : `Le chargement de ${label} a échoué (connexion ou nouvelle version déployée).`}
          </p>
          {message && !isChunkError(message) && (
            <p className="text-xs font-mono text-muted-foreground/70 break-words max-w-sm">{message}</p>
          )}
          <Button
            variant="outline"
            className="gap-2"
            onClick={exhausted ? () => window.location.reload() : this.retry}
          >
            <RotateCcw className="h-4 w-4" />
            {exhausted ? "Recharger la page" : "Réessayer"}
          </Button>
        </div>
      );
    }

    return (
      <Suspense key={attempt} fallback={fallback}>
        {children}
      </Suspense>
    );
  }
}
