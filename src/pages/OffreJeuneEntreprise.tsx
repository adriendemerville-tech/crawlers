import { lazy, Suspense } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { DirectAnswer } from '@/components/seo/DirectAnswer';
import { StartupTrialOffer } from '@/components/StartupTrialOffer';
import { Link } from '@/lib/router-compat';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

const PATH = '/offre-jeune-entreprise';

const SOMMAIRE = [
  { id: 'eligibilite', label: 'Qui peut en bénéficier ?' },
  { id: 'inclus', label: 'Ce que contient le plan Pro Agency offert' },
  { id: 'verification', label: 'Comment fonctionne la vérification SIRET et Kbis' },
  { id: 'apres', label: 'Que se passe-t-il après 12 mois ?' },
  { id: 'demande', label: 'Demander mes 12 mois gratuits' },
  { id: 'faq', label: 'Questions fréquentes' },
];

const INCLUS = [
  'Audit SEO technique sur plus de 200 points, en illimité',
  'Audit stratégique GEO et suivi de la visibilité dans les moteurs IA',
  'Crawl jusqu’à 5 000 pages par site, sur 30 sites suivis',
  'Matrice de concurrence SERP et citations IA',
  'Cocon sémantique 3D et plan de maillage interne',
  'Content Architect : génération et publication de contenu vers votre CMS',
  'Détection des bots IA (GPTBot, ClaudeBot, PerplexityBot) et attribution GA4',
];

function OfferCta({ bottom = false }: { bottom?: boolean }) {
  return (
    <section
      className={`border-y border-primary/30 py-6 ${bottom ? 'mt-12' : 'mb-10'}`}
      aria-label="Demander l’offre jeune entreprise"
    >
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-gold">
            12 mois offerts, sans carte bancaire
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Entreprises et freelances immatriculés depuis moins d’un an : le plan Pro Agency
            (29 €/mois) est gratuit pendant un an après vérification du SIRET et du Kbis.
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="shrink-0 bg-transparent hover:bg-transparent">
          <a href="#demande">
            Vérifier mon éligibilité <ArrowRight aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>
  );
}

