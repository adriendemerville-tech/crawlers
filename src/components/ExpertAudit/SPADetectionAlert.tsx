import { AlertTriangle, ChevronDown } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: {
    title: 'Structure de site détectée : SPA',
    subtitle: 'Note importante : Détection d\'une structure "Single Page Application" (SPA)',
    intro: 'Votre site utilise une technologie moderne dite "SPA". Si elle offre une navigation fluide pour vos visiteurs, elle crée un défi majeur pour les robots de recherche : au premier regard, votre site ressemble à une page blanche.',
    consequencesTitle: 'Conséquences :',
    seo: 'Google doit faire un effort supplémentaire pour "lire" votre contenu, ce qui ralentit considérablement votre indexation.',
    geo: 'Les intelligences artificielles (ChatGPT, Perplexity, Claude) préfèrent le contenu instantané. Une structure SPA peut les empêcher de citer votre site comme source de réponse.',
    audit: 'Nos outils analysent ce que les robots voient réellement. C\'est pourquoi certains scores de texte ou mots-clés peuvent apparaître comme "non détectés" malgré leur présence visuelle.',
    solutionTitle: 'Solution préconisée :',
    solution: 'Nous recommandons la mise en place d\'une solution de "chargement statique partiel" (Pre-rendering). Cela permet de livrer votre contenu instantanément aux robots tout en gardant le confort de navigation pour vos clients.',
    seoLabel: 'SEO',
    geoLabel: 'GEO (IA)',
    auditLabel: 'Audit Crawlers.fr',
  },
  en: {
    title: 'Site structure detected: SPA',
    subtitle: 'Important note: "Single Page Application" (SPA) structure detected',
    intro: 'Your site uses a modern technology called "SPA". While it offers smooth navigation for your visitors, it creates a major challenge for search robots: at first glance, your site looks like a blank page.',
    consequencesTitle: 'Consequences:',
    seo: 'Google must make an extra effort to "read" your content, which significantly slows down your indexing.',
    geo: 'AIs (ChatGPT, Perplexity, Claude) prefer instant content. An SPA structure can prevent them from citing your site as a source.',
    audit: 'Our tools analyze what robots actually see. This is why some text or keyword scores may appear as "not detected" despite being visually present.',
    solutionTitle: 'Recommended solution:',
    solution: 'We recommend implementing a "partial static loading" (Pre-rendering) solution. This delivers your content instantly to robots while keeping smooth navigation for your users.',
    seoLabel: 'SEO',
    geoLabel: 'GEO (AI)',
    auditLabel: 'Crawlers.fr Audit',
  },
  es: {
    title: 'Estructura del sitio detectada: SPA',
    subtitle: 'Nota importante: Estructura "Single Page Application" (SPA) detectada',
    intro: 'Su sitio utiliza una tecnología moderna llamada "SPA". Aunque ofrece una navegación fluida para sus visitantes, crea un desafío importante para los robots de búsqueda: a primera vista, su sitio parece una página en blanco.',
    consequencesTitle: 'Consecuencias:',
    seo: 'Google debe hacer un esfuerzo adicional para "leer" su contenido, lo que ralentiza considerablemente su indexación.',
    geo: 'Las inteligencias artificiales (ChatGPT, Perplexity, Claude) prefieren contenido instantáneo. Una estructura SPA puede impedirles citar su sitio como fuente.',
    audit: 'Nuestras herramientas analizan lo que los robots realmente ven. Por eso, algunas puntuaciones de texto o palabras clave pueden aparecer como "no detectadas" a pesar de estar visualmente presentes.',
    solutionTitle: 'Solución recomendada:',
    solution: 'Recomendamos implementar una solución de "carga estática parcial" (Pre-rendering). Esto entrega su contenido instantáneamente a los robots manteniendo la navegación fluida para sus usuarios.',
    seoLabel: 'SEO',
    geoLabel: 'GEO (IA)',
    auditLabel: 'Auditoría Crawlers.fr',
  },
};

export function SPADetectionAlert() {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  return (
    <Alert className="border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-500/30">
      <AlertTriangle className="h-5 w-5 text-orange-500" />
      <AlertTitle className="text-orange-700 dark:text-orange-400 font-semibold text-base ml-2">
        {t.title}
      </AlertTitle>
      <div className="ml-2 mt-2">
        <Accordion type="single" collapsible>
          <AccordionItem value="spa-details" className="border-orange-300/40 dark:border-orange-600/30">
            <AccordionTrigger className="text-sm text-orange-600 dark:text-orange-400 hover:no-underline py-2">
              {t.subtitle}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>{t.intro}</p>

                <div>
                  <p className="font-semibold text-foreground mb-2">{t.consequencesTitle}</p>
                  <ul className="space-y-2 pl-1">
                    <li className="flex gap-2">
                      <span className="font-semibold text-orange-600 dark:text-orange-400 shrink-0">{t.seoLabel} :</span>
                      <span>{t.seo}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-orange-600 dark:text-orange-400 shrink-0">{t.geoLabel} :</span>
                      <span>{t.geo}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-orange-600 dark:text-orange-400 shrink-0">{t.auditLabel} :</span>
                      <span>{t.audit}</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-orange-100/60 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200/50 dark:border-orange-700/30">
                  <p className="font-semibold text-foreground mb-1">{t.solutionTitle}</p>
                  <p>{t.solution}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Alert>
  );
}
