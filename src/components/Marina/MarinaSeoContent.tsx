import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { MARINA_FREE_QUOTA } from '@/lib/marinaFree.constants';


/**
 * Contenu éditorial rendu côté serveur sous le formulaire Marina.
 * Objectif : rendre /marina citable par les moteurs génératifs sur la requête
 * « audit SEO GEO gratuit » (bloc réponse citable + FAQ + chiffres factuels).
 */

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "L'audit Marina est-il vraiment gratuit ?",
    a: `Oui. Les ${MARINA_FREE_QUOTA} premiers rapports sont offerts, sans carte bancaire ni abonnement : une adresse e-mail suffit. Au-delà, un rapport coûte 5 crédits sur un compte Crawlers.`,
  },
  {
    q: 'Que contient le rapport ?',
    a: "40 pages et plus, une vingtaine de sous-audits : SEO technique (Core Web Vitals, robots.txt, sitemap, canonicals, JSON-LD, maillage interne, duplication et thin content), visibilité GEO (taux de citation mesuré dans les moteurs génératifs, compréhension machine, autorité perçue), E-E-A-T, cocoon sémantique, mots-clés positionnés et quick wins, puis un plan d'action priorisé par impact et effort.",
  },
  {
    q: 'Comment la visibilité dans les IA est-elle mesurée ?',
    a: "Marina envoie 9 questions réelles — 3 axes (découverte, comparaison, contexte) × 3 formulations rédigées à partir de la proposition de valeur du site — à ChatGPT, Gemini, Perplexity, Claude et Mistral, puis compte les citations obtenues. Ce n'est pas une estimation : c'est une mesure reproductible.",
  },
  {
    q: 'Combien de temps prend un audit ?',
    a: "Environ 3 à 5 minutes pour un site standard, jusqu'à 10 000 URLs explorées sur les grands sites. Le rapport est consultable en ligne et exportable en PDF.",
  },
  {
    q: 'En quoi est-ce différent de demander un audit à ChatGPT ou Claude ?',
    a: "Un LLM seul ne crawle pas votre site à l'échelle, n'a pas accès aux volumes de recherche ni aux positions SERP réelles, et ne peut pas interroger les autres moteurs pour mesurer votre taux de citation. Chaque donnée du rapport Marina est étiquetée Mesuré, Testé, Déduit ou Estimé pour que la source soit vérifiable.",
  },
  {
    q: 'Marina est-il disponible pour les professionnels ?',
    a: "Oui : l'audit est accessible en marque blanche pour les comptes Pro Agency, et automatisable via l'API REST Crawlers ainsi que via le serveur MCP (intégration directe dans un agent ou un IDE).",
  },
];

export function MarinaSeoContent() {
  return (
    <section className="py-16 border-t border-border" aria-labelledby="marina-audit-gratuit">
      <div className="mx-auto max-w-3xl px-4">
        <h2 id="marina-audit-gratuit" className="text-2xl sm:text-3xl font-bold text-foreground text-center">
          Audit SEO et GEO gratuit : ce que mesure Marina
        </h2>

        <blockquote className="citable-passage border-l-4 border-primary bg-muted/40 pl-4 py-3 my-6 text-base text-foreground italic">
          Marina est l'audit SEO et GEO gratuit de Crawlers.fr : {MARINA_FREE_QUOTA} rapports offerts sans carte
          bancaire, plus de 40 pages, une vingtaine de sous-audits et 9 questions réellement posées à ChatGPT,
          Gemini, Perplexity, Claude et Mistral pour mesurer le taux de citation du site dans les moteurs
          génératifs. Chaque donnée est étiquetée Mesuré, Testé, Déduit ou Estimé, et le rapport se termine par un
          plan d'action priorisé par impact et effort. Audit disponible sur https://crawlers.fr/marina.
        </blockquote>

        <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
          <p>
            La plupart des outils d'audit gratuits se limitent à une checklist technique : balises manquantes,
            vitesse, liens cassés. Marina ajoute la couche qui décide désormais de la visibilité — la manière dont
            les moteurs génératifs comprennent, citent ou ignorent un site. Le crawl explore le site (jusqu'à
            10 000 URLs), mesure le poids code/texte, les images sans attribut alt, la profondeur de clic, le
            maillage interne, la duplication proche et le contenu pauvre, puis détecte les coquilles JavaScript
            servies aux robots — un site dont le HTML est vide pour un crawler ne peut être cité par aucune IA.
          </p>
          <p>
            Vient ensuite le volet GEO. Marina décompose la visibilité générative en deux familles de sous-signaux :
            la <strong className="text-foreground">compréhension machine</strong> (structure des titres, données
            structurées, passages citables, clarté de la proposition de valeur) et
            l'<strong className="text-foreground">autorité perçue</strong> (mentions externes, avis, backlinks,
            signature d'auteur, cohérence de l'identité). L'écart entre les deux explique la plupart des absences
            de citation : un site parfaitement lisible mais sans autorité n'est pas repris, et inversement.
          </p>
          <p>
            Les données de marché proviennent de sources professionnelles : volumes de recherche, positions SERP
            réelles, profil de backlinks et Authority Score. Le rapport distingue explicitement les intentions déjà
            couvertes, les requêtes où le site est positionné et la demande non exploitée, puis nomme les clusters
            thématiques à construire. Les gains de trafic annoncés sont répartis par action, jamais recopiés d'une
            recommandation à l'autre.
          </p>
          <p>
            Le résultat est un document de 40 pages et plus, consultable en ligne, exportable en PDF et partageable
            par lien court. Les {MARINA_FREE_QUOTA} premiers rapports sont offerts. Pour aller plus loin,
            l'<Link to="/audit-seo-geo" className="text-primary underline">audit SEO GEO complet</Link>, l'
            <Link to="/audit-seo-gratuit" className="text-primary underline">audit SEO gratuit</Link> et
            l'<Link to="/analyse-site-web-gratuit" className="text-primary underline">analyse de site web</Link>
            {' '}détaillent la méthodologie, et l'

            <Link to="/etudes/autopilot-parmenion-iktracker" className="text-primary underline">étude de cas Iktracker</Link>
            {' '}montre les résultats sur un site réel.
          </p>
        </div>

      </div>

      <div className="mx-auto max-w-3xl px-4">
        <h3 className="text-xl font-bold text-foreground mt-14 mb-4">Questions fréquentes</h3>
        <dl className="space-y-5">
          {FAQ.map((item) => (
            <div key={item.q} className="border-b border-border pb-4">
              <dt className="font-semibold text-foreground">{item.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 text-center">
          <Button asChild variant="outline" size="lg">
            <a href="#marina-tabs">Lancer mon audit SEO GEO gratuit</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

export const MARINA_FAQ_ITEMS = FAQ;

export default MarinaSeoContent;
