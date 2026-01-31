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
              {language === 'fr' ? 'Conditions Générales d\'Utilisation et de Vente (CGU/CGV)' : language === 'es' ? 'Términos de Uso y Venta' : 'Terms of Use and Sale'}
            </h1>

            <p className="text-muted-foreground leading-relaxed mb-8">
              {language === 'fr'
                ? 'En accédant et en utilisant le site Crawlers AI, vous acceptez sans réserve les présentes conditions générales d\'utilisation et de vente. Ces conditions régissent l\'accès aux services gratuits et payants proposés par la plateforme.'
                : 'By accessing and using the Crawlers AI website, you unconditionally accept these terms of use and sale. These terms govern access to both free and paid services offered by the platform.'}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '1. Objet' : '1. Purpose'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Crawlers AI est une plateforme proposant des outils d\'analyse SEO et GEO pour optimiser la visibilité des sites web auprès des moteurs de recherche traditionnels et des moteurs de recherche IA (ChatGPT, Perplexity, Claude, etc.). La plateforme propose des services gratuits (outils d\'analyse, audit technique) et des services payants (audit stratégique, codes correctifs) accessibles via un système de crédits prépayés.'
                  : 'Crawlers AI is a platform offering SEO and GEO analysis tools to optimize website visibility for traditional search engines and AI search engines (ChatGPT, Perplexity, Claude, etc.). The platform offers free services (analysis tools, technical audit) and paid services (strategic audit, corrective codes) accessible via a prepaid credit system.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '2. Accès aux services' : '2. Access to Services'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr'
                  ? 'Les services de Crawlers AI sont répartis en trois catégories :'
                  : 'Crawlers AI services are divided into three categories:'}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>{language === 'fr' ? 'Services gratuits sans inscription :' : 'Free services without registration:'}</strong> {language === 'fr' ? 'Analyse des bots IA, Score GEO, Visibilité LLM, PageSpeed' : 'AI bot analysis, GEO Score, LLM Visibility, PageSpeed'}</li>
                <li><strong>{language === 'fr' ? 'Services gratuits avec inscription :' : 'Free services with registration:'}</strong> {language === 'fr' ? 'Audit technique SEO complet (200 points), 2 premiers audits stratégiques offerts' : 'Complete technical SEO audit (200 points), first 2 strategic audits free'}</li>
                <li><strong>{language === 'fr' ? 'Services premium payants :' : 'Premium paid services:'}</strong> {language === 'fr' ? 'Audit stratégique IA (2 crédits), modules de codes correctifs (1 crédit ou paiement unique)' : 'Strategic AI audit (2 credits), corrective code modules (1 credit or one-time payment)'}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '3. Tarification et modalités de paiement' : '3. Pricing and Payment Terms'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr' ? 'Les prix sont indiqués en euros TTC. Les paiements sont sécurisés par Stripe.' : 'Prices are indicated in euros including VAT. Payments are secured by Stripe.'}
              </p>
              <div className="bg-muted/50 rounded-lg p-6 mb-4">
                <h3 className="font-semibold text-foreground mb-3">{language === 'fr' ? 'Packs de crédits :' : 'Credit packs:'}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {language === 'fr' ? 'Essentiel : 10 crédits = 5€ TTC' : 'Essential: 10 credits = €5 incl. VAT'}</li>
                  <li>• {language === 'fr' ? 'Pro : 50 crédits = 19€ TTC' : 'Pro: 50 credits = €19 incl. VAT'}</li>
                  <li>• {language === 'fr' ? 'Premium : 150 crédits = 45€ TTC' : 'Premium: 150 credits = €45 incl. VAT'}</li>
                </ul>
              </div>
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-3">{language === 'fr' ? 'Codes correctifs (paiement unique) :' : 'Corrective codes (one-time payment):'}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {language === 'fr' ? 'Module basique : 3€ TTC' : 'Basic module: €3 incl. VAT'}</li>
                  <li>• {language === 'fr' ? 'Module avancé : 6€ TTC' : 'Advanced module: €6 incl. VAT'}</li>
                  <li>• {language === 'fr' ? 'Module complet : 12€ TTC' : 'Complete module: €12 incl. VAT'}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '4. Droit de rétractation' : '4. Right of Withdrawal'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr'
                  ? 'Conformément aux articles L.221-18 et suivants du Code de la consommation, vous disposez d\'un délai de 14 jours à compter de l\'achat pour exercer votre droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.'
                  : 'In accordance with articles L.221-18 et seq. of the French Consumer Code, you have a period of 14 days from the purchase to exercise your right of withdrawal, without having to justify reasons or pay penalties.'}
              </p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                <p className="text-muted-foreground">
                  <strong className="text-amber-600 dark:text-amber-400">{language === 'fr' ? 'Exception :' : 'Exception:'}</strong>{' '}
                  {language === 'fr'
                    ? 'Conformément à l\'article L.221-28 du Code de la consommation, le droit de rétractation ne peut être exercé pour les contenus numériques non fournis sur un support matériel dont l\'exécution a commencé après accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation. Cela inclut les crédits utilisés et les codes correctifs générés et consultés.'
                    : 'In accordance with article L.221-28 of the French Consumer Code, the right of withdrawal cannot be exercised for digital content not supplied on a tangible medium the execution of which has begun after the consumer\'s prior express consent and acknowledgment that they thereby forfeit their right of withdrawal. This includes used credits and corrective codes that have been generated and viewed.'}
                </p>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Pour exercer votre droit de rétractation sur des crédits non utilisés, contactez-nous à contact@crawlers.fr avec votre numéro de commande.'
                  : 'To exercise your right of withdrawal on unused credits, contact us at contact@crawlers.fr with your order number.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '5. Livraison des services numériques' : '5. Delivery of Digital Services'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Les crédits sont crédités sur votre compte immédiatement après confirmation du paiement par Stripe. Les rapports d\'audit et les codes correctifs sont générés et accessibles instantanément après utilisation des crédits. Les contenus numériques sont disponibles dans votre espace personnel.'
                  : 'Credits are credited to your account immediately after payment confirmation by Stripe. Audit reports and corrective codes are generated and accessible instantly after using credits. Digital content is available in your personal space.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '6. Durée de validité des crédits' : '6. Credit Validity Period'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Les crédits achetés sont valables sans limitation de durée. Ils restent utilisables tant que votre compte est actif. En cas de suppression de compte à votre demande, les crédits non utilisés sont perdus.'
                  : 'Purchased credits are valid without time limit. They remain usable as long as your account is active. If your account is deleted at your request, unused credits are forfeited.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '7. Remboursement' : '7. Refund'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'En cas de problème technique empêchant la génération d\'un rapport ou d\'un code correctif après utilisation de crédits, les crédits concernés seront recrédités sur votre compte sous 48h. Pour toute réclamation, contactez contact@crawlers.fr avec les détails du problème rencontré.'
                  : 'In case of a technical problem preventing the generation of a report or corrective code after using credits, the concerned credits will be recredited to your account within 48 hours. For any complaint, contact contact@crawlers.fr with details of the problem encountered.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '8. Utilisation des outils' : '8. Use of Tools'}
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
                <li>{language === 'fr' ? 'Ne pas revendre ou redistribuer les codes correctifs générés' : 'Not resell or redistribute generated corrective codes'}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '9. Résultats d\'analyse' : '9. Analysis Results'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Les résultats fournis par nos outils sont donnés à titre indicatif. Ils ne constituent pas des conseils professionnels et ne garantissent pas l\'amélioration du référencement. Crawlers AI ne peut être tenu responsable des décisions prises sur la base de ces résultats.'
                  : 'The results provided by our tools are given for informational purposes only. They do not constitute professional advice and do not guarantee SEO improvement. Crawlers AI cannot be held responsible for decisions made based on these results.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '10. Propriété intellectuelle' : '10. Intellectual Property'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Tous les éléments du site (design, logos, textes, code source, algorithmes) sont protégés par le droit de la propriété intellectuelle. Les codes correctifs générés pour vous peuvent être utilisés librement sur vos propres sites. Toute reproduction ou redistribution commerciale non autorisée est strictement interdite.'
                  : 'All elements of the site (design, logos, texts, source code, algorithms) are protected by intellectual property law. Corrective codes generated for you can be freely used on your own sites. Any unauthorized commercial reproduction or redistribution is strictly prohibited.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '11. Limitation de responsabilité' : '11. Limitation of Liability'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Crawlers AI est fourni "en l\'état" sans garantie d\'aucune sorte. Nous ne garantissons pas la disponibilité continue du service ni l\'exactitude des résultats. En aucun cas, Crawlers AI ne pourra être tenu responsable de dommages directs ou indirects résultant de l\'utilisation du site, dans la limite permise par la loi.'
                  : 'Crawlers AI is provided "as is" without warranty of any kind. We do not guarantee continuous availability of the service or accuracy of results. Under no circumstances shall Crawlers AI be liable for direct or indirect damages resulting from the use of the site, to the extent permitted by law.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '12. Médiation des litiges' : '12. Dispute Mediation'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr'
                  ? 'Conformément aux articles L.612-1 et suivants du Code de la consommation, en cas de litige, vous pouvez recourir gratuitement au service de médiation de la consommation. Le médiateur compétent est :'
                  : 'In accordance with articles L.612-1 et seq. of the French Consumer Code, in case of dispute, you can use the consumer mediation service free of charge. The competent mediator is:'}
              </p>
              <div className="bg-muted/50 rounded-lg p-6">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{language === 'fr' ? 'Médiateur de la consommation :' : 'Consumer Mediator:'}</strong><br />
                  CM2C (Centre de Médiation de la Consommation de Conciliateurs de Justice)<br />
                  14 rue Saint Jean - 75017 Paris<br />
                  <a href="https://www.cm2c.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.cm2c.net</a>
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '13. Modifications des CGU/CGV' : '13. Modifications to Terms'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Crawlers AI se réserve le droit de modifier les présentes CGU/CGV à tout moment. Les modifications entrent en vigueur dès leur publication sur le site. Les utilisateurs seront informés par email des modifications substantielles. L\'utilisation continue du site après modification vaut acceptation des nouvelles conditions.'
                  : 'Crawlers AI reserves the right to modify these Terms at any time. Modifications take effect upon publication on the site. Users will be informed by email of substantial modifications. Continued use of the site after modification constitutes acceptance of the new terms.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '14. Droit applicable' : '14. Applicable Law'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Les présentes CGU/CGV sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux français, sous réserve des règles de compétence impératives au bénéfice du consommateur.'
                  : 'These Terms are governed by French law. Any dispute shall be subject to the exclusive jurisdiction of the French courts, subject to mandatory jurisdiction rules for the benefit of the consumer.'}
              </p>
            </section>

            <p className="text-sm text-muted-foreground mt-12">
              {language === 'fr' ? 'Dernière mise à jour : 31 janvier 2026' : language === 'es' ? 'Última actualización: 31 de enero de 2026' : 'Last updated: January 31, 2026'}
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ConditionsUtilisation;
