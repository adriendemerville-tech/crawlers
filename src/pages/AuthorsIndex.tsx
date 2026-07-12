import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowRight, PenLine } from 'lucide-react';
import adrienPhoto from '@/assets/adrien-de-volontat.jpg';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const SITE_URL = 'https://crawlers.fr';

const authors = [
  {
    name: 'Adrien de Volontat',
    slug: 'adrien-de-volontat',
    role: 'Fondateur & Expert SEO/GEO',
    bio: 'Journaliste de formation, ingénieur logiciel et fondateur de Crawlers.fr. Il conçoit les méthodologies d\'audit SEO & GEO et les algorithmes de visibilité LLM.',
    photo: adrienPhoto,
    articleCount: 20,
  },
];

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Auteurs Crawlers.fr',
  url: `${SITE_URL}/auteur`,
  description: 'Découvrez les auteurs et experts derrière les articles, guides et audits Crawlers.fr.',
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: authors.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Person',
        '@id': `${SITE_URL}/auteur/${a.slug}#person`,
        name: a.name,
        url: `${SITE_URL}/auteur/${a.slug}`,
        image: `${SITE_URL}${a.photo}`,
        jobTitle: a.role,
        description: a.bio,
      },
    })),
  },
};

export default function AuthorsIndex() {
  useCanonicalHreflang('/auteur');

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Auteurs Crawlers.fr — Experts SEO & GEO</title>
        <meta
          name="description"
          content="Découvrez les auteurs et experts derrière les articles, guides et audits Crawlers.fr."
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Auteurs Crawlers.fr — Experts SEO & GEO" />
        <meta property="og:description" content="Découvrez les auteurs et experts derrière les articles, guides et audits Crawlers.fr." />
        <meta property="og:url" content={`${SITE_URL}/auteur`} />
        <script type="application/ld+json">{JSON.stringify(collectionJsonLd)}</script>
      </Helmet>

      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-16">
        <section className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mb-4">
            <PenLine className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
            Auteurs
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Les experts qui écrivent les guides, audits et ressources de Crawlers.fr.
          </p>
        </section>

        <section className="grid gap-6">
          {authors.map((author) => (
            <article
              key={author.slug}
              className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start"
            >
              <Link to={`/auteur/${author.slug}`} className="shrink-0">
                <img
                  src={author.photo}
                  alt={`Photo de ${author.name}`}
                  width={120}
                  height={120}
                  className="w-28 h-28 rounded-2xl object-cover ring-2 ring-primary/20 hover:ring-primary/50 transition-all"
                  loading="lazy"
                />
              </Link>
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    <Link to={`/auteur/${author.slug}`} className="hover:text-primary transition-colors">
                      {author.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-primary font-medium">{author.role}</p>
                </div>
                <p className="text-muted-foreground leading-relaxed">{author.bio}</p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    to={`/auteur/${author.slug}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    Voir le profil <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    to="/blog"
                    className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  >
                    {author.articleCount}+ articles
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}
