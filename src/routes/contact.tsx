import { createFileRoute } from "@tanstack/react-router";
import Contact from "@/pages/Contact";
import { pageHead, SITE_URL } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/contact")({
  head: () => pageHead({
    title: "Contact Crawlers — support, facturation, RGPD",
    description: "Contacter Crawlers : adresse officielle contact@crawlers.fr, identité de l'éditeur (SIRET), délais de réponse, exercice des droits RGPD et signalement de sécurité.",
    path: "/contact",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contacter Crawlers",
        url: `${SITE_URL}/contact`,
        about: {
          "@type": "Organization",
          name: "Crawlers",
          url: SITE_URL,
          email: "contact@crawlers.fr",
          founder: { "@type": "Person", name: "Adrien de Volontat" },
          identifier: "SIRET 992 399 667 00011",
          areaServed: "FR",
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "contact@crawlers.fr",
              availableLanguage: ["fr", "en"],
            },
          ],
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Contact", item: `${SITE_URL}/contact` },
        ],
      },
    ],
  }),
  component: Contact,
});
