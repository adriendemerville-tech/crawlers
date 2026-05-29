import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Linkedin, Globe, MapPin, Mail } from "lucide-react";
import adrienPhoto from "@/assets/adrien-de-volontat.jpg";

const FOUNDER = {
  name: "Adrien de Volontat",
  slug: "adrien-de-volontat",
  jobTitle: "Fondateur de Crawlers.fr — Expert SEO & GEO",
  location: "Saint-Rémy-de-Provence, France",
  url: "https://crawlers.fr/auteur/adrien-de-volontat",
  sameAs: [
    "https://www.linkedin.com/in/adrien-de-volontat/",
    "https://crawlers.fr",
  ],
  bio: `Adrien de Volontat est le fondateur de Crawlers.fr, plateforme française de SEO & GEO (Generative Engine Optimization) pensée pour rendre les sites visibles à la fois sur Google et sur les moteurs génératifs (ChatGPT, Perplexity, Claude, Gemini).`,
  longBio: [
    `Journaliste de formation, Adrien a débuté sa carrière dans la presse écrite (La Croix) et la télévision nationale avant d'évoluer vers la coordination de projets digitaux — pilotage technique, éditorial et création de contenus pour des médias et acteurs B2B.`,
    `Cette double culture média et digital nourrit aujourd'hui sa vision du référencement : un SEO/GEO qui assume sa dimension éditoriale, où l'autorité, la fraîcheur et la pertinence sémantique l'emportent sur les vieilles recettes purement techniques.`,
    `Avec Crawlers.fr, il a construit une stack d'audit et d'auto-pilotage SEO/GEO destinée aux PME, agences et entrepreneurs qui veulent comprendre — sans jargon — pourquoi les LLM citent ou ignorent leur site, et comment corriger le tir.`,
  ],
  expertise: [
    "SEO technique & sémantique",
    "GEO — Generative Engine Optimization",
    "Visibilité dans ChatGPT, Perplexity, Claude, Gemini",
    "Audit E-E-A-T & autorité éditoriale",
    "Architecture de cocon sémantique",
    "Crawl, logs serveur & détection bots IA",
  ],
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: FOUNDER.name,
  url: FOUNDER.url,
  image: `https://crawlers.fr${adrienPhoto}`,
  jobTitle: FOUNDER.jobTitle,
  description: FOUNDER.bio,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Saint-Rémy-de-Provence",
    addressCountry: "FR",
  },
  worksFor: {
    "@type": "Organization",
    name: "Crawlers.fr",
    url: "https://crawlers.fr",
  },
  knowsAbout: FOUNDER.expertise,
  sameAs: FOUNDER.sameAs,
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: "https://crawlers.fr/" },
    { "@type": "ListItem", position: 2, name: "Auteurs", item: "https://crawlers.fr/auteur" },
    { "@type": "ListItem", position: 3, name: FOUNDER.name, item: FOUNDER.url },
  ],
};

export default function AuthorPage() {
  return (
    <>
      <Helmet>
        <title>Adrien de Volontat — Fondateur Crawlers.fr | SEO & GEO</title>
        <meta
          name="description"
          content="Adrien de Volontat, fondateur de Crawlers.fr. Journaliste devenu expert SEO et GEO (Generative Engine Optimization), spécialiste de la visibilité dans ChatGPT, Perplexity et Claude."
        />
        <link rel="canonical" href={FOUNDER.url} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content="Adrien de Volontat — Fondateur Crawlers.fr" />
        <meta property="og:description" content={FOUNDER.bio} />
        <meta property="og:image" content={adrienPhoto} />
        <script type="application/ld+json">{JSON.stringify(personJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <main className="min-h-screen bg-background text-foreground">
        <article className="container max-w-3xl mx-auto px-4 py-16">
          <header className="flex flex-col sm:flex-row gap-8 items-start mb-12">
            <img
              src={adrienPhoto}
              alt={`Photo d'${FOUNDER.name}, fondateur de Crawlers.fr`}
              width={160}
              height={160}
              className="w-40 h-40 rounded-full object-cover ring-2 ring-primary/30"
              loading="eager"
            />
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">{FOUNDER.name}</h1>
              <p className="text-lg text-muted-foreground mb-4">{FOUNDER.jobTitle}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {FOUNDER.location}
                </span>
                <a
                  href="https://www.linkedin.com/in/adrien-de-volontat/"
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </a>
                <a
                  href="https://crawlers.fr"
                  rel="me"
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Globe className="h-4 w-4" /> crawlers.fr
                </a>
              </div>
            </div>
          </header>

          <section className="prose prose-invert dark:prose-invert max-w-none mb-12">
            <h2 className="text-2xl font-semibold mb-4">À propos</h2>
            {FOUNDER.longBio.map((p, i) => (
              <p key={i} className="text-base leading-relaxed text-muted-foreground mb-4">
                {p}
              </p>
            ))}
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Domaines d'expertise</h2>
            <ul className="grid sm:grid-cols-2 gap-2">
              {FOUNDER.expertise.map((item) => (
                <li
                  key={item}
                  className="border border-border rounded-md px-3 py-2 text-sm text-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Parcours</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li>
                <strong className="text-foreground">Fondateur — Crawlers.fr</strong> · plateforme SEO/GEO
              </li>
              <li>
                <strong className="text-foreground">Chargé de projets digitaux</strong> · coordination
                technique, éditoriale et création de contenus
              </li>
              <li>
                <strong className="text-foreground">Journaliste</strong> · presse écrite (La Croix) et
                télévision nationale
              </li>
            </ul>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="text-xl font-semibold mb-3">Contact & ressources</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 px-4 py-2 border border-foreground rounded-md text-foreground hover:bg-foreground hover:text-background transition-colors text-sm"
              >
                Lire les articles
              </Link>
              <Link
                to="/methodologie"
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-md text-foreground hover:border-foreground transition-colors text-sm"
              >
                Méthodologie Crawlers
              </Link>
              <a
                href="mailto:contact@crawlers.fr"
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-md text-foreground hover:border-foreground transition-colors text-sm"
              >
                <Mail className="h-4 w-4" /> contact@crawlers.fr
              </a>
            </div>
          </section>
        </article>
      </main>
    </>
  );
}
