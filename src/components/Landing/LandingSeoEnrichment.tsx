import { memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Users } from 'lucide-react';
import { LANDING_ENRICHMENT } from '@/data/landingSeoEnrichment';

interface Props {
  /** Path-style slug used as href in /features cards, ex: 'score-geo', 'app/site-crawl' */
  slug: string;
}

/**
 * Renders long-form SEO/GEO enriched content (H2/H3/H4 + persona + FAQ)
 * for landing pages linked from the /features page.
 *
 * Also injects:
 * - <meta name="keywords"> with Semrush-validated secondary keywords
 * - Article JSON-LD with headline = primaryKeyword
 * - FAQPage JSON-LD aggregating all FAQs
 *
 * Single insertion point per page — drop near the bottom, just before <Footer />.
 */
function LandingSeoEnrichmentInner({ slug }: Props) {
  const data = LANDING_ENRICHMENT[slug];
  if (!data) return null;

  const canonicalPath = slug.startsWith('app/') || slug.startsWith('features/') ? `/${slug}` : `/${slug}`;
  const fullUrl = `https://crawlers.fr${canonicalPath}`;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.primaryKeyword,
    keywords: [data.primaryKeyword, ...data.secondaryKeywords].join(', '),
    datePublished: data.datePublished || '2026-04-08',
    dateModified: '2026-05-25',
    author: { '@type': 'Person', name: 'Adrien de Volontat', url: 'https://crawlers.fr' },
    publisher: { '@type': 'Organization', name: 'Crawlers.fr', url: 'https://crawlers.fr' },
    mainEntityOfPage: fullUrl,
  };

  const faqJsonLd = data.faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null;

  return (
    <>
      <Helmet>
        <meta name="keywords" content={[data.primaryKeyword, ...data.secondaryKeywords].join(', ')} />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        {faqJsonLd && <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>}
      </Helmet>

      <section
        className="border-t border-border bg-background"
        aria-label="Contenu de référence SEO et GEO"
      >
        <div className="mx-auto max-w-4xl px-4 py-16 md:py-24">
          {/* Persona block */}
          <aside className="mb-12 rounded-xl border border-border bg-card/40 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-[hsl(var(--brand-violet,265_85%_60%))]" />
              <h2 className="text-lg font-bold text-foreground m-0">{data.persona.title}</h2>
            </div>
            <p className="text-sm text-foreground/80 mb-3">{data.persona.body}</p>
            <ul className="grid sm:grid-cols-2 gap-1.5 text-sm text-foreground/80 list-none p-0">
              {data.persona.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 before:content-['•'] before:text-[hsl(var(--brand-violet,265_85%_60%))] before:font-bold">
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </aside>

          {/* Long-form sections */}
          <div className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-li:text-foreground/80 prose-strong:text-foreground">
            {data.sections.map((section, si) => (
              <section key={si} className="mb-10">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{section.h2}</h2>
                {section.intro && <p className="text-base leading-relaxed mb-6">{section.intro}</p>}

                {section.h3s.map((h3, hi) => (
                  <article key={hi} className="mb-6">
                    <h3 className="text-xl font-semibold mt-6 mb-2">{h3.title}</h3>
                    <p className="text-base leading-relaxed">{h3.body}</p>
                    {h3.h4s && h3.h4s.length > 0 && (
                      <div className="mt-4 space-y-3 pl-4 border-l-2 border-border/60">
                        {h3.h4s.map((h4, fi) => (
                          <div key={fi}>
                            <h4 className="text-base font-semibold mt-3 mb-1">{h4.title}</h4>
                            <p className="text-sm leading-relaxed">{h4.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            ))}

            {/* FAQ */}
            {data.faqs.length > 0 && (
              <section className="mt-12 pt-10 border-t border-border">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Questions fréquentes</h2>
                <div className="space-y-5">
                  {data.faqs.map((f, i) => (
                    <details key={i} className="group rounded-lg border border-border bg-card/30 p-4">
                      <summary className="cursor-pointer font-semibold text-foreground list-none flex justify-between items-center">
                        <span>{f.q}</span>
                        <span className="text-foreground/50 group-open:rotate-45 transition-transform">+</span>
                      </summary>
                      <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export const LandingSeoEnrichment = memo(LandingSeoEnrichmentInner);
