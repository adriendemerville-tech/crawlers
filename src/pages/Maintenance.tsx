import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CrawlersLogo } from '@/components/CrawlersLogo';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/router-compat';
import { Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getMaintenanceState } from '@/lib/config/maintenance';

const DEFAULT_MESSAGE =
  "Cette page est momentanément en maintenance. Nos équipes travaillent à la remettre en ligne au plus vite. Merci de votre patience.";

export default function Maintenance() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getMaintenanceState().then((state) => {
      if (mounted && state.message) setMessage(state.message);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-xl text-center space-y-8">
          <div className="flex justify-center">
            <CrawlersLogo size={72} className="rounded-2xl" />
          </div>

          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" />
              Maintenance en cours
            </span>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Nous revenons très vite
            </h1>

            <p className="text-base text-muted-foreground leading-relaxed">
              {message || DEFAULT_MESSAGE}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="bg-transparent hover:bg-transparent"
            >
              Réessayer
            </Button>
            <Button asChild variant="outline" className="bg-transparent hover:bg-transparent">
              <Link to="/contact">Nous contacter</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Une question urgente ? Écrivez-nous à contact@crawlers.fr
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
