import { createFileRoute } from "@tanstack/react-router";
import MatriceConcurrence, { MATRIX_FAQS } from "@/pages/MatriceConcurrence";
import { pageHead } from "@/lib/seo/pageHead";
import { ORGANIZATION_REF } from "@/lib/seo/organization";

const TITLE = "Matrice de concurrence gratuite — mots-clés Google et citations IA | Crawlers.fr";
const DESC =
  "Qui capte vos mots-clés dans Google et dans les IA ? La matrice croise vos concurrents métier, de visibilité et silencieux avec 20 requêtes du marché, AI Overviews inclus.";

export const Route = createFileRoute("/matrice-concurrence")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESC,
      path: "/matrice-concurrence",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Crawlers.fr — Matrice de concurrence",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web Browser",
          url: "https://crawlers.fr/matrice-concurrence",
          publisher: ORGANIZATION_REF,
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: "https://crawlers.fr/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Matrice de concurrence",
              item: "https://crawlers.fr/matrice-concurrence",
            },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: MATRIX_FAQS.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: { "@type": "Answer", text: faq.a },
          })),
        },
      ],
    }),
  component: MatriceConcurrence,
});
