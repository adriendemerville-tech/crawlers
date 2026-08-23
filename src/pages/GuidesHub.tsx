import { memo, lazy, Suspense } from 'react';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Link } from '@/lib/router-compat';
import { getRouteApi } from '@tanstack/react-router';
import { Header } from '@/components/Header';
import { ArrowRight, Building2, Search } from 'lucide-react';
import { PageEditorial } from '@/components/seo/PageEditorial';
import { useLanguage } from '@/contexts/LanguageContext';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

interface GuideEntry {
  slug: string;
  title: string;
  meta_description: string | null;
  guide_category: string | null;
}

const routeApi = getRouteApi('/guides/');

function GuidesHubComponent() {
  useCanonicalHreflang('/guides');
  const { language } = useLanguage();
  const guides = (routeApi.useLoaderData() as GuideEntry[]) ?? [];


  const blocA = guides.filter(g => g.guide_category === 'bloc_a');
  const blocB = guides.filter(g => g.guide_category === 'bloc_b');

  return (
    <>
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

          {guides.length === 0 ? (
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

        <PageEditorial
          heading="Comment utiliser les guides SEO & GEO de Crawlers"
          intro="Chaque guide part d'une situation concrète — un artisan sans fiche établissement, un e-commerce invisible dans ChatGPT, une agence qui gère vingt clients — et déroule les vérifications à mener, dans l'ordre, avec les seuils à atteindre. Aucun guide ne demande de compétence technique préalable : les actions sont décrites dans les termes du métier."
          citable="Un guide SEO & GEO utile ne liste pas des bonnes pratiques : il ordonne les vérifications par impact mesuré, en commençant par ce que les robots voient réellement dans le HTML servi."
          sections={[
            {
              title: 'Choisir le bon guide',
              paragraphs: [
                "Les guides « entreprises & indépendants » supposent un site vitrine ou un point de vente et se concentrent sur la présence locale, la clarté de l'offre et les pages de service. Les guides « professionnels du SEO & marketing » traitent l'outillage, la mesure et le pilotage multi-clients.",
                "Si vous hésitez, lancez d'abord un audit gratuit : le rapport indique quel levier pèse le plus sur votre visibilité actuelle et vers quel guide vous orienter.",
              ],
              bullets: [
                'Activité locale : priorité à la fiche établissement, aux avis et aux pages de zone.',
                "E-commerce : priorité aux fiches produit, aux données structurées et à la vitesse mobile.",
                'Prestataire de services : priorité aux pages d\'offre, aux preuves et aux contenus experts.',
                'Agence ou consultant : priorité au suivi, aux rapports et à la mutualisation des audits.',
              ],
            },
            {
              title: "Ce qui change avec les moteurs génératifs",
              paragraphs: [
                "Les crawlers de ChatGPT, Claude, Perplexity ou Gemini n'exécutent pas le JavaScript comme un navigateur. Un site dont le texte n'apparaît qu'après l'exécution du JavaScript est lu comme une page vide : aucune citation possible, quelle que soit la qualité rédactionnelle.",
                "Le second facteur est la citabilité : un passage autoportant, chiffré, daté et attribuable est reprenable tel quel par un modèle. Une page qui n'énonce jamais de fait vérifiable reste ignorée même si elle est parfaitement accessible.",
                "Le troisième facteur est l'autorité : mentions, liens éditoriaux et cohérence des informations de l'entreprise d'une source à l'autre.",
              ],
            },
            {
              title: 'Mesurer avant de rédiger',
              paragraphs: [
                "Chaque guide se termine par un contrôle chiffré : nombre de mots réellement extraits du HTML servi, présence des données structurées, LCP mobile au 75e centile, part de contenu citable. Ces mêmes mesures alimentent le score GEO des rapports Crawlers, ce qui permet de vérifier l'effet d'une correction plutôt que de la supposer.",
              ],
            },
          ]}
          faq={[
            {
              question: 'Les guides sont-ils gratuits ?',
              answer: "Oui, l'intégralité des guides est accessible sans compte ni paiement. Seuls les audits automatisés consomment des crédits.",
            },
            {
              question: 'À quelle fréquence sont-ils mis à jour ?',
              answer: "Ils sont révisés quand une mesure change de seuil (Core Web Vitals, comportement d'un crawler IA, format de données structurées) plutôt qu'à date fixe.",
            },
            {
              question: 'Faut-il un guide par métier ou un seul suffit-il ?',
              answer: "Commencez par celui qui correspond à votre activité principale. Les guides partagent le même socle de vérifications techniques : seuls les exemples et les priorités changent.",
            },
            {
              question: 'Un guide remplace-t-il un audit ?',
              answer: "Non. Le guide explique quoi vérifier et pourquoi ; l'audit mesure l'état réel de vos pages et hiérarchise les corrections selon leur impact.",
            },
          ]}
        />
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
