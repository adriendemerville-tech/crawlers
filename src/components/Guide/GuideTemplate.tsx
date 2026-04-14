import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronRight, ExternalLink } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/contexts/LanguageContext';

export interface GuideSection {
  h2: string;
  content: string; // Markdown-like HTML
  citablePassage?: string; // 40-80 words standalone passage for GEO
  h3s?: { title: string; content: string }[];
  cta?: { label: string; href: string };
  howToSteps?: { name: string; text: string }[];
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideExternalLink {
  label: string;
  href: string;
  source: string; // e.g. "Google Search Central"
}

export interface GuideLateralLink {
  slug: string;
  title: string;
  description: string;
}

export interface GuideData {
  slug: string;
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  targetKeyword: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  publishedAt: string;
  updatedAt: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
  externalLinks: GuideExternalLink[];
  lateralLinks: GuideLateralLink[];
  tools: { name: string; href: string; description: string }[];
  category: 'bloc_a' | 'bloc_b';
}

interface GuideTemplateProps {
  guide: GuideData;
}

function buildFaqJsonLd(faqs: GuideFaq[]) {
  if (faqs.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

function buildHowToJsonLd(section: GuideSection, guideTitle: string) {
  if (!section.howToSteps?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: section.h2,
    description: `Étapes extraites du guide : ${guideTitle}`,
    step: section.howToSteps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

function buildSpeakableJsonLd(slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: slug,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.citable-passage', '.guide-hero-subtitle'],
    },
  };
}

function buildBreadcrumbJsonLd(title: string, slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://crawlers.fr/' },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: 'https://crawlers.fr/guides' },
      { '@type': 'ListItem', position: 3, name: title, item: `https://crawlers.fr/guide/${slug}` },
    ],
  };
}

function GuideTemplateComponent({ guide }: GuideTemplateProps) {
  const { language } = useLanguage();
  const canonicalUrl = `https://crawlers.fr/guide/${guide.slug}`;

  const faqJsonLd = buildFaqJsonLd(guide.faqs);
  const speakableJsonLd = buildSpeakableJsonLd(guide.slug);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(guide.title, guide.slug);

  // Collect all HowTo schemas from sections
  const howToSchemas = guide.sections
    .map(s => buildHowToJsonLd(s, guide.title))
    .filter(Boolean);

  return (
    <>
      <Helmet>
        <title>{guide.metaTitle}</title>
        <meta name="description" content={guide.metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={guide.metaTitle} />
        <meta property="og:description" content={guide.metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Crawlers" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={guide.metaTitle} />
        <meta name="twitter:description" content={guide.metaDescription} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(speakableJsonLd)}</script>
        {faqJsonLd && <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>}
        {howToSchemas.map((schema, i) => (
          <script key={`howto-${i}`} type="application/ld+json">{JSON.stringify(schema)}</script>
        ))}
      </Helmet>

      <main className="min-h-screen bg-background">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="max-w-4xl mx-auto px-4 pt-6 sm:pt-8">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li><Link to="/" className="hover:text-foreground transition-colors">Accueil</Link></li>
            <ChevronRight className="h-3 w-3" />
            <li><Link to="/guides" className="hover:text-foreground transition-colors">Guides</Link></li>
            <ChevronRight className="h-3 w-3" />
            <li className="text-foreground font-medium truncate max-w-[200px]">{guide.title}</li>
          </ol>
        </nav>

        {/* Hero */}
        <header className="max-w-4xl mx-auto px-4 pt-8 pb-10 sm:pt-12 sm:pb-14">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            {guide.title}
          </h1>
          <p className="guide-hero-subtitle mt-4 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-3xl">
            {guide.subtitle}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={guide.heroCtaHref}>
              <Button variant="hero" size="lg" className="gap-2">
                {guide.heroCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <time dateTime={guide.updatedAt} className="text-xs text-muted-foreground">
              Mis à jour le {new Date(guide.updatedAt).toLocaleDateString(language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          </div>
        </header>

        {/* Sections */}
        <article className="max-w-4xl mx-auto px-4 space-y-12 pb-12">
          {guide.sections.map((section, idx) => (
            <section key={idx} className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                {section.h2}
              </h2>
              <div
                className="prose prose-lg dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: section.content }}
              />

              {/* Citable passage for GEO */}
              {section.citablePassage && (
                <blockquote className="citable-passage border-l-4 border-primary/40 bg-primary/5 rounded-r-lg px-5 py-4 text-base text-foreground/90 italic not-italic leading-relaxed">
                  {section.citablePassage}
                </blockquote>
              )}

              {/* H3 subsections */}
              {section.h3s?.map((h3, h3idx) => (
                <div key={h3idx} className="ml-1 space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">{h3.title}</h3>
                  <div
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: h3.content }}
                  />
                </div>
              ))}

              {/* Section CTA */}
              {section.cta && (
                <div className="pt-2">
                  <Link to={section.cta.href}>
                    <Button variant="default" size="lg" className="gap-2">
                      {section.cta.label}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </section>
          ))}

          {/* FAQ */}
          {guide.faqs.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Questions fréquentes
              </h2>
              <Accordion type="multiple" className="w-full">
                {guide.faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left text-base font-medium">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}

          {/* External authority links */}
          {guide.externalLinks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">Sources & références</h2>
              <ul className="space-y-2">
                {guide.externalLinks.map((link, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ExternalLink className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {link.label}
                      </a>
                      <span className="text-muted-foreground"> — {link.source}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Tools featured */}
          {guide.tools.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Outils Crawlers recommandés</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {guide.tools.map((tool, i) => (
                  <Link
                    key={i}
                    to={tool.href}
                    className="group flex flex-col gap-1 rounded-xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {tool.name}
                    </span>
                    <span className="text-sm text-muted-foreground">{tool.description}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Lateral links (maillage) */}
          {guide.lateralLinks.length > 0 && (
            <section className="space-y-4 border-t border-border/60 pt-8">
              <h2 className="text-xl font-semibold text-foreground">Guides connexes</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {guide.lateralLinks.map((link, i) => (
                  <Link
                    key={i}
                    to={`/guide/${link.slug}`}
                    className="group flex flex-col gap-1 rounded-xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {link.title}
                    </span>
                    <span className="text-sm text-muted-foreground">{link.description}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Final CTA */}
          <section className="flex flex-col items-center gap-4 py-8 border-t border-border/60">
            <h2 className="text-2xl font-bold text-center text-foreground">
              Prêt à améliorer votre visibilité ?
            </h2>
            <Link to={guide.heroCtaHref}>
              <Button variant="hero" size="xl" className="gap-2 text-lg">
                {guide.heroCtaLabel}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </section>
        </article>
      </main>
    </>
  );
}

export const GuideTemplate = memo(GuideTemplateComponent);
