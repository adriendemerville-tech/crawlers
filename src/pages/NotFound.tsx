import { useLocation, Link } from "@/lib/router-compat";
import { useEffect, lazy, Suspense } from "react";
import { Header } from "@/components/Header";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

import { t3 } from "@/utils/i18n";

const Footer = lazy(() => import("@/components/Footer").then(m => ({ default: m.Footer })));

/**
 * Réponse non-200 exploitable par les machines : le serveur renvoie déjà un
 * statut 404 réel. On ajoute ici (a) un `noindex` explicite, (b) un JSON-LD
 * décrivant l'erreur, (c) des points d'entrée stables (sitemap, sections clés)
 * pour qu'un crawler ne gaspille pas son budget et n'interprète pas cette page
 * comme du contenu.
 */
const ENTRY_POINTS: Array<{ path: string; fr: string; en: string; es: string }> = [
  { path: "/", fr: "Accueil", en: "Home", es: "Inicio" },
  { path: "/blog", fr: "Blog SEO & GEO", en: "SEO & GEO blog", es: "Blog SEO y GEO" },
  { path: "/guides", fr: "Guides", en: "Guides", es: "Guías" },
  { path: "/audit-expert", fr: "Audit expert", en: "Expert audit", es: "Auditoría experta" },
  { path: "/tarifs", fr: "Tarifs", en: "Pricing", es: "Precios" },
  { path: "/contact", fr: "Contact", en: "Contact", es: "Contacto" },
];

const NotFound = () => {
  const location = useLocation();
  const { language } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);

    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, follow";
    meta.setAttribute("data-notfound", "true");
    document.head.appendChild(meta);

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "notfound");
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "404 — Page introuvable",
      url: `https://crawlers.fr${location.pathname}`,
      isPartOf: { "@id": "https://crawlers.fr/#website" },
      description:
        "Cette URL ne correspond à aucune ressource. Statut HTTP 404. Utilisez le sitemap pour découvrir les URL valides.",
      significantLink: ENTRY_POINTS.map((e) => `https://crawlers.fr${e.path}`),
    });
    document.head.appendChild(script);

    return () => {
      meta.remove();
      script.remove();
    };
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center max-w-xl">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-muted p-6">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <h1 className="mb-3 text-5xl font-bold text-foreground">404</h1>
          <p className="mb-2 text-lg text-muted-foreground">
            {t3(language, 'La page que vous cherchez n\'existe pas ou a été déplacée.', 'The page you\'re looking for doesn\'t exist or has been moved.', 'La página que busca no existe o ha sido movida.')}
          </p>
          <p className="mb-8 font-mono text-sm text-muted-foreground">
            HTTP 404 — <span className="break-all">{location.pathname}</span>
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

          <nav
            aria-label={t3(language, 'Points d\'entrée du site', 'Site entry points', 'Puntos de entrada del sitio')}
            className="mt-10 border-t border-border pt-8 text-left"
          >
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t3(language, 'Sections valides du site', 'Valid site sections', 'Secciones válidas del sitio')}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {ENTRY_POINTS.map((entry) => (
                <li key={entry.path}>
                  <Link to={entry.path} className="text-sm text-foreground underline underline-offset-4">
                    {t3(language, entry.fr, entry.en, entry.es)}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-muted-foreground">
              {t3(
                language,
                'Liste complète des URL indexables : ',
                'Full list of indexable URLs: ',
                'Lista completa de URL indexables: ',
              )}
              <a href="/sitemap.xml" className="underline underline-offset-4">/sitemap.xml</a>
              {' · '}
              <a href="/llms.txt" className="underline underline-offset-4">/llms.txt</a>
            </p>
          </nav>
        </div>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default NotFound;