export default function OffreJeuneEntreprise() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-24 sm:px-6">
        <nav aria-label="Fil d’Ariane" className="mb-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Accueil</Link>
          <span aria-hidden="true"> / </span>
          <Link to="/tarifs" className="hover:text-foreground">Tarifs</Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">Offre jeune entreprise</span>
        </nav>

        <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">
          Plan SEO et GEO gratuit 12 mois pour les jeunes entreprises
        </h1>

        <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
          Crawlers.fr offre son plan Pro Agency pendant un an complet aux entreprises et freelances
          français immatriculés depuis moins de douze mois : audit SEO technique, audit GEO, crawl,
          cocon sémantique et publication de contenu, sans engagement ni carte bancaire.
        </p>

        <DirectAnswer
          path={PATH}
          question="Comment obtenir un outil SEO et GEO gratuit quand on vient de créer son entreprise ?"
          answer={
            <>
              Une entreprise ou un freelance immatriculé depuis moins de douze mois obtient le plan
              Pro Agency de Crawlers.fr gratuitement pendant un an, en renseignant son numéro SIRET
              et en déposant son extrait Kbis. La date de création est vérifiée auprès de l’annuaire
              officiel des entreprises, puis le compte est activé sans carte bancaire.
            </>
          }
          facts={[
            { label: 'Qui', value: 'Entreprises, associations et freelances immatriculés depuis moins de 12 mois' },
            { label: 'Quoi', value: 'Plan Pro Agency complet : audits SEO, GEO, crawl, cocon sémantique, contenu' },
            { label: 'Combien', value: '0 € pendant 12 mois, puis 29 €/mois sans engagement' },
            { label: 'Comment', value: 'Vérification du SIRET via l’annuaire officiel et dépôt du Kbis (PDF, 10 Mo max)' },
            { label: 'Quand', value: 'Activation dès la validation du dossier' },
          ]}
        />

        <OfferCta />

        <nav aria-label="Sommaire" className="mb-12 rounded-lg border border-border p-5">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sommaire
          </p>
          <ol className="space-y-2 text-sm">
            {SOMMAIRE.map((item, i) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="hover:text-brand-gold">
                  {i + 1}. {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <section id="eligibilite" className="mb-12 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-semibold">Qui peut en bénéficier ?</h2>
          <blockquote className="citable-passage">
            L’offre s’adresse à toute structure française — société, micro-entreprise, association ou
            freelance — dont la date d’immatriculation au registre national des entreprises remonte à
            moins de douze mois au jour de la demande. Un seul compte gratuit est accordé par SIREN.
          </blockquote>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Aucune condition de chiffre d’affaires, de secteur ni de taille d’équipe n’est appliquée.
            Les structures créées depuis plus d’un an conservent l’accès au plan gratuit standard et à
            l’essai de 14 jours sans carte bancaire décrits sur la page <Link to="/tarifs" className="underline">tarifs</Link>.
          </p>
        </section>

        <section id="inclus" className="mb-12 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-semibold">Ce que contient le plan Pro Agency offert</h2>
          <ul className="space-y-3">
            {INCLUS.map((item) => (
              <li key={item} className="flex gap-3 text-muted-foreground">
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Il s’agit du plan payant complet à 29 €/mois, sans fonctionnalité retirée : la valeur
            offerte représente 348 € sur douze mois.
          </p>
        </section>

        <section id="verification" className="mb-12 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-semibold">
            Comment fonctionne la vérification SIRET et Kbis
          </h2>
          <blockquote className="citable-passage">
            La demande se fait en trois étapes : saisie du numéro SIRET, contrôle automatique de la
            date de création auprès de l’annuaire officiel des entreprises, puis dépôt de l’extrait
            Kbis au format PDF. Le document est stocké dans un espace privé et sert uniquement au
            contrôle d’éligibilité.
          </blockquote>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            La date d’immatriculation est revalidée côté serveur au moment de l’activation, afin que
            l’offre ne puisse pas être accordée sur la base d’une information saisie côté navigateur.
          </p>
        </section>

        <section id="apres" className="mb-12 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-semibold">Que se passe-t-il après 12 mois ?</h2>
          <blockquote className="citable-passage">
            À l’issue des douze mois, le compte bascule automatiquement sur le plan gratuit : aucun
            prélèvement n’est déclenché, puisque aucune carte bancaire n’a été enregistrée. Le passage
            au plan Pro Agency payant reste une décision volontaire.
          </blockquote>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Les données produites pendant l’année offerte — audits, crawls, rapports, contenus —
            restent consultables dans la console.
          </p>
        </section>

        <section id="demande" className="mb-12 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-semibold">Demander mes 12 mois gratuits</h2>
          <StartupTrialOffer />
        </section>

        <section id="faq" className="mb-8 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-semibold">Questions fréquentes</h2>
          <div className="space-y-6">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question}>
                <h3 className="mb-2 font-semibold">{item.question}</h3>
                <p className="leading-relaxed text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <OfferCta bottom />
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}

export const FAQ_ITEMS = [
  {
    question: 'Faut-il une carte bancaire pour activer l’offre ?',
    answer:
      'Non. L’activation repose uniquement sur la vérification du SIRET et le dépôt du Kbis. Aucun moyen de paiement n’est demandé, et aucun prélèvement n’intervient à la fin des douze mois.',
  },
  {
    question: 'Une micro-entreprise ou un freelance est-il éligible ?',
    answer:
      'Oui, dès lors que l’immatriculation date de moins de douze mois. Le statut juridique n’entre pas dans les critères : société, micro-entreprise, association et profession libérale sont traitées de la même manière.',
  },
  {
    question: 'Quelles fonctionnalités sont limitées pendant l’année offerte ?',
    answer:
      'Aucune. Le plan Pro Agency est fourni intégralement : audits illimités, 30 sites suivis, crawl jusqu’à 5 000 pages, matrice de concurrence, cocon sémantique et publication de contenu.',
  },
  {
    question: 'Que devient l’extrait Kbis transmis ?',
    answer:
      'Il est déposé dans un espace de stockage privé, accessible uniquement au traitement d’éligibilité. Il n’est ni publié, ni partagé avec des tiers.',
  },
  {
    question: 'Peut-on cumuler l’offre avec l’essai de 14 jours ?',
    answer:
      'Non. Les douze mois offerts remplacent l’essai de 14 jours, qui reste destiné aux structures immatriculées depuis plus d’un an.',
  },
];
