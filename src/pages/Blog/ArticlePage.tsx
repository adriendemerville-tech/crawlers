import { memo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ArticleLayout, SummaryBox, RichLink } from '@/components/Blog';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleBySlug } from '@/data/blogArticles';

// Contenu des articles - à enrichir avec le contenu réel
const articleContent: Record<string, { fr: JSX.Element; en: JSX.Element; es: JSX.Element }> = {
  'seo-vs-geo-differences': {
    fr: (
      <>
        <SummaryBox
          points={[
            'Les différences techniques entre SEO et GEO',
            'Comment les moteurs IA citent les sources',
            'Les stratégies pour optimiser les deux',
          ]}
        />

        <p>
          Le paysage du référencement web évolue rapidement avec l'émergence des moteurs de recherche
          génératifs. En 2025, comprendre la différence entre SEO et GEO est devenu essentiel pour
          toute stratégie de visibilité digitale.
        </p>

        <h2>Qu'est-ce que le SEO traditionnel ?</h2>
        <p>
          Le SEO (Search Engine Optimization) reste la discipline fondamentale pour apparaître dans
          les résultats de recherche de Google, Bing et autres moteurs traditionnels. Il repose sur
          trois piliers : le contenu, la technique et la popularité (backlinks).
        </p>

        <h2>L'émergence du GEO</h2>
        <p>
          Le GEO (Generative Engine Optimization) est une nouvelle discipline qui vise à optimiser
          la visibilité de votre contenu auprès des moteurs IA comme ChatGPT, Perplexity, Claude
          ou Google SGE. Contrairement au SEO, le GEO se concentre sur la "citabilité" de votre
          contenu.
        </p>

        <RichLink
          href="/audit-expert"
          title="Lancer un audit IA gratuit"
          description="Analysez votre visibilité SEO et GEO en quelques minutes"
        />

        <h2>Les différences clés</h2>
        <p>
          <strong>Format de présentation :</strong> En SEO, vous visez une position dans les 10
          premiers résultats. En GEO, vous visez à être cité dans une réponse générée.
        </p>
        <p>
          <strong>Signaux de confiance :</strong> Le SEO valorise les backlinks. Le GEO valorise
          les données structurées (Schema.org) et la cohérence des informations.
        </p>
        <p>
          <strong>Mesure du succès :</strong> Le SEO mesure les positions et le trafic organique.
          Le GEO mesure les citations et mentions dans les réponses IA.
        </p>

        <h2>Comment optimiser pour les deux ?</h2>
        <p>
          Une stratégie gagnante en 2025 combine SEO et GEO. Cela implique de créer du contenu
          de qualité, structuré avec des données JSON-LD, et de maintenir une cohérence
          d'information à travers le web.
        </p>

        <blockquote>
          "En 2025, 40% des recherches web passeront par des interfaces conversationnelles.
          Ignorer le GEO, c'est ignorer près de la moitié de votre audience potentielle."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            'Technical differences between SEO and GEO',
            'How AI engines cite sources',
            'Strategies to optimize for both',
          ]}
        />

        <p>
          The web optimization landscape is rapidly evolving with the emergence of generative
          search engines. In 2025, understanding the difference between SEO and GEO has become
          essential for any digital visibility strategy.
        </p>

        <h2>What is traditional SEO?</h2>
        <p>
          SEO (Search Engine Optimization) remains the fundamental discipline for appearing in
          search results on Google, Bing and other traditional engines. It's based on three
          pillars: content, technical optimization, and popularity (backlinks).
        </p>

        <h2>The emergence of GEO</h2>
        <p>
          GEO (Generative Engine Optimization) is a new discipline that aims to optimize your
          content's visibility with AI engines like ChatGPT, Perplexity, Claude or Google SGE.
          Unlike SEO, GEO focuses on the "citability" of your content.
        </p>

        <RichLink
          href="/audit-expert"
          title="Launch a free AI audit"
          description="Analyze your SEO and GEO visibility in minutes"
        />

        <h2>Key differences</h2>
        <p>
          <strong>Presentation format:</strong> In SEO, you aim for a position in the top 10
          results. In GEO, you aim to be cited in a generated response.
        </p>
        <p>
          <strong>Trust signals:</strong> SEO values backlinks. GEO values structured data
          (Schema.org) and information consistency.
        </p>
        <p>
          <strong>Success measurement:</strong> SEO measures rankings and organic traffic.
          GEO measures citations and mentions in AI responses.
        </p>

        <h2>How to optimize for both?</h2>
        <p>
          A winning strategy in 2025 combines SEO and GEO. This involves creating quality
          content, structured with JSON-LD data, and maintaining information consistency
          across the web.
        </p>

        <blockquote>
          "In 2025, 40% of web searches will go through conversational interfaces.
          Ignoring GEO means ignoring nearly half of your potential audience."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            'Diferencias técnicas entre SEO y GEO',
            'Cómo los motores IA citan las fuentes',
            'Estrategias para optimizar ambos',
          ]}
        />

        <p>
          El panorama de la optimización web está evolucionando rápidamente con la aparición de
          los motores de búsqueda generativos. En 2025, comprender la diferencia entre SEO y GEO
          se ha vuelto esencial para cualquier estrategia de visibilidad digital.
        </p>

        <h2>¿Qué es el SEO tradicional?</h2>
        <p>
          El SEO (Search Engine Optimization) sigue siendo la disciplina fundamental para aparecer
          en los resultados de búsqueda de Google, Bing y otros motores tradicionales. Se basa en
          tres pilares: contenido, optimización técnica y popularidad (backlinks).
        </p>

        <h2>La emergencia del GEO</h2>
        <p>
          El GEO (Generative Engine Optimization) es una nueva disciplina que busca optimizar la
          visibilidad de tu contenido en motores IA como ChatGPT, Perplexity, Claude o Google SGE.
          A diferencia del SEO, el GEO se centra en la "citabilidad" de tu contenido.
        </p>

        <RichLink
          href="/audit-expert"
          title="Lanzar una auditoría IA gratuita"
          description="Analiza tu visibilidad SEO y GEO en minutos"
        />

        <h2>Diferencias clave</h2>
        <p>
          <strong>Formato de presentación:</strong> En SEO, buscas una posición en los 10 primeros
          resultados. En GEO, buscas ser citado en una respuesta generada.
        </p>
        <p>
          <strong>Señales de confianza:</strong> El SEO valora los backlinks. El GEO valora los
          datos estructurados (Schema.org) y la consistencia de la información.
        </p>
        <p>
          <strong>Medición del éxito:</strong> El SEO mide posiciones y tráfico orgánico.
          El GEO mide citas y menciones en respuestas IA.
        </p>

        <h2>¿Cómo optimizar para ambos?</h2>
        <p>
          Una estrategia ganadora en 2025 combina SEO y GEO. Esto implica crear contenido de
          calidad, estructurado con datos JSON-LD, y mantener consistencia de información
          en toda la web.
        </p>

        <blockquote>
          "En 2025, el 40% de las búsquedas web pasarán por interfaces conversacionales.
          Ignorar el GEO significa ignorar casi la mitad de tu audiencia potencial."
        </blockquote>
      </>
    ),
  },
};

function ArticlePageComponent() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();

  if (!slug) {
    return <Navigate to="/blog" replace />;
  }

  const article = getArticleBySlug(slug);

  if (!article) {
    return <Navigate to="/blog" replace />;
  }

  const content = articleContent[slug];

  if (!content) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <ArticleLayout
      title={article.title[language] || article.title.fr}
      description={article.description[language] || article.description.fr}
      author={article.author}
      date={article.date}
      heroImage={article.heroImage}
      heroAlt={article.heroAlt[language] || article.heroAlt.fr}
      sources={article.sources}
    >
      {content[language] || content.fr}
    </ArticleLayout>
  );
}

export default memo(ArticlePageComponent);
