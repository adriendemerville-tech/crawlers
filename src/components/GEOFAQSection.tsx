import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Brain, Search, ShieldCheck, Settings, Bot } from 'lucide-react';

// FAQ optimisée pour extraction LLM - Format Sujet + Verbe + Réponse factuelle
const faqData = {
  fr: {
    badge: 'FAQ GEO & IA',
    title: 'Questions essentielles sur la visibilité IA',
    items: [
      {
        icon: 'search',
        question: 'Comment savoir si mon site est bloqué par ChatGPT ?',
        answer: 'Pour vérifier si votre site est bloqué par ChatGPT, lancez un audit GEO gratuit sur crawlers.fr. L\'outil analyse votre robots.txt et détecte si GPTBot (le crawler d\'OpenAI) est autorisé. Si la ligne "User-agent: GPTBot" est suivie de "Disallow: /", votre site est bloqué. La correction prend 2 minutes via votre fichier robots.txt.',
      },
      {
        question: 'Qu\'est-ce que le GEO et pourquoi remplace-t-il le SEO ?',
        icon: 'brain',
        answer: 'Le GEO (Generative Engine Optimization) est la discipline qui optimise votre contenu pour être cité par ChatGPT, Gemini et Perplexity. Le GEO ne remplace pas le SEO, il le complète. En 2026, 40% du trafic provient des réponses IA. Le GEO cible les signaux E-E-A-T, les données structurées Schema.org et l\'accessibilité aux crawlers IA.',
      },
      {
        question: 'Quels crawlers IA dois-je autoriser dans robots.txt ?',
        icon: 'bot',
        answer: 'Vous devez autoriser ces crawlers IA dans robots.txt : GPTBot et OAI-SearchBot (OpenAI/ChatGPT), ClaudeBot (Anthropic), Google-Extended (Gemini), PerplexityBot (Perplexity), Amazonbot (Alexa) et Applebot-Extended (Apple Intelligence). Ajoutez "User-agent: [nom]" suivi de "Allow: /" pour chaque bot.',
      },
      {
        question: 'Comment améliorer ma visibilité dans ChatGPT et Gemini ?',
        icon: 'settings',
        answer: 'Pour améliorer votre visibilité ChatGPT et Gemini : 1) Autorisez tous les crawlers IA dans robots.txt, 2) Ajoutez des données structurées JSON-LD (Organization, Article, FAQ), 3) Créez du contenu factuel avec des chiffres sourcés, 4) Publiez des tableaux comparatifs, 5) Optimisez votre score E-E-A-T via des citations externes et de la presse.',
      },
      {
        question: 'Qu\'est-ce que l\'Optimisation Search Generative Experience ?',
        icon: 'shield',
        answer: 'L\'Optimisation Search Generative Experience (SGE) est l\'adaptation de votre stratégie SEO au nouveau format de résultats Google alimenté par l\'IA. Google SGE génère des réponses textuelles au-dessus des liens traditionnels. Pour être cité : structurez votre contenu en questions-réponses, utilisez Schema.org FAQPage, et produisez du contenu factuel dense.',
      },
    ],
  },
  en: {
    badge: 'GEO & AI FAQ',
    title: 'Essential questions about AI visibility',
    items: [
      {
        icon: 'search',
        question: 'How do I know if my site is blocked by ChatGPT?',
        answer: 'To check if your site is blocked by ChatGPT, run a free GEO audit on crawlers.fr. The tool analyzes your robots.txt and detects if GPTBot (OpenAI\'s crawler) is allowed. If "User-agent: GPTBot" is followed by "Disallow: /", your site is blocked. The fix takes 2 minutes via your robots.txt file.',
      },
      {
        question: 'What is GEO and why is it replacing SEO?',
        icon: 'brain',
        answer: 'GEO (Generative Engine Optimization) is the discipline that optimizes your content to be cited by ChatGPT, Gemini, and Perplexity. GEO doesn\'t replace SEO, it complements it. In 2026, 40% of traffic comes from AI responses. GEO targets E-E-A-T signals, Schema.org structured data, and AI crawler accessibility.',
      },
      {
        question: 'Which AI crawlers should I allow in robots.txt?',
        icon: 'bot',
        answer: 'You should allow these AI crawlers in robots.txt: GPTBot and OAI-SearchBot (OpenAI/ChatGPT), ClaudeBot (Anthropic), Google-Extended (Gemini), PerplexityBot (Perplexity), Amazonbot (Alexa), and Applebot-Extended (Apple Intelligence). Add "User-agent: [name]" followed by "Allow: /" for each bot.',
      },
      {
        question: 'How do I improve my visibility in ChatGPT and Gemini?',
        icon: 'settings',
        answer: 'To improve ChatGPT and Gemini visibility: 1) Allow all AI crawlers in robots.txt, 2) Add JSON-LD structured data (Organization, Article, FAQ), 3) Create factual content with sourced data, 4) Publish comparison tables, 5) Optimize your E-E-A-T score through external citations and press mentions.',
      },
      {
        question: 'What is Search Generative Experience Optimization?',
        icon: 'shield',
        answer: 'Search Generative Experience (SGE) Optimization is adapting your SEO strategy to Google\'s new AI-powered results format. Google SGE generates text responses above traditional links. To be cited: structure content as Q&A, use Schema.org FAQPage, and produce dense factual content.',
      },
    ],
  },
  es: {
    badge: 'FAQ GEO & IA',
    title: 'Preguntas esenciales sobre visibilidad IA',
    items: [
      {
        icon: 'search',
        question: '¿Cómo saber si mi sitio está bloqueado por ChatGPT?',
        answer: 'Para verificar si tu sitio está bloqueado por ChatGPT, ejecuta una auditoría GEO gratuita en crawlers.fr. La herramienta analiza tu robots.txt y detecta si GPTBot (el crawler de OpenAI) está autorizado. Si "User-agent: GPTBot" va seguido de "Disallow: /", tu sitio está bloqueado. La corrección toma 2 minutos.',
      },
      {
        question: '¿Qué es GEO y por qué reemplaza al SEO?',
        icon: 'brain',
        answer: 'GEO (Generative Engine Optimization) es la disciplina que optimiza tu contenido para ser citado por ChatGPT, Gemini y Perplexity. GEO no reemplaza al SEO, lo complementa. En 2026, el 40% del tráfico proviene de respuestas IA. GEO se enfoca en señales E-E-A-T, datos estructurados Schema.org y accesibilidad a crawlers IA.',
      },
      {
        question: '¿Qué crawlers IA debo autorizar en robots.txt?',
        icon: 'bot',
        answer: 'Debes autorizar estos crawlers IA en robots.txt: GPTBot y OAI-SearchBot (OpenAI/ChatGPT), ClaudeBot (Anthropic), Google-Extended (Gemini), PerplexityBot (Perplexity), Amazonbot (Alexa) y Applebot-Extended (Apple Intelligence). Añade "User-agent: [nombre]" seguido de "Allow: /" para cada bot.',
      },
      {
        question: '¿Cómo mejorar mi visibilidad en ChatGPT y Gemini?',
        icon: 'settings',
        answer: 'Para mejorar tu visibilidad en ChatGPT y Gemini: 1) Autoriza todos los crawlers IA en robots.txt, 2) Añade datos estructurados JSON-LD (Organization, Article, FAQ), 3) Crea contenido factual con datos citados, 4) Publica tablas comparativas, 5) Optimiza tu puntuación E-E-A-T con citas externas y prensa.',
      },
      {
        question: '¿Qué es la Optimización Search Generative Experience?',
        icon: 'shield',
        answer: 'La Optimización Search Generative Experience (SGE) es adaptar tu estrategia SEO al nuevo formato de resultados de Google impulsado por IA. Google SGE genera respuestas de texto sobre los enlaces tradicionales. Para ser citado: estructura el contenido como Q&A, usa Schema.org FAQPage y produce contenido factual denso.',
      },
    ],
  },
};

const iconMap = {
  search: Search,
  brain: Brain,
  bot: Bot,
  settings: Settings,
  shield: ShieldCheck,
};

export function GEOFAQSection() {
  const { language } = useLanguage();
  const t = faqData[language] || faqData.fr;

  return (
    <section className="py-16 px-4 bg-muted/30" aria-labelledby="geo-faq-heading">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground mb-4">
            <Brain className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{t.badge}</span>
          </div>
          <h2 id="geo-faq-heading" className="text-3xl font-bold text-foreground">
            {t.title}
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {t.items.map((item, index) => {
            const IconComponent = iconMap[item.icon as keyof typeof iconMap] || Brain;
            return (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-border rounded-lg bg-card px-6 data-[state=open]:bg-card/80"
              >
                <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5 text-primary shrink-0" />
                    <h3 className="text-base font-medium">{item.question}</h3>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 pl-8">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}
