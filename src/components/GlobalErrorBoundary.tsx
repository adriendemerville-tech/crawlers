import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary — catches all unhandled React crashes.
 * Logs them to analytics_events as 'frontend_crash' for CTO investigation.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Frontend crash:', error, errorInfo);
    this.logCrash(error, errorInfo);
  }

  private async logCrash(error: Error, errorInfo: ErrorInfo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('analytics_events').insert({
        event_type: 'frontend_crash',
        user_id: user?.id || null,
        url: window.location.pathname,
        event_data: {
          error_message: error.message,
          error_name: error.name,
          stack: error.stack?.substring(0, 2000),
          component_stack: errorInfo.componentStack?.substring(0, 2000),
          route: window.location.pathname,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Never let logging crash the fallback UI
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h1 className="text-xl font-semibold text-foreground">
              Une erreur est survenue
            </h1>
            <p className="text-sm text-muted-foreground">
              L'application a rencontré un problème inattendu. L'erreur a été signalée automatiquement.
            </p>
            {this.state.error && (
              <p className="text-xs text-destructive/70 font-mono bg-destructive/5 rounded p-2 w-full break-words">
                {this.state.error.message}
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Retour à l'accueil
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
