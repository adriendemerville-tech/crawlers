import { memo, useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Loader2, ArrowRight, Building2, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

interface GuideEntry {
  slug: string;
  title: string;
  meta_description: string | null;
  guide_category: string | null;
}

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Guides SEO & GEO par métier et profil',
  description: 'Guides pratiques pour améliorer votre visibilité sur Google et les IA, adaptés à votre métier.',
  url: 'https://crawlers.fr/guides',
  publisher: {
    '@type': 'Organization',
    name: 'Crawlers',
    url: 'https://crawlers.fr',
  },
};

function GuidesHubComponent() {
  const { language } = useLanguage();
  const [guides, setGuides] = useState<GuideEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGuides = async () => {
      const { data } = await supabase
        .from('seo_page_drafts' as any)
        .select('slug, title, meta_description, guide_category')
        .eq('page_type', 'guide')
        .eq('status', 'published')
        .order('created_at', { ascending: true });

      if (data) setGuides(data as unknown as GuideEntry[]);
      setLoading(false);
    };
    fetchGuides();
  }, []);

  const blocA = guides.filter(g => g.guide_category === 'bloc_a');
  const blocB = guides.filter(g => g.guide_category === 'bloc_b');

  return (
    <>
      <Helmet>
        <title>Guides SEO & GEO par métier | Crawlers</title>
        <meta name="description" content="Guides pratiques SEO et GEO adaptés à votre métier : artisan, commerçant, PME, startup, agence SEO, consultant. Améliorez votre visibilité sur Google et les IA." />
        <link rel="canonical" href="https://crawlers.fr/guides" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Guides SEO & GEO par métier | Crawlers" />
        <meta property="og:description" content="Guides pratiques pour améliorer votre visibilité sur Google et les IA." />
        <meta property="og:url" content="https://crawlers.fr/guides" />
        <script type="application/ld+json">{JSON.stringify(collectionJsonLd)}</script>
      </Helmet>

      <Header />

      <main className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Guides SEO & GEO par métier
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Des guides pratiques adaptés à votre activité pour améliorer votre visibilité sur Google et les moteurs de recherche IA.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : guides.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              Les guides arrivent bientôt. Revenez vite !
            </p>
          ) : (
            <div className="space-y-12">
              {/* Bloc A — Métiers */}
              {blocA.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h2 className="text-2xl font-bold text-foreground">Pour les entreprises & indépendants</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {blocA.map(g => (
                      <GuideCard key={g.slug} guide={g} />
                    ))}
                  </div>
                </section>
              )}

              {/* Bloc B — Pros */}
              {blocB.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <Search className="h-5 w-5 text-primary" />
                    <h2 className="text-2xl font-bold text-foreground">Pour les professionnels du SEO & Marketing</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {blocB.map(g => (
                      <GuideCard key={g.slug} guide={g} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}

function GuideCard({ guide }: { guide: GuideEntry }) {
  return (
    <Link
      to={`/guide/${guide.slug}`}
      className="group flex flex-col gap-2 rounded-xl border-2 border-border/60 bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
    >
      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
        {guide.title}
      </h3>
      {guide.meta_description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{guide.meta_description}</p>
      )}
      <span className="mt-auto flex items-center gap-1 text-sm text-primary font-medium pt-2">
        Lire le guide <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

export default memo(GuidesHubComponent);
