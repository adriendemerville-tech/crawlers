import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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

        <Accordion type="single" collapsible className="space-y-3">
          {t.faq.items.map((item, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border border-border rounded-lg bg-card px-6 data-[state=open]:bg-card/80"
            >
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                <h3 className="text-base font-medium">{item.question}</h3>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
