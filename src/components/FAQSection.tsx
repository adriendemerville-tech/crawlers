import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { HelpCircle } from 'lucide-react';

export function FAQSection() {
  const { t } = useLanguage();

  return (
    <section className="py-16 px-4" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground mb-4">
            <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{t.faq.badge}</span>
          </div>
          <h2 id="faq-heading" className="text-2xl md:text-3xl font-bold text-foreground whitespace-nowrap">
            {t.faq.title}
          </h2>
        </div>

        {/* <details> plutôt qu'un accordéon monté à l'ouverture : la réponse
            reste dans le HTML servi, donc indexable et citable par les LLM. */}
        <div className="space-y-3">
          {t.faq.items.map((item, index) => (
            <details
              key={index}
              open={index === 0}
              className="group rounded-lg border border-border bg-card px-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 marker:content-none">
                <h3 className="text-base font-medium text-foreground">{item.question}</h3>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="pb-4 text-muted-foreground">{item.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
