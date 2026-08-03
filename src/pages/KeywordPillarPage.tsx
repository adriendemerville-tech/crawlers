import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Link, useLocation, Navigate } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { KEYWORD_PILLARS } from '@/data/keywordPillars';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

/**
 * Reusable pillar page for the 5 SEO/GEO lexical-expansion pages.
 * Renders H1/H2/H3, FAQ, internal links, Article + FAQPage JSON-LD.
 *
 * Routed via /:slug where slug is one of the keys in KEYWORD_PILLARS.
 */
export default function KeywordPillarPage() {
  const location = useLocation();
  const slug = location.pathname.replace(/^\/+/, '').split('/')[0];
  const data = KEYWORD_PILLARS[slug];
  useCanonicalHreflang(`/${slug}`);

  if (!data) return <Navigate to="/404" replace />;

  const canonical = `https://crawlers.fr/${data.slug}`;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.h1,
    description: data.metaDesc,
    keywords: data.primaryKeyword,
    datePublished: data.datePublished,
    dateModified: data.datePublished,
    author: { '@type': 'Person', name: 'Adrien de Volontat', url: 'https://crawlers.fr/auteur/adrien-de-volontat' },
    publisher: { '@type': 'Organization', name: 'Crawlers.fr', url: 'https://crawlers.fr' },
    mainEntityOfPage: canonical,
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://crawlers.fr/' },
      { '@type': 'ListItem', position: 2, name: data.h1, item: canonical },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <Header />

      <main className="mx-auto max-w-4xl px-4 py-12 md:py-20">
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:underline">Accueil</Link>
          <span className="mx-2">/</span>
          <span aria-current="page">{data.primaryKeyword}</span>
        </nav>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">{data.h1}</h1>
        <p className="text-lg text-foreground/80 leading-relaxed mb-10">{data.intro}</p>

        <div className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground">
          {data.sections.map((section, si) => (
            <section key={si} className="mb-12">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{section.h2}</h2>
              <p className="text-base leading-relaxed mb-6">{section.body}</p>
              {section.h3s?.map((h3, hi) => (
                <article key={hi} className="mb-5">
                  <h3 className="text-xl font-semibold mt-6 mb-2">{h3.title}</h3>
                  <p className="text-base leading-relaxed">{h3.body}</p>
                </article>
              ))}
            </section>
          ))}

          <section className="mt-16 pt-10 border-t border-border">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Questions fréquentes</h2>
            <div className="space-y-4">
              {data.faqs.map((f, i) => (
                <details key={i} className="group rounded-lg border border-border bg-card/30 p-4">
                  <summary className="cursor-pointer font-semibold list-none flex justify-between items-center">
                    <span>{f.q}</span>
                    <span className="text-foreground/50 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-16 pt-10 border-t border-border">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Pour aller plus loin</h2>
            <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
              {data.relatedLinks.map((link, i) => (
                <li key={i}>
                  <Link
                    to={link.to}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4 hover:border-foreground/40 transition-colors no-underline"
                  >
                    <span className="font-medium text-foreground">{link.label}</span>
                    <ArrowRight className="h-4 w-4 text-foreground/60" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-16 rounded-2xl border border-border bg-card/40 p-8 text-center">
            <div className="inline-flex items-center gap-2 mb-3 text-sm text-foreground/70">
              <CheckCircle2 className="h-4 w-4" />
              Audit gratuit, sans inscription, 90 secondes
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Lancez votre audit maintenant</h2>
            <p className="text-foreground/80 mb-6">Diagnostic SEO et GEO complet sur votre URL, avec plan d'action priorisé.</p>
            <Link to="/">
              <Button variant="outline" size="lg" className="gap-2">
                Auditer mon site
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </section>
        </div>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
