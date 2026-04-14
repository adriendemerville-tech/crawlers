import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, ChevronRight, ExternalLink } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/contexts/LanguageContext';
import ReactMarkdown from 'react-markdown';

export interface GuideSection {
  h2: string;
  content: string; // Markdown content
  citablePassage?: string;
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
  source: string;
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
  heroImage?: string;
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

/** Markdown renderer with inline links rendered as styled React Router links */
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          if (!href) return <span>{children}</span>;
          const isExternal = href.startsWith('http');
          if (isExternal) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                {children}
              </a>
            );
          }
          return (
            <Link to={href} className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
              {children}
              <ArrowRight className="h-3.5 w-3.5 inline" />
            </Link>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="citable-passage border-l-4 border-primary/40 bg-primary/5 rounded-r-lg px-5 py-4 text-base text-foreground/90 leading-relaxed not-italic">
            {children}
          </blockquote>
        ),
        img: ({ src, alt }) => (
          <figure className="my-6">
            <img src={src} alt={alt || ''} className="rounded-xl w-full max-h-[400px] object-cover" loading="lazy" />
            {alt && <figcaption className="text-xs text-muted-foreground mt-2 text-center">{alt}</figcaption>}
          </figure>
        ),
        ul: ({ children }) => <ul className="space-y-1.5 list-disc pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="space-y-1.5 list-decimal pl-5">{children}</ol>,
        h3: ({ children }) => <h3 className="text-xl font-semibold text-foreground mt-6 mb-2">{children}</h3>,
        h4: ({ children }) => <h4 className="text-lg font-semibold text-foreground mt-4 mb-1">{children}</h4>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full text-sm border border-border/60 rounded-lg">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="px-3 py-2 bg-muted/50 text-left font-semibold border-b border-border/60">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 border-b border-border/30">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function GuideTemplateComponent({ guide }: GuideTemplateProps) {
  const { language } = useLanguage();
  const canonicalUrl = `https://crawlers.fr/guide/${guide.slug}`;

  const faqJsonLd = buildFaqJsonLd(guide.faqs);
  const speakableJsonLd = buildSpeakableJsonLd(guide.slug);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(guide.title, guide.slug);

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
        {guide.heroImage && <meta property="og:image" content={guide.heroImage} />}
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
        <header className="max-w-4xl mx-auto px-4 pt-8 pb-6 sm:pt-12 sm:pb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            {guide.title}
          </h1>
          <p className="guide-hero-subtitle mt-4 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-3xl">
            {guide.subtitle}
          </p>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <time dateTime={guide.updatedAt}>
              Mis à jour le {new Date(guide.updatedAt).toLocaleDateString(language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          </div>
        </header>

        {/* Hero Image */}
        {guide.heroImage && (
          <div className="max-w-4xl mx-auto px-4 pb-8">
            <img
              src={guide.heroImage}
              alt={guide.title}
              className="w-full rounded-xl max-h-[420px] object-cover"
              loading="eager"
            />
          </div>
        )}

        {/* Article content */}
        <article className="max-w-4xl mx-auto px-4 space-y-10 pb-12">
          {guide.sections.map((section, idx) => (
            <section key={idx} className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                {section.h2}
              </h2>
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <MarkdownContent content={section.content} />
              </div>

              {/* Citable passage */}
              {section.citablePassage && (
                <blockquote className="citable-passage border-l-4 border-primary/40 bg-primary/5 rounded-r-lg px-5 py-4 text-base text-foreground/90 italic leading-relaxed">
                  {section.citablePassage}
                </blockquote>
              )}

              {/* H3 subsections */}
              {section.h3s?.map((h3, h3idx) => (
                <div key={h3idx} className="ml-1 space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">{h3.title}</h3>
                  <div className="prose dark:prose-invert max-w-none">
                    <MarkdownContent content={h3.content} />
                  </div>
                </div>
              ))}
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
        </article>
      </main>
    </>
  );
}

export const GuideTemplate = memo(GuideTemplateComponent);
