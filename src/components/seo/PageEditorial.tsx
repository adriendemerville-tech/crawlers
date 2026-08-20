import { CitablePassage } from '@/components/seo/CitablePassage';
import { SeoFaqList, type SeoFaqItem } from '@/components/seo/SeoFaqList';

/**
 * Bloc éditorial de fin de page : définition citable, sections de fond et FAQ
 * rendues côté serveur. Sert à donner de la matière indexable aux pages
 * outils / landings qui n'en avaient pas assez.
 */
export interface EditorialSection {
  title: string;
  /** Paragraphes de la section. */
  paragraphs: string[];
  /** Liste à puces optionnelle. */
  bullets?: string[];
}

interface PageEditorialProps {
  heading: string;
  intro: string;
  citable: string;
  citableSource?: string;
  sections: EditorialSection[];
  faq?: SeoFaqItem[];
  faqHeading?: string;
}

export function PageEditorial({
  heading,
  intro,
  citable,
  citableSource = 'Crawlers.fr',
  sections,
  faq,
  faqHeading = 'Questions fréquentes',
}: PageEditorialProps) {
  return (
    <section className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{heading}</h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{intro}</p>

        <CitablePassage className="mt-6" source={citableSource}>
          {citable}
        </CitablePassage>

        {sections.map((section) => (
          <div key={section.title} className="mt-10">
            <h3 className="text-lg font-medium text-foreground">{section.title}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
            {section.bullets?.length ? (
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="border-l border-border pl-3">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        {faq?.length ? (
          <div className="mt-12">
            <h3 className="text-lg font-medium text-foreground">{faqHeading}</h3>
            <SeoFaqList className="mt-4" items={faq} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
