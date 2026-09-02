import { ArrowRight } from 'lucide-react';
import { Link } from '@/lib/router-compat';

interface CompetitorMatrixCtaProps {
  /** Contexte optionnel pour adapter l'accroche */
  intro?: string;
  className?: string;
}

/**
 * CTA transverse vers la Matrice Concurrence.
 * Sans couleur de fond : bordure + texte, conforme au design system.
 */
export function CompetitorMatrixCta({ intro, className = '' }: CompetitorMatrixCtaProps) {
  return (
    <aside className={`my-10 rounded-xl border border-border p-6 md:p-8 ${className}`}>
      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
        Qui est cité à votre place ?
      </h2>
      <p className="text-muted-foreground leading-relaxed mb-5 max-w-2xl">
        {intro ??
          "La Matrice Concurrence croise vos concurrents et les 20 requêtes clés de votre marché, dans la SERP Google et dans les réponses des IA génératives. Vous voyez en une grille qui occupe le terrain, où vous êtes absent et quelles pages reprendre en priorité."}
      </p>
      <Link
        to="/matrice-concurrence"
        className="inline-flex items-center gap-2 rounded-md border border-foreground px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5"
      >
        Lancer la matrice concurrence (gratuit)
        <ArrowRight className="h-4 w-4" />
      </Link>
    </aside>
  );
}

export default CompetitorMatrixCta;
