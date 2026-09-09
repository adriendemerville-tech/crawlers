import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Wrench } from 'lucide-react';
import { Link } from '@/lib/router-compat';

interface ParmenionCtaProps {
  className?: string;
  intro?: string;
  /** Adresse déjà auditée : Parmenion reprend l'audit au lieu de le refaire. */
  url?: string;
}

function ParmenionCtaComponent({ className = '', intro, url }: ParmenionCtaProps): React.ReactElement {
  return (
    <Card className={`border border-border bg-card ${className}`}>
      <CardContent className="p-6">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Wrench className="h-5 w-5" />
          <span className="text-sm font-medium">Correctifs appliqués</span>
        </div>
        <h3 className="mb-2 text-lg font-semibold">Passez à l'action avec Parmenion</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {intro ||
            "Votre audit identifie les points à corriger. Laissez-nous appliquer les correctifs, rédiger 3 pages et optimiser votre fiche Google Maps — une seule fois, à prix fixe."}
        </p>
        <Button
          asChild
          className="h-11 gap-2 border border-foreground bg-transparent px-5 text-foreground hover:bg-foreground hover:text-background"
        >
          <Link to={url ? `/audit-geo-seo?url=${encodeURIComponent(url)}&from=marina` : '/audit-geo-seo'}>
            {url ? 'Corriger avec Parmenion — 59 € TTC' : 'Découvrir la passe à 59 € TTC'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default memo(ParmenionCtaComponent);
