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
                ? 'Crawlers AI s\'engage à protéger la vie privée des utilisateurs de son site. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos données personnelles, y compris dans le cadre des transactions de paiement.'
                : 'Crawlers AI is committed to protecting the privacy of its website users. This privacy policy explains how we collect, use and protect your personal data, including in the context of payment transactions.'}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '1. Données collectées' : '1. Data Collected'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr' ? 'Nous collectons les données suivantes :' : 'We collect the following data:'}
              </p>
              
              <h3 className="text-lg font-medium text-foreground mb-2">{language === 'fr' ? 'Données d\'utilisation :' : 'Usage data:'}</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>{language === 'fr' ? 'URLs analysées via nos outils' : 'URLs analyzed via our tools'}</li>
                <li>{language === 'fr' ? 'Données de navigation anonymisées (pages visitées, durée de visite)' : 'Anonymized browsing data (pages visited, visit duration)'}</li>
                <li>{language === 'fr' ? 'Préférences linguistiques' : 'Language preferences'}</li>
                <li>{language === 'fr' ? 'Rapports et codes correctifs générés' : 'Generated reports and corrective codes'}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-2">{language === 'fr' ? 'Données de compte (si inscription) :' : 'Account data (if registered):'}</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>{language === 'fr' ? 'Prénom et nom' : 'First and last name'}</li>
                <li>{language === 'fr' ? 'Adresse email' : 'Email address'}</li>
                <li>{language === 'fr' ? 'Historique des achats de crédits' : 'Credit purchase history'}</li>
                <li>{language === 'fr' ? 'Solde de crédits' : 'Credit balance'}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-2">{language === 'fr' ? 'Données de paiement :' : 'Payment data:'}</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{language === 'fr' ? 'Les paiements sont traités par Stripe. Nous ne stockons pas vos données bancaires.' : 'Payments are processed by Stripe. We do not store your banking data.'}</li>
                <li>{language === 'fr' ? 'Seules les informations de transaction (montant, date, identifiant Stripe) sont conservées.' : 'Only transaction information (amount, date, Stripe identifier) is retained.'}</li>
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
                <li>{language === 'fr' ? 'Gérer votre compte et vos crédits' : 'Manage your account and credits'}</li>
                <li>{language === 'fr' ? 'Traiter les transactions de paiement' : 'Process payment transactions'}</li>
                <li>{language === 'fr' ? 'Améliorer nos services et l\'expérience utilisateur' : 'Improve our services and user experience'}</li>
                <li>{language === 'fr' ? 'Envoyer des notifications transactionnelles (confirmations d\'achat)' : 'Send transactional notifications (purchase confirmations)'}</li>
                <li>{language === 'fr' ? 'Générer des statistiques d\'utilisation anonymisées' : 'Generate anonymized usage statistics'}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '3. Sous-traitants' : '3. Subcontractors'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr' ? 'Nous faisons appel aux sous-traitants suivants :' : 'We use the following subcontractors:'}
              </p>
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div>
                  <p className="font-medium text-foreground">Stripe Payments Europe Ltd.</p>
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Traitement des paiements. Les données transmises : email, montant, devise.' : 'Payment processing. Data transmitted: email, amount, currency.'}</p>
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {language === 'fr' ? 'Politique de confidentialité Stripe' : 'Stripe Privacy Policy'}
                  </a>
                </div>
                <div>
                  <p className="font-medium text-foreground">Supabase Inc.</p>
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Hébergement base de données et authentification. Serveurs européens.' : 'Database hosting and authentication. European servers.'}</p>
                  <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {language === 'fr' ? 'Politique de confidentialité Supabase' : 'Supabase Privacy Policy'}
                  </a>
                </div>
                <div>
                  <p className="font-medium text-foreground">Lovable Technologies</p>
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Hébergement de l\'application web.' : 'Web application hosting.'}</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '4. Cookies' : '4. Cookies'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Notre site utilise des cookies techniques nécessaires au fonctionnement du site (authentification, préférences). Ces cookies ne collectent pas de données personnelles identifiables et sont exemptés de consentement conformément aux recommandations de la CNIL. Nous n\'utilisons pas de cookies publicitaires ou de tracking tiers.'
                  : 'Our site uses technical cookies necessary for the operation of the site (authentication, preferences). These cookies do not collect identifiable personal data and are exempt from consent in accordance with CNIL recommendations. We do not use advertising or third-party tracking cookies.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '5. Conservation des données' : '5. Data Retention'}
              </h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>{language === 'fr' ? 'Données de compte :' : 'Account data:'}</strong> {language === 'fr' ? 'conservées pendant la durée du compte, puis 3 ans après suppression pour obligations légales' : 'retained for the duration of the account, then 3 years after deletion for legal obligations'}</li>
                <li><strong>{language === 'fr' ? 'Données de paiement :' : 'Payment data:'}</strong> {language === 'fr' ? 'conservées 10 ans conformément aux obligations comptables' : 'retained 10 years in accordance with accounting obligations'}</li>
                <li><strong>{language === 'fr' ? 'Rapports générés :' : 'Generated reports:'}</strong> {language === 'fr' ? 'conservés tant que le compte est actif' : 'retained as long as the account is active'}</li>
                <li><strong>{language === 'fr' ? 'Données analytiques :' : 'Analytical data:'}</strong> {language === 'fr' ? 'anonymisées et conservées maximum 13 mois' : 'anonymized and retained maximum 13 months'}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '6. Partage des données' : '6. Data Sharing'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Nous ne vendons, n\'échangeons ni ne louons vos données personnelles à des tiers. Les données sont partagées uniquement avec nos sous-traitants techniques listés ci-dessus, et sur réquisition judiciaire le cas échéant.'
                  : 'We do not sell, trade or rent your personal data to third parties. Data is shared only with our technical subcontractors listed above, and upon judicial request if applicable.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '7. Sécurité' : '7. Security'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées : chiffrement HTTPS, authentification sécurisée, accès restreint aux données. Les paiements sont sécurisés par Stripe, certifié PCI-DSS niveau 1.'
                  : 'We implement appropriate technical and organizational security measures: HTTPS encryption, secure authentication, restricted data access. Payments are secured by Stripe, PCI-DSS Level 1 certified.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '8. Vos droits' : '8. Your Rights'}
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
                <li>{language === 'fr' ? 'Droit de retirer votre consentement' : 'Right to withdraw consent'}</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                {language === 'fr'
                  ? 'Pour exercer ces droits, contactez-nous à : contact@crawlers.fr. Nous répondrons sous 30 jours.'
                  : 'To exercise these rights, contact us at: contact@crawlers.fr. We will respond within 30 days.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '9. Contact' : '9. Contact'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Pour toute question concernant cette politique de confidentialité ou vos données personnelles :'
                  : 'For any questions regarding this privacy policy or your personal data:'}
              </p>
              <div className="bg-muted/50 rounded-lg p-6 mt-4">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Email :</strong>{' '}
                  <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a>
                </p>
              </div>
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

export default PolitiqueConfidentialite;
