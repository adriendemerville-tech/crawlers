import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Smartphone, Monitor, Search } from 'lucide-react';

const translations = {
  fr: {
    title: "Critères SEO essentiels par plateforme",
    subtitle: "Ce que Google et les moteurs de recherche évaluent en priorité",
    mobile: "Mobile",
    desktop: "Desktop",
    critical: "Critique",
    important: "Important",
    optional: "Recommandé",
    factors: [
      {
        factor: "Core Web Vitals (LCP, FID, CLS)",
        mobile: { status: "critical", note: "Mobile-first indexing prioritaire" },
        desktop: { status: "important", note: "Facteur de classement secondaire" },
      },
      {
        factor: "Balise Title unique et optimisée (50-60 car.)",
        mobile: { status: "critical", note: "Affichage tronqué sur petit écran" },
        desktop: { status: "critical", note: "Premier signal sémantique" },
      },
      {
        factor: "Meta Description engageante (150-160 car.)",
        mobile: { status: "important", note: "Influence le CTR dans les SERP" },
        desktop: { status: "important", note: "Snippet principal affiché" },
      },
      {
        factor: "Balise H1 unique avec mot-clé principal",
        mobile: { status: "critical", note: "Structure sémantique essentielle" },
        desktop: { status: "critical", note: "Signal fort pour le ranking" },
      },
      {
        factor: "Responsive Design (viewport meta)",
        mobile: { status: "critical", note: "Condition d'indexation mobile" },
        desktop: { status: "optional", note: "Bonus pour l'expérience" },
      },
      {
        factor: "HTTPS avec certificat SSL valide",
        mobile: { status: "critical", note: "Requis pour Chrome et indexation" },
        desktop: { status: "critical", note: "Facteur de confiance Google" },
      },
      {
        factor: "Images optimisées (WebP, lazy loading)",
        mobile: { status: "critical", note: "Impact majeur sur le LCP mobile" },
        desktop: { status: "important", note: "Performance et économie bande passante" },
      },
      {
        factor: "Contenu above-the-fold optimisé",
        mobile: { status: "critical", note: "Engagement immédiat utilisateur" },
        desktop: { status: "important", note: "Réduction du taux de rebond" },
      },
      {
        factor: "Liens internes avec ancres descriptives",
        mobile: { status: "important", note: "Navigation simplifiée" },
        desktop: { status: "critical", note: "Distribution du PageRank" },
      },
      {
        factor: "Sitemap XML et robots.txt",
        mobile: { status: "important", note: "Découverte des pages" },
        desktop: { status: "critical", note: "Contrôle du crawl budget" },
      },
      {
        factor: "Temps de réponse serveur (TTFB < 200ms)",
        mobile: { status: "critical", note: "Connexions mobiles plus lentes" },
        desktop: { status: "important", note: "Expérience utilisateur fluide" },
      },
      {
        factor: "Alt text sur toutes les images",
        mobile: { status: "important", note: "Accessibilité et SEO images" },
        desktop: { status: "important", note: "Référencement Google Images" },
      },
    ],
  },
  en: {
    title: "Essential SEO Criteria by Platform",
    subtitle: "What Google and search engines evaluate first",
    mobile: "Mobile",
    desktop: "Desktop",
    critical: "Critical",
    important: "Important",
    optional: "Recommended",
    factors: [
      {
        factor: "Core Web Vitals (LCP, FID, CLS)",
        mobile: { status: "critical", note: "Mobile-first indexing priority" },
        desktop: { status: "important", note: "Secondary ranking factor" },
      },
      {
        factor: "Unique and optimized Title tag (50-60 char.)",
        mobile: { status: "critical", note: "Truncated on small screens" },
        desktop: { status: "critical", note: "First semantic signal" },
      },
      {
        factor: "Engaging Meta Description (150-160 char.)",
        mobile: { status: "important", note: "Influences CTR in SERPs" },
        desktop: { status: "important", note: "Main displayed snippet" },
      },
      {
        factor: "Unique H1 tag with main keyword",
        mobile: { status: "critical", note: "Essential semantic structure" },
        desktop: { status: "critical", note: "Strong ranking signal" },
      },
      {
        factor: "Responsive Design (viewport meta)",
        mobile: { status: "critical", note: "Mobile indexing requirement" },
        desktop: { status: "optional", note: "Experience bonus" },
      },
      {
        factor: "HTTPS with valid SSL certificate",
        mobile: { status: "critical", note: "Required for Chrome and indexing" },
        desktop: { status: "critical", note: "Google trust factor" },
      },
      {
        factor: "Optimized images (WebP, lazy loading)",
        mobile: { status: "critical", note: "Major impact on mobile LCP" },
        desktop: { status: "important", note: "Performance and bandwidth" },
      },
      {
        factor: "Optimized above-the-fold content",
        mobile: { status: "critical", note: "Immediate user engagement" },
        desktop: { status: "important", note: "Bounce rate reduction" },
      },
      {
        factor: "Internal links with descriptive anchors",
        mobile: { status: "important", note: "Simplified navigation" },
        desktop: { status: "critical", note: "PageRank distribution" },
      },
      {
        factor: "XML Sitemap and robots.txt",
        mobile: { status: "important", note: "Page discovery" },
        desktop: { status: "critical", note: "Crawl budget control" },
      },
      {
        factor: "Server response time (TTFB < 200ms)",
        mobile: { status: "critical", note: "Slower mobile connections" },
        desktop: { status: "important", note: "Smooth user experience" },
      },
      {
        factor: "Alt text on all images",
        mobile: { status: "important", note: "Accessibility and image SEO" },
        desktop: { status: "important", note: "Google Images ranking" },
      },
    ],
  },
  es: {
    title: "Criterios SEO esenciales por plataforma",
    subtitle: "Lo que Google y los motores de búsqueda evalúan primero",
    mobile: "Móvil",
    desktop: "Escritorio",
    critical: "Crítico",
    important: "Importante",
    optional: "Recomendado",
    factors: [
      {
        factor: "Core Web Vitals (LCP, FID, CLS)",
        mobile: { status: "critical", note: "Prioridad indexación mobile-first" },
        desktop: { status: "important", note: "Factor de ranking secundario" },
      },
      {
        factor: "Etiqueta Title única y optimizada (50-60 car.)",
        mobile: { status: "critical", note: "Truncado en pantallas pequeñas" },
        desktop: { status: "critical", note: "Primera señal semántica" },
      },
      {
        factor: "Meta Description atractiva (150-160 car.)",
        mobile: { status: "important", note: "Influye en CTR en SERPs" },
        desktop: { status: "important", note: "Snippet principal mostrado" },
      },
      {
        factor: "Etiqueta H1 única con palabra clave principal",
        mobile: { status: "critical", note: "Estructura semántica esencial" },
        desktop: { status: "critical", note: "Señal fuerte de ranking" },
      },
      {
        factor: "Diseño Responsive (viewport meta)",
        mobile: { status: "critical", note: "Requisito indexación móvil" },
        desktop: { status: "optional", note: "Bonus experiencia" },
      },
      {
        factor: "HTTPS con certificado SSL válido",
        mobile: { status: "critical", note: "Requerido para Chrome e indexación" },
        desktop: { status: "critical", note: "Factor de confianza Google" },
      },
      {
        factor: "Imágenes optimizadas (WebP, lazy loading)",
        mobile: { status: "critical", note: "Impacto mayor en LCP móvil" },
        desktop: { status: "important", note: "Rendimiento y ancho de banda" },
      },
      {
        factor: "Contenido above-the-fold optimizado",
        mobile: { status: "critical", note: "Engagement inmediato usuario" },
        desktop: { status: "important", note: "Reducción tasa de rebote" },
      },
      {
        factor: "Enlaces internos con anclas descriptivas",
        mobile: { status: "important", note: "Navegación simplificada" },
        desktop: { status: "critical", note: "Distribución PageRank" },
      },
      {
        factor: "Sitemap XML y robots.txt",
        mobile: { status: "important", note: "Descubrimiento de páginas" },
        desktop: { status: "critical", note: "Control crawl budget" },
      },
      {
        factor: "Tiempo respuesta servidor (TTFB < 200ms)",
        mobile: { status: "critical", note: "Conexiones móviles más lentas" },
        desktop: { status: "important", note: "Experiencia usuario fluida" },
      },
      {
        factor: "Alt text en todas las imágenes",
        mobile: { status: "important", note: "Accesibilidad y SEO imágenes" },
        desktop: { status: "important", note: "Ranking Google Images" },
      },
    ],
  },
};

