import { Header } from '@/components/Header';
import { FAQSection } from '@/components/FAQSection';
import { GEOFAQSection } from '@/components/GEOFAQSection';
import { PageEditorial } from '@/components/seo/PageEditorial';
import { lazy, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

import { t3 } from '@/utils/i18n';

export default function Faq() {
  const { language } = useLanguage();
  useCanonicalHreflang('/faq');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 pt-20">
        <header className="container mx-auto max-w-4xl px-4 pt-8 pb-4">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            FAQ Crawlers.fr — questions fréquentes SEO &amp; GEO
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Toutes les réponses sur l'audit SEO, le GEO Score, la visibilité LLM, les crédits, le plan Pro Agency et l'intégration technique de Crawlers.fr.
          </p>
        </header>
        <FAQSection />
        <GEOFAQSection />
        <PageEditorial
          heading="Comprendre l'audit SEO, le GEO et la visibilité dans les LLM"
          intro="Cette page regroupe les questions posées le plus souvent avant de lancer un premier audit : ce que la plateforme mesure réellement, comment les scores sont calculés, et ce qui distingue le référencement classique de la visibilité dans les moteurs de réponse."
          citable="Un audit Crawlers.fr distingue trois plans : la santé technique (indexabilité, statuts HTTP, Core Web Vitals), la qualité sémantique (intention par page, redondance, maillage) et la citabilité par les moteurs génératifs (passages autoportants, données structurées, accès des crawlers IA)."
          sections={[
            {
              title: 'Ce que mesure un audit, ce qu’il ne mesure pas',
              paragraphs: [
                "Un audit mesure ce qui est observable dans le HTML servi, dans les en-têtes HTTP et dans les données de recherche connectées. Il ne devine pas une intention commerciale, ne juge pas un positionnement de marque et n'invente pas de volume de recherche.",
                "C'est une distinction importante pour lire un rapport : les constats techniques sont déterministes et reproductibles, tandis que les recommandations éditoriales sont des hypothèses priorisées par impact estimé, à valider par la personne qui connaît le marché.",
              ],
              bullets: [
                "Déterministe : codes HTTP, balises, données structurées, profondeur de clic, poids des ressources.",
                "Mesuré côté moteur : impressions, clics, positions moyennes quand Search Console est connectée.",
                "Interprété : priorisation, angle éditorial, valeur commerciale d'une requête.",
              ],
            },
            {
              title: 'SEO et GEO : deux surfaces, un même socle',
              paragraphs: [
                "Le GEO n'est pas un remplacement du SEO mais une extension : les moteurs génératifs consomment les mêmes pages que Google, avec des exigences supplémentaires de clarté et d'autonomie des passages. Une page qui ne dit pas explicitement de quoi elle parle est difficile à citer.",
                "En pratique, un site déjà propre techniquement gagne surtout à rendre ses réponses extractibles : une définition en une phrase, des chiffres attribués à une source, des questions traitées séparément plutôt que noyées dans un paragraphe.",
              ],
            },
            {
              title: 'Pourquoi certaines pages ne sont jamais indexées',
              paragraphs: [
                "Une page peut être explorée sans être indexée. Les causes les plus fréquentes n'ont rien de mystérieux : contenu trop proche d'une autre page du même site, volume utile insuffisant, titre non distinctif, ou signal canonique contradictoire.",
                "Demander l'indexation avant d'avoir levé la cause ne change rien : le moteur reprend la même décision. L'ordre efficace consiste à différencier réellement la page, puis à la soumettre.",
              ],
            },
          ]}
        />
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
