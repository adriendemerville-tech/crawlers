import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class StrategicErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[StrategicErrorBoundary] Crash intercepté:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Erreur d'affichage
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Un problème est survenu lors de l'affichage des résultats stratégiques.
                Veuillez relancer l'audit.
              </p>
              {this.state.error && (
                <p className="text-xs text-destructive/70 mt-2 font-mono">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset?.();
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
