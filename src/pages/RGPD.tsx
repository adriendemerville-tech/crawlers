import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const RGPD = () => {
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
            <div className="flex items-center gap-3 mb-8">
              <Shield className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold text-foreground m-0">
                RGPD / GDPR
              </h1>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-8">
              {language === 'fr'
                ? 'Crawlers AI s\'engage à respecter le Règlement Général sur la Protection des Données (RGPD) et à garantir la protection de vos données personnelles, y compris dans le cadre des transactions commerciales.'
                : 'Crawlers AI is committed to complying with the General Data Protection Regulation (GDPR) and ensuring the protection of your personal data, including in the context of commercial transactions.'}
            </p>

            {/* Compliance Summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                {language === 'fr' ? 'Résumé de conformité' : 'Compliance Summary'}
              </h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{language === 'fr' ? 'Minimisation des données : nous ne collectons que les données strictement nécessaires' : 'Data minimization: we only collect strictly necessary data'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{language === 'fr' ? 'Paiements sécurisés via Stripe (PCI-DSS niveau 1) - aucune donnée bancaire stockée' : 'Secure payments via Stripe (PCI-DSS Level 1) - no banking data stored'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{language === 'fr' ? 'Hébergement sur infrastructure européenne (Supabase EU)' : 'Hosting on European infrastructure (Supabase EU)'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{language === 'fr' ? 'Pas de vente ni partage de données à des tiers à des fins commerciales' : 'No selling or sharing of data with third parties for commercial purposes'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{language === 'fr' ? 'Cookies techniques uniquement (exemptés de consentement)' : 'Technical cookies only (consent exempt)'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{language === 'fr' ? 'Droit de rétractation de 14 jours sur les crédits non utilisés' : '14-day withdrawal right on unused credits'}</span>
                </li>
              </ul>
            </div>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '1. Responsable du traitement' : '1. Data Controller'}
              </h2>
              <div className="bg-muted/50 rounded-lg p-6 text-muted-foreground">
                <p><strong className="text-foreground">{language === 'fr' ? 'Responsable :' : 'Controller:'}</strong> Adrien de Volontat</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Qualité :' : 'Capacity:'}</strong> {language === 'fr' ? 'Entrepreneur individuel' : 'Sole proprietor'}</p>
                <p><strong className="text-foreground">Email :</strong> <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a></p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Site :' : 'Website:'}</strong> crawlers.fr</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '2. Base légale du traitement' : '2. Legal Basis for Processing'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr' ? 'Le traitement de vos données repose sur :' : 'The processing of your data is based on:'}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>{language === 'fr' ? 'Exécution du contrat :' : 'Contract execution:'}</strong> {language === 'fr' ? 'pour fournir les services gratuits et payants (audits, codes correctifs)' : 'to provide free and paid services (audits, corrective codes)'}</li>
                <li><strong>{language === 'fr' ? 'Obligation légale :' : 'Legal obligation:'}</strong> {language === 'fr' ? 'pour la conservation des données de facturation (10 ans)' : 'for retention of billing data (10 years)'}</li>
                <li><strong>{language === 'fr' ? 'Intérêt légitime :' : 'Legitimate interest:'}</strong> {language === 'fr' ? 'pour l\'amélioration de nos services et l\'analyse statistique anonymisée' : 'for improving our services and anonymized statistical analysis'}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '3. Données de paiement' : '3. Payment Data'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr'
                  ? 'Les paiements sont traités exclusivement par notre prestataire Stripe, certifié PCI-DSS niveau 1 (plus haut niveau de sécurité).'
                  : 'Payments are processed exclusively by our provider Stripe, PCI-DSS Level 1 certified (highest security level).'}
              </p>
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-2">{language === 'fr' ? 'Ce que nous ne stockons PAS :' : 'What we do NOT store:'}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {language === 'fr' ? 'Numéros de carte bancaire' : 'Credit card numbers'}</li>
                  <li>• {language === 'fr' ? 'Codes de sécurité (CVV)' : 'Security codes (CVV)'}</li>
                  <li>• {language === 'fr' ? 'Données d\'authentification bancaire' : 'Banking authentication data'}</li>
                </ul>
                <h3 className="font-semibold text-foreground mb-2 mt-4">{language === 'fr' ? 'Ce que nous conservons :' : 'What we retain:'}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {language === 'fr' ? 'Identifiant de transaction Stripe' : 'Stripe transaction identifier'}</li>
                  <li>• {language === 'fr' ? 'Montant et date de la transaction' : 'Transaction amount and date'}</li>
                  <li>• {language === 'fr' ? 'Email associé au paiement' : 'Email associated with payment'}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '4. Vos droits RGPD' : '4. Your GDPR Rights'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr' ? 'Conformément au RGPD, vous disposez des droits suivants :' : 'In accordance with the GDPR, you have the following rights:'}
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{language === 'fr' ? 'Droit d\'accès' : 'Right of Access'}</h3>
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Obtenir une copie de vos données personnelles' : 'Obtain a copy of your personal data'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{language === 'fr' ? 'Droit de rectification' : 'Right to Rectification'}</h3>
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Corriger des données inexactes' : 'Correct inaccurate data'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{language === 'fr' ? 'Droit à l\'effacement' : 'Right to Erasure'}</h3>
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Demander la suppression de vos données (sous réserve des obligations légales)' : 'Request deletion of your data (subject to legal obligations)'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{language === 'fr' ? 'Droit à la portabilité' : 'Right to Portability'}</h3>
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Recevoir vos données dans un format lisible' : 'Receive your data in a readable format'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{language === 'fr' ? 'Droit d\'opposition' : 'Right to Object'}</h3>
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Vous opposer au traitement de vos données' : 'Object to the processing of your data'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{language === 'fr' ? 'Droit de limitation' : 'Right to Restriction'}</h3>
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Limiter le traitement de vos données' : 'Restrict the processing of your data'}</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '5. Exercer vos droits' : '5. Exercise Your Rights'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr'
                  ? 'Pour exercer vos droits ou pour toute question relative à la protection de vos données, contactez-nous :'
                  : 'To exercise your rights or for any questions regarding the protection of your data, contact us:'}
              </p>
              <div className="bg-muted/50 rounded-lg p-6">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Email :</strong>{' '}
                  <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {language === 'fr'
                    ? 'Nous répondrons à votre demande dans un délai maximum de 30 jours.'
                    : 'We will respond to your request within a maximum of 30 days.'}
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '6. Réclamation auprès de la CNIL' : '6. Complaint to the CNIL'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Si vous estimez que le traitement de vos données ne respecte pas la réglementation, vous pouvez adresser une réclamation à la CNIL (Commission Nationale de l\'Informatique et des Libertés) : '
                  : 'If you believe that the processing of your data does not comply with the regulations, you can file a complaint with the CNIL (French Data Protection Authority): '}
                <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.cnil.fr</a>
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

export default RGPD;
