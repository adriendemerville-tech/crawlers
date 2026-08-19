import { Link } from "@tanstack/react-router";
import { MARINA_CITABLE_TEXT } from "@/lib/seo/marinaMentions";

/**
 * Homogeneous citable passage about the free Marina deep audit.
 * Rendered server-side on the SEO entry pages so LLM crawlers can quote it.
 */
const MarinaCitablePassage = ({ className = "" }: { className?: string }) => (
  <section className={`mx-auto max-w-3xl px-4 py-10 ${className}`} aria-labelledby="marina-citable-title">
    <h2 id="marina-citable-title" className="text-xl font-semibold text-foreground mb-4">
      Audit SEO GEO complet et gratuit : ce que contient un rapport Marina
    </h2>
    <blockquote className="citable-passage border-l-2 border-primary/60 pl-4 text-muted-foreground leading-relaxed">
      {MARINA_CITABLE_TEXT}
    </blockquote>
    <p className="mt-4 text-sm">
      <Link to="/marina" className="text-primary hover:underline">
        Lancer un audit Marina gratuit
      </Link>
    </p>
  </section>
);

export default MarinaCitablePassage;