const getStatusStyles = (status: string) => {
  if (status === 'critical') {
    return 'bg-destructive-muted';
  }
  if (status === 'important') {
    return 'bg-warning-muted';
  }
  return 'bg-muted/50';
};

const StatusLabel = ({ status, labels }: { status: string; labels: any }) => {
  if (status === 'critical') {
    return (
      <span className="font-bold text-destructive dark:text-red-400">{labels.critical}</span>
    );
  }
  if (status === 'important') {
    return (
      <span className="font-bold text-amber-700 dark:text-amber-400">{labels.important}</span>
    );
  }
  return (
    <span className="font-medium text-muted-foreground">{labels.optional}</span>
  );
};

export function SEOComparisonTable() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  return (
    <section className="py-12 bg-muted/30" aria-label="Tableau comparatif SEO">
      <div className="container mx-auto px-4">
        <Card className="overflow-hidden border-2">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardTitle className="flex items-center gap-3 text-xl md:text-2xl">
              <Search className="h-6 w-6 text-primary" />
              {t.title}
            </CardTitle>
            <p className="text-muted-foreground">{t.subtitle}</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse" role="table">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/70">
                    <th className="text-left p-4 font-semibold min-w-[280px] border-r border-border">Critère SEO</th>
                    <th className="text-center p-4 font-semibold min-w-[200px] border-r border-border">
                      <div className="flex items-center justify-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        {t.mobile}
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold min-w-[200px]">
                      <div className="flex items-center justify-center gap-2">
                        <Monitor className="h-4 w-4" />
                        {t.desktop}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {t.factors.map((row, idx) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium border-r border-border bg-card">{row.factor}</td>
                      <td className={`p-4 text-center border-r border-border ${getStatusStyles(row.mobile.status)}`}>
                        <div className="flex flex-col items-center gap-1">
                          <StatusLabel status={row.mobile.status} labels={t} />
                          <span className="text-xs text-muted-foreground">{row.mobile.note}</span>
                        </div>
                      </td>
                      <td className={`p-4 text-center ${getStatusStyles(row.desktop.status)}`}>
                        <div className="flex flex-col items-center gap-1">
                          <StatusLabel status={row.desktop.status} labels={t} />
                          <span className="text-xs text-muted-foreground">{row.desktop.note}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
