import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Scale, ShieldCheck, Repeat } from 'lucide-react';

/**
 * Teaser accueil de la Place d'échange (L5). Contenu rendu côté serveur :
 * les faits énoncés proviennent des constantes de pricing, jamais d'une estimation.
 */
export function MarketplaceTeaserSection() {
  return (
    <section className="container mx-auto max-w-5xl px-4 py-16">
      <div className="mb-8 text-center">
        <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Place d’échange de backlinks : un prix calculé, pas négocié
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Cédez un emplacement de lien sur vos pages les moins stratégiques, achetez un lien là où
          votre déficit d’autorité est prouvé. Cinq paliers de 40 € à 350 €, attribut du lien imposé
          par le besoin réel, publication vérifiée dans le temps.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Scale,
            title: 'Cinq signaux mesurés',
            desc: 'Autorité, proximité sémantique, trafic de la page, qualité éditoriale, visibilité générative.',
          },
          {
            icon: ShieldCheck,
            title: 'Pages piliers protégées',
            desc: 'Un indice de risque de cession écarte automatiquement ce qui porte votre visibilité.',
          },
          {
            icon: Repeat,
            title: 'Troc en boucle',
            desc: 'Boucles à trois participants privilégiées ; l’échange réciproque direct est décoté.',
          },
        ].map((item) => (
          <Card key={item.title} className="border-border/60 bg-card/40 p-5">
            <item.icon className="mb-3 h-6 w-6 text-primary" />
            <h3 className="mb-1 font-bold">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.desc}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild variant="outline">
          <Link to="/marketplace-backlinks">
            Comprendre la place d’échange <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/console">Ouvrir mon inventaire</Link>
        </Button>
      </div>
    </section>
  );
}
