import { useLocation, Link } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

import { t3 } from "@/utils/i18n";

const Footer = lazy(() => import("@/components/Footer").then(m => ({ default: m.Footer })));

const NotFound = () => {
  const location = useLocation();
  const { language } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>{t3(language, 'Page introuvable | Crawlers.fr', 'Page Not Found | Crawlers.fr', 'Página no encontrada | Crawlers.fr')}</title>
        <meta name="description" content={t3(language, 'La page demandée n\'existe pas ou a été déplacée.', 'The requested page does not exist or has been moved.', 'La página solicitada no existe o ha sido movida.')} />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <Header />
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-muted p-6">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <h1 className="mb-3 text-5xl font-bold text-foreground">404</h1>
          <p className="mb-6 text-lg text-muted-foreground">
            {t3(language, 'La page que vous cherchez n\'existe pas ou a été déplacée.', 'The page you\'re looking for doesn\'t exist or has been moved.', 'La página que busca no existe o ha sido movida.')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t3(language, 'Retour à l\'accueil', 'Back to home', 'Volver al inicio')}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/blog">
                {t3(language, 'Voir le blog', 'View blog', 'Ver el blog')}
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default NotFound;
