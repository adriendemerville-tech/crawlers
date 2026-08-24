import { lazy, Suspense } from 'react';
import { Link } from '@/lib/router-compat';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CitablePassage } from '@/components/seo/CitablePassage';
import { SeoFaqList } from '@/components/seo/SeoFaqList';
import { SiloNav } from '@/components/seo/SiloNav';
import { ArrowRight, ShieldCheck, Gauge, Scale, Repeat, FileCheck2, Eye } from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

export const COLLAB_INSTAGRAM_FAQ = [
  {
    question: 'Qu’échange-t-on exactement dans une collaboration Instagram sur Crawlers.fr ?',
    answer:
      "Un emplacement de visibilité daté : une story avec mention et lien, ou une publication au flux, dont la durée d’engagement et la date de diffusion sont figées à la commande. La contrepartie peut être un lien éditorial sur un site, une autre collaboration sociale, des crédits ou un règlement en euros. Ce n’est jamais un achat d’abonnés ni un placement masqué.",
  },
  {
    question: 'Comment le prix d’une story ou d’une publication est-il calculé ?',
    answer:
      "Par les mêmes règles déterministes que la place d’échange de backlinks : des signaux normalisés de 0 à 100 (audience réelle mesurée, proximité thématique avec l’annonceur, engagement observé, qualité éditoriale du compte, cohérence de l’identité) donnent un score global qui tombe dans un palier de prix. À signaux identiques, prix identique. Aucun modèle de langage n’intervient dans ce calcul.",
  },
  {
    question: 'La collaboration doit-elle être signalée comme un partenariat ?',
    answer:
      "Oui, systématiquement. Toute collaboration rémunérée — en euros, en crédits ou en troc — doit porter une mention de partenariat explicite conforme aux obligations françaises sur l’influence commerciale. La mention fait partie du contenu validé avant diffusion ; son absence constatée équivaut à une non-exécution.",
  },
  {
    question: 'Comment la diffusion est-elle vérifiée pour une story éphémère ?',
    answer:
      "Une story est contrôlée dans sa fenêtre de vie par capture datée déposée par le diffuseur, puis recoupée avec les statistiques du compte. Une publication au flux est contrôlée à J+1, J+7 puis mensuellement jusqu’à la fin de l’engagement. Un compte temporairement inaccessible ne vaut pas rupture : le contrôle est réitéré avant tout constat négatif.",
  },
  {
    question: 'Peut-on troquer une collaboration Instagram contre un backlink ?',
    answer:
      "Oui : les jambes sociales et les jambes de lien circulent dans le même moteur de troc, chacune valorisée dans sa propre unité puis convertie au taux de la place d’échange. Les boucles à trois participants ou plus sont privilégiées ; l’échange réciproque direct est décoté et différé. Une soulte en euros comble l’écart de valeur entre les deux jambes.",
  },
  {
    question: 'Quelle commission s’applique et comment la propriété du compte est-elle prouvée ?',
    answer:
      "La commission est de 15 %, comme sur les emplacements de lien. La propriété du compte se prouve par une connexion officielle au compte professionnel : aucun compte déclaré sans preuve ne peut être mis en vente, et une preuve révoquée retire immédiatement l’inventaire correspondant.",
  },
] as const;

