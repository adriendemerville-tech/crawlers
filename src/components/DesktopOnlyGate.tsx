import { useIsMobile } from '@/hooks/use-mobile';
import { Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';

interface DesktopOnlyGateProps {
  children: React.ReactNode;
  featureName?: string;
}

export function DesktopOnlyGate({ children, featureName = 'Cette fonctionnalité' }: DesktopOnlyGateProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (!isMobile) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Monitor className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Disponible sur ordinateur
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {featureName} nécessite un écran plus large pour une expérience optimale. Retrouvez-la sur votre ordinateur.
          </p>
          <Button onClick={() => navigate('/')} variant="outline" className="mt-4">
            Retour à l'accueil
          </Button>
        </div>
      </main>
    </div>
  );
}
