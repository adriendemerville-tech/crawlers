import { createFileRoute } from '@tanstack/react-router';
import TrackChatGPTMentions2027 from '@/pages/TrackChatGPTMentions2027';
import { pageHead } from '@/lib/seo/pageHead';
import { buildArticleJsonLd, buildBreadcrumbJsonLd, buildFaqJsonLd } from '@/lib/seo/articleSchema';

const PATH = '/guides/suivre-mentions-marque-chatgpt-2027';
const TITLE = 'Comment suivre les mentions de votre marque sur ChatGPT en 2027';
const DESCRIPTION = 'Méthode complète pour suivre les mentions, citations et recommandations de votre marque dans ChatGPT en 2027, avec prompts, métriques et automatisation GEO.';
const FAQ = [
  {
    question: 'ChatGPT fournit-il les impressions de ma marque ?',
    answer: 'Non. OpenAI ne publie pas de Search Console donnant les impressions, le taux de clic ou la part de voix d’une marque dans ChatGPT. Il faut donc mesurer la présence de la marque avec un panel de requêtes répété dans le temps.',
  },
  {
    question: 'Combien de prompts faut-il suivre ?',
    answer: 'Un premier suivi exploitable peut commencer avec 20 à 50 prompts répartis entre découverte, comparaison et intention commerciale. Le panel doit rester stable pour comparer les évolutions, puis être enrichi séparément avec de nouveaux prompts.',
  },
  {
    question: 'Quelle différence entre une mention et une citation ?',
    answer: 'Une mention correspond au nom de la marque dans la réponse. Une citation ajoute une source ou un lien vers une page de l’entreprise ; elle constitue donc un signal plus fort de visibilité et de citabilité.',
  },
];

export const Route = createFileRoute('/guides/suivre-mentions-marque-chatgpt-2027')({
  head: () => pageHead({
    title: 'Suivre les mentions ChatGPT en 2027',
    description: DESCRIPTION,
    path: PATH,
    ogType: 'article',
    keywords: 'mentions marque ChatGPT, suivi visibilité IA, citations ChatGPT, GEO 2027',
    jsonLd: [
      buildArticleJsonLd({
        title: TITLE,
        description: DESCRIPTION,
        path: PATH,
        datePublished: '2026-09-02',
        dateModified: '2026-09-02',
        author: 'Adrien de Volontat',
        keywords: 'mentions marque ChatGPT, suivi visibilité IA, citations ChatGPT, GEO 2027',
        section: 'GEO et visibilité IA',
      }),
      buildBreadcrumbJsonLd([
        { name: 'Accueil', path: '/' },
        { name: 'Guides SEO & GEO', path: '/guides' },
        { name: TITLE, path: PATH },
      ]),
      buildFaqJsonLd(FAQ),
    ],
  }),
  component: TrackChatGPTMentions2027,
});