export default function CollabInstagramLanding() {
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
          <span className="text-foreground">Collaborations Instagram</span>
        </nav>

        <section className="mb-16">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <Scale className="mr-1.5 h-3 w-3" /> Visibilité mesurée, prix calculé
          </Badge>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Collaborations Instagram : échanger de la visibilité à un prix déterministe
          </h1>
          <p className="mb-6 max-w-3xl text-lg text-muted-foreground">
            Cédez une story ou une publication à un annonceur dont la thématique correspond à la
            vôtre, ou obtenez une mention là où votre déficit de visibilité est constaté. Le prix,
            la durée d’engagement et la mention de partenariat sont fixés par les mêmes règles
            déterministes que la place d’échange de backlinks — pas d’enchère, pas d’achat
            d’audience, pas de placement masqué.
          </p>

          <CitablePassage source="Crawlers.fr — Collaborations Instagram">
            Sur la place d’échange Crawlers.fr, une collaboration Instagram est valorisée par des
            signaux mesurés (audience réelle, engagement observé, proximité thématique, qualité
            éditoriale du compte, cohérence de l’identité), avec une commission de 15 %, une mention
            de partenariat obligatoire et une diffusion vérifiée : story contrôlée par capture datée
            dans sa fenêtre de vie, publication au flux contrôlée à J+1, J+7 puis chaque mois.
          </CitablePassage>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="outline">
              <Link to="/console">
                Ouvrir la place d’échange <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/marketplace-backlinks">Voir la place d’échange de backlinks</Link>
            </Button>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-8 text-3xl font-bold">Les règles qui encadrent une collaboration</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Gauge,
                title: 'Prix déterministe',
                desc: 'Audience réelle, engagement observé, proximité thématique et qualité du compte donnent un palier de prix. Le même profil donne toujours le même prix.',
              },
              {
                icon: ShieldCheck,
                title: 'Propriété prouvée',
                desc: 'Le compte professionnel est rattaché par connexion officielle. Une preuve révoquée retire immédiatement l’inventaire correspondant.',
              },
              {
                icon: Eye,
                title: 'Partenariat déclaré',
                desc: 'La mention de partenariat est obligatoire et validée avec le contenu, conformément aux obligations françaises sur l’influence commerciale.',
              },
              {
                icon: Repeat,
                title: 'Troc inter-supports',
                desc: 'Une story peut se troquer contre un lien éditorial ou une autre collaboration. Les boucles à trois participants sont privilégiées, la réciprocité directe décotée.',
              },
              {
                icon: FileCheck2,
                title: 'Diffusion vérifiée',
                desc: 'Story contrôlée par capture datée dans sa fenêtre de vie, publication au flux suivie à J+1, J+7 puis mensuellement jusqu’au terme de l’engagement.',
              },
              {
                icon: Scale,
                title: 'Comptabilité figée',
                desc: 'Commission de 15 %, pièces figées à l’émission, exigibilité à la première preuve de diffusion, export conforme aux obligations déclaratives.',
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
          <h2 className="mb-6 text-3xl font-bold">Comment se déroule une collaboration</h2>
          <ol className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">1. Rattachement du compte.</strong> Le diffuseur
              connecte son compte professionnel Instagram : sans preuve de propriété, aucun
              emplacement ne peut être proposé.
            </li>
            <li>
              <strong className="text-foreground">2. Inventaire valorisé.</strong> Chaque format
              disponible (story, publication au flux) affiche son palier, son prix et ses plafonds
              de diffusion restants sur la période.
            </li>
            <li>
              <strong className="text-foreground">3. Besoin annonceur confirmé.</strong> Le besoin
              de visibilité est dérivé du diagnostic de l’annonceur, qui confirme son objectif avant
              tout achat.
            </li>
            <li>
              <strong className="text-foreground">4. Appariement expliqué.</strong> Le score de
              compatibilité est présenté avec les facteurs qui l’ont produit : audience, thématique,
              engagement, cohérence d’identité.
            </li>
            <li>
              <strong className="text-foreground">5. Commande figée.</strong> Prix, commission,
              format, date de diffusion, durée d’engagement et mention de partenariat sont gelés
              côté serveur.
            </li>
            <li>
              <strong className="text-foreground">6. Contenu validé.</strong> Le diffuseur garde la
              main sur la formulation ; l’annonceur valide la variante finale, dans la limite de
              trois tours de révision.
            </li>
            <li>
              <strong className="text-foreground">7. Contrôle de diffusion.</strong> La diffusion
              est constatée puis suivie jusqu’au terme ; un retrait anticipé déclenche un
              remboursement au prorata du reliquat d’engagement.
            </li>
          </ol>
        </section>

        <section className="mb-16">
          <h2 className="mb-6 text-3xl font-bold">Questions fréquentes</h2>
          <SeoFaqList
            items={COLLAB_INSTAGRAM_FAQ.map((f) => ({ question: f.question, answer: f.answer }))}
          />
        </section>

        <SiloNav
          silo="geo"
          currentPath="/collab-instagram"
          heading="Remonter au pilier référencement IA"
          className="mb-16"
        />

        <section className="rounded-2xl border border-border bg-card/40 p-8 text-center">
          <h2 className="mb-3 text-2xl font-bold">
            Votre audience a une valeur : elle se mesure avant de se vendre
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-sm text-muted-foreground">
            Les collaborations sociales et les emplacements de lien partagent la même balance : ce
            que vous cédez et ce que vous recevez sont amortis dans le temps et pilotés depuis la
            console.
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
