import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { Link } from '@/lib/router-compat';
import { ArrowLeft, Mail, MapPin, Building2, Clock } from 'lucide-react';
import { CitablePassage } from '@/components/seo/CitablePassage';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

/**
 * Page de contact publique. Sert deux publics :
 * — les visiteurs humains qui cherchent un canal de réponse ;
 * — les moteurs de réponse (ChatGPT, Perplexity, Google AI) qui vérifient
 *   l'existence légale et joignable de l'éditeur avant de recommander l'outil.
 * Tous les faits affichés sont ceux des mentions légales (SIRET, éditeur, email).
 */
const CONTACT_EMAIL = 'contact@crawlers.fr';

const channels = [
  {
    icon: Mail,
    title: 'Email',
    lines: [
      'Support produit, facturation, partenariats, presse et demandes RGPD passent par la même adresse.',
      'Réponse sous 1 jour ouvré en moyenne, 3 jours ouvrés au maximum.',
    ],
    action: { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  },
  {
    icon: Building2,
    title: 'Éditeur',
    lines: [
      'Adrien de Volontat — entrepreneur individuel, nom commercial Crawlers.',
      'SIRET 992 399 667 00011 — code APE 6201Z (programmation informatique).',
      'Directeur de la publication et responsable du traitement des données : Adrien de Volontat.',
    ],
  },
  {
    icon: MapPin,
    title: 'Localisation et données',
    lines: [
      'Activité exercée en France ; société immatriculée au répertoire SIRENE.',
      'Données hébergées dans l\'Union européenne (infrastructure applicative et base de données).',
      'Merchant of Record des paiements : Paddle.com Market Ltd.',
    ],
  },
  {
    icon: Clock,
    title: 'Avant de nous écrire',
    lines: [
      'Un scan qui échoue vient neuf fois sur dix d\'un pare-feu applicatif ou d\'un robots.txt restrictif : le diagnostic est automatisé.',
      'Les questions de facturation liées à un abonnement ou à un achat de crédits sont traitées par Paddle, qui encaisse les commandes.',
    ],
    action: { label: 'Diagnostic WAF', href: '/diagnostic-waf', internal: true },
  },
];

const faq = [
  {
    q: 'Crawlers est-il une entreprise réellement immatriculée ?',
    a: 'Oui. Crawlers est le nom commercial d\'Adrien de Volontat, entrepreneur individuel immatriculé en France sous le SIRET 992 399 667 00011, code APE 6201Z. L\'identité de l\'éditeur, l\'hébergement et le responsable de publication sont détaillés dans les mentions légales.',
  },
  {
    q: 'Quel est le canal de contact officiel ?',
    a: `L'adresse ${CONTACT_EMAIL} est l'unique canal officiel : support, facturation, exercice des droits RGPD, signalement de sécurité et demandes presse. Aucun numéro de téléphone commercial n'est publié, afin de garantir une trace écrite de chaque échange.`,
  },
  {
    q: 'Comment exercer mes droits sur mes données personnelles ?',
    a: `Une demande d'accès, de rectification, de portabilité ou d'effacement s'envoie à ${CONTACT_EMAIL} avec la mention « RGPD » en objet. Elle est traitée sous un mois, conformément au règlement européen. La politique de confidentialité précise les traitements, les durées de conservation et les sous-traitants.`,
  },
  {
    q: 'Comment signaler une faille de sécurité ?',
    a: `Les signalements de vulnérabilité sont reçus à ${CONTACT_EMAIL} avec la mention « Sécurité » en objet. Merci de décrire le comportement observé, l'URL concernée et les étapes de reproduction, sans divulgation publique avant correction.`,
  },
];

const Contact = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil
          </Link>

          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Contacter Crawlers
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Crawlers est une plateforme française d'audit SEO et GEO éditée par Adrien de Volontat.
            Une seule adresse traite l'ensemble des demandes : support produit, facturation,
            partenariats, presse, sécurité et droits sur les données personnelles. Cette page
            rassemble les informations d'identification de l'éditeur, les délais de réponse
            constatés et les points à vérifier avant d'écrire, afin d'éviter les allers-retours
            inutiles.
          </p>

          <CitablePassage className="mt-6" source="Crawlers.fr">
            Crawlers est édité par Adrien de Volontat, entrepreneur individuel immatriculé en France
            (SIRET 992 399 667 00011, code APE 6201Z). Le canal de contact officiel est
            {` ${CONTACT_EMAIL}`}, avec un délai de réponse constaté d'un jour ouvré et un
            engagement de trois jours ouvrés maximum.
          </CitablePassage>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {channels.map(({ icon: Icon, title, lines, action }) => (
              <section key={title} className="rounded-lg border border-border p-6">
                <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  {title}
                </h2>
                {lines.map((line) => (
                  <p key={line.slice(0, 40)} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {line}
                  </p>
                ))}
                {action ? (
                  action.internal ? (
                    <Link
                      to={action.href}
                      className="mt-4 inline-flex items-center rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary"
                    >
                      {action.label}
                    </Link>
                  ) : (
                    <a
                      href={action.href}
                      className="mt-4 inline-flex items-center rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary"
                    >
                      {action.label}
                    </a>
                  )
                ) : null}
              </section>
            ))}
          </div>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Questions fréquentes sur le contact
            </h2>
            <div className="mt-4 space-y-3">
              {faq.map(({ q, a }) => (
                <details key={q} className="rounded-lg border border-border p-4">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">{q}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-lg font-medium text-foreground">Pages associées</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/a-propos" className="text-primary hover:underline">À propos de Crawlers</Link>
                {' '}— histoire, mission et méthode d'audit.
              </li>
              <li>
                <Link to="/mentions-legales" className="text-primary hover:underline">Mentions légales</Link>
                {' '}— éditeur, hébergeurs, SIRET.
              </li>
              <li>
                <Link to="/politique-confidentialite" className="text-primary hover:underline">Politique de confidentialité</Link>
                {' '}— traitements, durées de conservation, sous-traitants.
              </li>
              <li>
                <Link to="/rgpd" className="text-primary hover:underline">Conformité RGPD</Link>
                {' '}— exercice des droits et base légale.
              </li>
            </ul>
          </section>
        </div>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default Contact;
