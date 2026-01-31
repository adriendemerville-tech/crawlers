import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const PolitiqueConfidentialite = () => {
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
              {language === 'fr' ? 'Politique de Confidentialité' : language === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
            </h1>

            <p className="text-muted-foreground leading-relaxed mb-8">
              {language === 'fr'
                ? 'Crawlers AI s\'engage à protéger la vie privée des utilisateurs de son site. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos données personnelles.'
                : 'Crawlers AI is committed to protecting the privacy of its website users. This privacy policy explains how we collect, use and protect your personal data.'}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '1. Données collectées' : '1. Data Collected'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr' ? 'Nous collectons les données suivantes :' : 'We collect the following data:'}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{language === 'fr' ? 'URLs analysées via nos outils (non stockées de manière permanente)' : 'URLs analyzed via our tools (not stored permanently)'}</li>
                <li>{language === 'fr' ? 'Données de navigation anonymisées (pages visitées, durée de visite)' : 'Anonymized browsing data (pages visited, visit duration)'}</li>
                <li>{language === 'fr' ? 'Préférences linguistiques' : 'Language preferences'}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '2. Utilisation des données' : '2. Use of Data'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr' ? 'Vos données sont utilisées pour :' : 'Your data is used to:'}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{language === 'fr' ? 'Fournir les résultats d\'analyse demandés' : 'Provide requested analysis results'}</li>
                <li>{language === 'fr' ? 'Améliorer nos services et l\'expérience utilisateur' : 'Improve our services and user experience'}</li>
                <li>{language === 'fr' ? 'Générer des statistiques d\'utilisation anonymisées' : 'Generate anonymized usage statistics'}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '3. Cookies' : '3. Cookies'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Notre site utilise des cookies techniques nécessaires au fonctionnement du site. Ces cookies ne collectent pas de données personnelles identifiables et sont exemptés de consentement conformément aux recommandations de la CNIL.'
                  : 'Our site uses technical cookies necessary for the operation of the site. These cookies do not collect identifiable personal data and are exempt from consent in accordance with CNIL recommendations.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '4. Conservation des données' : '4. Data Retention'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Les URLs analysées ne sont pas stockées de manière permanente. Les données de session sont supprimées à la fermeture du navigateur. Les données analytiques anonymisées sont conservées pendant une durée maximale de 13 mois.'
                  : 'Analyzed URLs are not stored permanently. Session data is deleted when the browser is closed. Anonymized analytical data is retained for a maximum of 13 months.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '5. Partage des données' : '5. Data Sharing'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Nous ne vendons, n\'échangeons ni ne louons vos données personnelles à des tiers. Nous pouvons partager des données anonymisées et agrégées à des fins statistiques.'
                  : 'We do not sell, trade or rent your personal data to third parties. We may share anonymized and aggregated data for statistical purposes.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '6. Sécurité' : '6. Security'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction.'
                  : 'We implement appropriate technical and organizational security measures to protect your data against unauthorized access, modification, disclosure or destruction.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '7. Vos droits' : '7. Your Rights'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr' ? 'Conformément au RGPD, vous disposez des droits suivants :' : 'In accordance with the GDPR, you have the following rights:'}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{language === 'fr' ? 'Droit d\'accès à vos données personnelles' : 'Right of access to your personal data'}</li>
                <li>{language === 'fr' ? 'Droit de rectification' : 'Right to rectification'}</li>
                <li>{language === 'fr' ? 'Droit à l\'effacement ("droit à l\'oubli")' : 'Right to erasure ("right to be forgotten")'}</li>
                <li>{language === 'fr' ? 'Droit à la portabilité des données' : 'Right to data portability'}</li>
                <li>{language === 'fr' ? 'Droit d\'opposition' : 'Right to object'}</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                {language === 'fr'
                  ? 'Pour exercer ces droits, contactez-nous à : contact@crawlers.fr'
                  : 'To exercise these rights, contact us at: contact@crawlers.fr'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '8. Contact' : '8. Contact'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Pour toute question concernant cette politique de confidentialité, vous pouvez nous contacter à l\'adresse : contact@crawlers.fr'
                  : 'For any questions regarding this privacy policy, you can contact us at: contact@crawlers.fr'}
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

export default PolitiqueConfidentialite;
