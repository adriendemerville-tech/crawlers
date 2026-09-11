import { memo, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/router-compat';
import { SiloNav } from '@/components/seo/SiloNav';
import { ArrowRight, Check, Clock, FileText, MapPin, Shield } from 'lucide-react';

const COMPARISON: Array<{ label: string; agency: string; crawlers: string }> = [
  { label: 'Audit technique et éditorial du site', agency: 'Inclus', crawlers: 'Inclus' },
  { label: 'Mesure de la visibilité dans les réponses IA (GEO)', agency: 'Rarement proposée', crawlers: 'Incluse' },
  { label: 'Contenus rédigés (3 pages)', agency: 'Souvent en option', crawlers: 'Inclus' },
  { label: 'Optimisation de la fiche Google Maps', agency: 'Souvent en option', crawlers: 'Incluse' },
  { label: 'Déploiement des correctifs', agency: 'Selon devis', crawlers: 'Inclus, après validation' },
  { label: 'Délai', agency: '2 à 6 semaines', crawlers: '72 h ouvrées' },
  { label: 'Prix', agency: '1 400 – 2 700 € (estimation)', crawlers: '59 € TTC' },
];

const PRICE_FACTORS = [
  {
    title: 'La taille du site',
    text: 'Un site vitrine de 10 pages ne demande pas le même travail qu\'un catalogue de 2 000 pages. La plupart des grilles d\'agence facturent au volume de pages analysées.',
  },
  {
    title: 'La profondeur de l\'analyse',
    text: 'Un audit qui se contente de balises title coûte moins cher qu\'un audit qui mesure aussi la citabilité par les moteurs IA, le maillage interne et les données structurées.',
  },
  {
    title: 'La mise en œuvre',
    text: 'Beaucoup d\'audits s\'arrêtent au rapport PDF. Corriger les titres, rédiger les contenus et optimiser la fiche Google Maps représente l\'essentiel de la facture en agence.',
  },
  {
    title: 'Le niveau d\'automatisation',
    text: 'Crawlers automatise le crawl, la mesure et la rédaction des brouillons. C\'est ce qui permet un prix fixe de 59 € au lieu d\'un devis à quatre chiffres.',
  },
];

const FAQ_ITEMS: Array<[string, string]> = [
  [
    'Combien coûte un audit SEO en agence ?',
    'Pour un site de TPE/PME, un audit suivi de la mise en œuvre (contenus, correctifs, fiche Google Maps) est généralement facturé entre 1 400 € et 2 700 €, sur un délai de 2 à 6 semaines. Il s\'agit d\'une estimation : chaque agence établit son propre devis.',
  ],
  [
    'Pourquoi la passe Crawlers ne coûte-t-elle que 59 € ?',
    'Parce que le crawl, la mesure GEO, la priorisation des correctifs et la rédaction des brouillons sont automatisés. Vous payez le résultat, pas les heures de production.',
  ],
  [
    'Un audit gratuit suffit-il ?',
    'Un audit gratuit identifie les problèmes mais ne les corrige pas. La passe unique inclut l\'audit, 3 contenus rédigés, les correctifs déployés après votre validation et l\'optimisation de votre fiche Google Maps.',
  ],
  [
    'Y a-t-il un abonnement ou des frais cachés ?',
    'Non. La passe unique est un paiement de 59 € TTC, sans abonnement. Vous êtes remboursé intégralement tant qu\'aucun correctif n\'a été déployé sur votre site.',
  ],
  [
    'Quelle est la différence entre un audit SEO et un audit GEO ?',
    'L\'audit SEO mesure votre visibilité sur Google (balises, contenu, vitesse, maillage). L\'audit GEO mesure en plus votre citabilité par les moteurs IA comme ChatGPT ou Perplexity : passages citables, données structurées, présence dans leurs réponses. La passe Crawlers couvre les deux.',
  ],
];

const INCLUDED = [
  { icon: FileText, title: 'Audit de votre site', description: '6 à 10 correctifs prioritaires sur titres, descriptions, balisage, vitesse et maillage.' },
  { icon: FileText, title: '3 pages de contenu', description: 'Rédigées sur les sujets qui rapportent des clients, relues et validées par vous.' },
  { icon: MapPin, title: 'Fiche Google Maps', description: 'Description, catégories, horaires, site web et une publication optimisée.' },
];

function PrixAuditSeoComponent(): React.ReactElement {
  const lightThemeVars = {
    '--background': '43 10% 96%',
    '--foreground': '222 47% 11%',
    '--card': '0 0% 100%',
    '--card-foreground': '222 47% 11%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '222 47% 11%',
    '--primary': '262 83% 53%',
    '--primary-foreground': '210 40% 98%',
    '--secondary': '43 10% 94%',
    '--secondary-foreground': '222 47% 11%',
    '--muted': '43 10% 94%',
    '--muted-foreground': '0 0% 45%',
    '--accent': '43 10% 94%',
    '--accent-foreground': '222 47% 11%',
    '--border': '0 0% 88%',
    '--input': '0 0% 88%',
    '--ring': '262 83% 53%',
    '--brand-violet': '262 83% 58%',
    '--brand-violet-muted': '262 72% 96%',
    '--brand-gold': '45 93% 47%',
    '--brand-gold-muted': '45 90% 95%',
  } as React.CSSProperties;

  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = 'hsl(43 10% 96%)';
    return () => {
      document.body.style.backgroundColor = previous;
    };
  }, []);

  return (
    <div className="light-scope min-h-screen bg-background text-foreground" style={lightThemeVars}>
      <Header />
      <main className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute -top-40 -right-32 h-80 w-80 rounded-full bg-brand-violet/10 blur-3xl" />
          <div className="mx-auto max-w-5xl px-6 pt-28 pb-16 sm:pt-36">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-violet/40 px-3 py-1 text-xs font-medium text-brand-violet">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-violet" />
              Prix et tarifs 2026
            </div>
            <h1 className="mb-6 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Prix d'un <span className="text-brand-violet">audit SEO et GEO</span> : ce que ça coûte vraiment
            </h1>
            <blockquote className="citable-passage mb-8 max-w-2xl text-lg text-muted-foreground">
              Un audit SEO avec mise en œuvre coûte généralement entre <strong>1 400 € et 2 700 €</strong> en agence
              (estimation pour un site de TPE/PME, délai 2 à 6 semaines). La passe unique Crawlers réalise
              l'audit, la rédaction de 3 contenus et l'optimisation de votre fiche Google Maps
              pour <strong>59 € TTC</strong>, déployés en 72 h ouvrées après votre validation.
            </blockquote>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-12 gap-2 border border-foreground bg-transparent px-6 text-foreground hover:bg-foreground hover:text-background">
                <Link to="/audit-geo-seo">
                  Lancer mon audit gratuit
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Audit gratuit et immédiat — la passe à 59 € n'est proposée qu'ensuite, si des correctifs sont utiles.
            </p>
          </div>
        </section>

        {/* Combien coûte un audit SEO ? */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="mb-4 font-display text-2xl font-bold sm:text-3xl">
              <span className="text-brand-violet">Combien coûte</span> un audit SEO ?
            </h2>
            <p className="citable-passage mb-10 max-w-3xl text-muted-foreground">
              Le tarif dépend de quatre facteurs : la taille du site, la profondeur de l'analyse,
              la mise en œuvre des correctifs et le niveau d'automatisation du prestataire.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {PRICE_FACTORS.map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparatif */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="mb-4 font-display text-2xl font-bold sm:text-3xl">
              Agence SEO vs <span className="text-brand-violet">passe Crawlers à 59 €</span>
            </h2>
            <p className="mb-10 max-w-3xl text-muted-foreground">
              À prestation comparable — audit, contenus, fiche Google Maps — voici les ordres de grandeur.
              Les montants agence sont des estimations : chaque prestataire établit son devis.
            </p>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/60">
                    <th className="px-5 py-3 font-semibold">Prestation</th>
                    <th className="px-5 py-3 font-semibold">Agence SEO</th>
                    <th className="px-5 py-3 font-semibold text-brand-violet">Crawlers</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 text-foreground">{row.label}</td>
                      <td className="px-5 py-3 text-muted-foreground">{row.agency}</td>
                      <td className="px-5 py-3 font-medium text-foreground">{row.crawlers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Ce que comprend la passe */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="mb-4 font-display text-2xl font-bold sm:text-3xl">
              Ce que comprend <span className="text-brand-violet">la passe à 59 €</span>
            </h2>
            <div className="mb-10 grid gap-4 sm:grid-cols-3">
              {INCLUDED.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <item.icon className="mb-4 h-6 w-6 text-brand-violet" />
                  <h3 className="mb-2 font-display font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-brand-violet" /> Sans abonnement</span>
              <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-brand-violet" /> Déployé en 72 h ouvrées</span>
              <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-brand-violet" /> Remboursé tant que rien n'est déployé</span>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="mb-10 font-display text-2xl font-bold sm:text-3xl">
              Questions fréquentes sur le <span className="text-brand-violet">prix d'un audit SEO</span>
            </h2>
            <div className="space-y-4">
              {FAQ_ITEMS.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <summary className="cursor-pointer list-none font-display font-semibold">
                    {q}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-20 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold sm:text-4xl">
              Commencez par l'audit <span className="text-brand-violet">gratuit</span>
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
              Vous saurez en quelques minutes ce qui bloque votre visibilité sur Google et dans les réponses IA.
              La passe à 59 € n'est proposée que si des correctifs sont utiles.
            </p>
            <Button asChild className="h-12 gap-2 border border-foreground bg-transparent px-8 text-foreground hover:bg-foreground hover:text-background">
              <Link to="/audit-geo-seo">
                Auditer mon site gratuitement
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-12">
<SiloNav
            silo="geo"
            currentPath="/prix-audit-seo"
            heading="Tout le silo visibilité IA"
            className="rounded-3xl bg-card"
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default memo(PrixAuditSeoComponent);
