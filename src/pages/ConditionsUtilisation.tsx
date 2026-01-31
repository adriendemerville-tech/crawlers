import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const ConditionsUtilisation = () => {
  const { language } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {language === 'fr' ? 'Retour à l\'accueil' : 'Back to home'}
          </Link>

          <article className="prose prose-gray dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold text-foreground mb-8">
              {language === 'fr' ? 'Conditions Générales d\'Utilisation' : language === 'es' ? 'Términos de Uso' : 'Terms of Use'}
            </h1>

            <p className="text-muted-foreground leading-relaxed mb-8">
              {language === 'fr'
                ? 'En accédant et en utilisant le site Crawlers AI, vous acceptez sans réserve les présentes conditions générales d\'utilisation.'
                : 'By accessing and using the Crawlers AI website, you unconditionally accept these terms of use.'}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '1. Objet' : '1. Purpose'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Crawlers AI est une plateforme proposant des outils gratuits d\'analyse SEO et GEO pour optimiser la visibilité des sites web auprès des moteurs de recherche traditionnels et des moteurs de recherche IA (ChatGPT, Perplexity, Claude, etc.).'
                  : 'Crawlers AI is a platform offering free SEO and GEO analysis tools to optimize website visibility for traditional search engines and AI search engines (ChatGPT, Perplexity, Claude, etc.).'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '2. Accès aux services' : '2. Access to Services'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'L\'accès aux outils d\'analyse est gratuit et ne nécessite pas de création de compte. Crawlers AI se réserve le droit de modifier, suspendre ou interrompre tout ou partie des services à tout moment, sans préavis.'
                  : 'Access to analysis tools is free and does not require account creation. Crawlers AI reserves the right to modify, suspend or discontinue all or part of the services at any time, without notice.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '3. Utilisation des outils' : '3. Use of Tools'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr' ? 'L\'utilisateur s\'engage à :' : 'The user agrees to:'}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{language === 'fr' ? 'Utiliser les outils de manière légale et éthique' : 'Use the tools legally and ethically'}</li>
                <li>{language === 'fr' ? 'Ne pas tenter de surcharger ou perturber les serveurs' : 'Not attempt to overload or disrupt the servers'}</li>
                <li>{language === 'fr' ? 'Ne pas utiliser les outils à des fins malveillantes' : 'Not use the tools for malicious purposes'}</li>
                <li>{language === 'fr' ? 'Respecter les droits de propriété intellectuelle des tiers' : 'Respect the intellectual property rights of third parties'}</li>
                <li>{language === 'fr' ? 'Ne pas automatiser massivement les requêtes sans autorisation' : 'Not massively automate requests without authorization'}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '4. Résultats d\'analyse' : '4. Analysis Results'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Les résultats fournis par nos outils sont donnés à titre indicatif. Ils ne constituent pas des conseils professionnels et ne garantissent pas l\'amélioration du référencement. Crawlers AI ne peut être tenu responsable des décisions prises sur la base de ces résultats.'
                  : 'The results provided by our tools are given for informational purposes only. They do not constitute professional advice and do not guarantee SEO improvement. Crawlers AI cannot be held responsible for decisions made based on these results.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '5. Propriété intellectuelle' : '5. Intellectual Property'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Tous les éléments du site (design, logos, textes, code source, algorithmes) sont protégés par le droit de la propriété intellectuelle. Toute reproduction ou utilisation non autorisée est strictement interdite.'
                  : 'All elements of the site (design, logos, texts, source code, algorithms) are protected by intellectual property law. Any unauthorized reproduction or use is strictly prohibited.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '6. Limitation de responsabilité' : '6. Limitation of Liability'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Crawlers AI est fourni "en l\'état" sans garantie d\'aucune sorte. Nous ne garantissons pas la disponibilité continue du service ni l\'exactitude des résultats. En aucun cas, Crawlers AI ne pourra être tenu responsable de dommages directs ou indirects résultant de l\'utilisation du site.'
                  : 'Crawlers AI is provided "as is" without warranty of any kind. We do not guarantee continuous availability of the service or accuracy of results. Under no circumstances shall Crawlers AI be liable for direct or indirect damages resulting from the use of the site.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '7. Modifications des CGU' : '7. Modifications to Terms'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Crawlers AI se réserve le droit de modifier les présentes CGU à tout moment. Les modifications entrent en vigueur dès leur publication sur le site. L\'utilisation continue du site après modification vaut acceptation des nouvelles conditions.'
                  : 'Crawlers AI reserves the right to modify these Terms at any time. Modifications take effect upon publication on the site. Continued use of the site after modification constitutes acceptance of the new terms.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '8. Droit applicable' : '8. Applicable Law'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Les présentes CGU sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux français.'
                  : 'These Terms are governed by French law. Any dispute shall be subject to the exclusive jurisdiction of the French courts.'}
              </p>
            </section>

            <p className="text-sm text-muted-foreground mt-12">
              {language === 'fr' ? 'Dernière mise à jour : Janvier 2026' : language === 'es' ? 'Última actualización: Enero 2026' : 'Last updated: January 2026'}
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ConditionsUtilisation;
