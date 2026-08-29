import { lazy, Suspense } from 'react';
import { Link } from '@/lib/router-compat';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CitablePassage } from '@/components/seo/CitablePassage';
import { SeoFaqList } from '@/components/seo/SeoFaqList';
import { SiloNav } from '@/components/seo/SiloNav';
import { ArrowRight, ShieldCheck, Gauge, Scale, Link2, Repeat, FileCheck2 } from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

import { MARKETPLACE_FAQ } from './MarketplaceBacklinksLanding.faq';

export default function MarketplaceBacklinksLanding() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <nav aria-label="Fil d'Ariane" className="mb-8 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Accueil
          </Link>
          <span className="px-2">/</span>
          <Link to="/generative-engine-optimization" className="hover:text-foreground">
            Référencement IA &amp; GEO
          </Link>
          <span className="px-2">/</span>
          <span className="text-foreground">Place d’échange de backlinks</span>
        </nav>

        <section className="mb-16">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <Scale className="mr-1.5 h-3 w-3" /> Prix calculé, jamais négocié
          </Badge>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Place d’échange de backlinks : acheter et vendre un lien à un prix déterministe
          </h1>
          <p className="mb-6 max-w-3xl text-lg text-muted-foreground">
            Vendez un emplacement de lien sur vos pages les moins stratégiques, achetez un lien sur
            une page dont le besoin est prouvé. Le prix, l’attribut du lien et les plafonds
            d’insertion sont calculés par Crawlers.fr à partir de vos données réelles de crawl et de
            Search Console — sans négociation, sans place de marché opaque, sans ferme de liens.
          </p>

          <CitablePassage source="Crawlers.fr — Place d’échange">
            Sur la place d’échange Crawlers.fr, le prix d’un emplacement de lien découle de cinq
            signaux normalisés (autorité, proximité sémantique, trafic de la page, qualité
            éditoriale, visibilité dans les moteurs génératifs) répartis en cinq paliers de 40 € à
            350 €, avec une commission de 15 % et un attribut de lien décidé par le déficit
            d’autorité réel de l’acheteur, jamais par le vendeur.
          </CitablePassage>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="outline">
              <Link to="/console">
                Ouvrir la place d’échange <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/marina">Mesurer d’abord mon déficit d’autorité</Link>
            </Button>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-8 text-3xl font-bold">Ce qui distingue cette place d’échange</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Gauge,
                title: 'Prix déterministe',
                desc: 'Cinq signaux mesurés, cinq paliers de 40 à 350 €. Le même profil de page donne toujours le même prix : aucune enchère, aucun arbitraire.',
              },
              {
                icon: ShieldCheck,
                title: 'Vendeur protégé',
                desc: 'Un indice de risque de cession écarte vos pages piliers, vos pages de conversion et vos pages en progression. Vous ne vendez que ce qui ne vous coûte rien.',
              },
              {
                icon: Link2,
                title: 'Attribut imposé',
                desc: 'Sponsored par défaut. Le dofollow est réservé aux besoins d’autorité prouvés, avec une base de décision enregistrée et auditable.',
              },
              {
                icon: Repeat,
                title: 'Troc en boucle',
                desc: 'La plateforme privilégie les boucles à trois participants ou plus. L’échange réciproque direct est décoté, différé et contingenté.',
              },
              {
                icon: FileCheck2,
                title: 'Publication vérifiée',
                desc: 'Contrôle à J+1, J+7 puis mensuel. Une coquille JavaScript ou un blocage de crawl ne valent jamais rupture : le rendu est escaladé avant tout verdict.',
              },
              {
                icon: Scale,
                title: 'Comptabilité figée',
                desc: 'Commission de 15 %, pièces figées à l’émission, exigibilité à la première preuve de publication, export conforme aux obligations déclaratives.',
              },
            ].map((item) => (
              <Card key={item.title} className="border-border/60 bg-card/40 p-6">
                <item.icon className="mb-3 h-7 w-7 text-primary" />
                <h3 className="mb-2 font-bold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-6 text-3xl font-bold">Comment se déroule une transaction</h2>
          <ol className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">1. Preuve de propriété.</strong> Le vendeur
              vérifie son domaine par Search Console, enregistrement DNS ou fichier déposé, et
              accepte une déclaration de responsabilité. Sans vérification, aucune mise en vente.
            </li>
            <li>
              <strong className="text-foreground">2. Inventaire et prix.</strong> Chaque page
              éligible affiche son palier, son prix estimé, son indice de risque de cession et ses
              plafonds restants. L’activation se fait page par page.
            </li>
            <li>
              <strong className="text-foreground">3. Besoin acheteur confirmé.</strong> Le besoin
              est dérivé du plan de travail éditorial et technique de l’acheteur, qui doit confirmer
              son objectif (autorité, visibilité générative, trafic, mixte) avant tout achat.
            </li>
            <li>
              <strong className="text-foreground">4. Appariement expliqué.</strong> Le score de
              compatibilité est accompagné des facteurs qui l’ont produit : pas de score opaque.
            </li>
            <li>
              <strong className="text-foreground">5. Commande figée.</strong> Prix, commission,
              attribut, base de décision, engagement de maintien et version des constantes sont
              gelés côté serveur et ne changent plus.
            </li>
            <li>
              <strong className="text-foreground">6. Contenu et insertion.</strong> Le vendeur
              valide le paragraphe d’insertion, l’acheteur choisit la variante finale, avec trois
              tours de révision au maximum.
            </li>
            <li>
              <strong className="text-foreground">7. Contrôle dans le temps.</strong> La publication
              est vérifiée puis suivie mensuellement ; un retrait déclenche un remboursement au
              prorata sur le support de paiement d’origine.
            </li>
          </ol>
        </section>

        <section className="mb-16">
          <h2 className="mb-6 text-3xl font-bold">Questions fréquentes</h2>
          <SeoFaqList items={MARKETPLACE_FAQ.map((f) => ({ question: f.question, answer: f.answer }))} />
        </section>

        <SiloNav
          silo="geo"
          currentPath="/marketplace-backlinks"
          heading="Remonter au pilier référencement IA"
          className="mb-16"
        />

        <section className="rounded-2xl border border-border bg-card/40 p-8 text-center">
          <h2 className="mb-3 text-2xl font-bold">
            Un lien vendu par mois rembourse votre abonnement
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-sm text-muted-foreground">
            La place d’échange est incluse dans les offres payantes. Les crédits gagnés servent au
            troc, aux audits et à la génération de contenu.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link to="/tarifs">Voir les tarifs</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/console">Ouvrir la place d’échange</Link>
            </Button>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
