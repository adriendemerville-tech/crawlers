import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const t3 = (language: string, fr: string, en: string, es: string) =>
  language === 'fr' ? fr : language === 'es' ? es : en;

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
            {t3(language, 'Retour à l\'accueil', 'Back to home', 'Volver al inicio')}
          </Link>

          <article className="prose prose-gray dark:prose-invert max-w-none">
            <div className="flex items-center gap-3 mb-8">
              <Shield className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold text-foreground m-0">
                RGPD / GDPR
              </h1>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-8">
              {t3(language,
                'Crawlers AI s\'engage à respecter le Règlement Général sur la Protection des Données (RGPD) et à garantir la protection de vos données personnelles, y compris dans le cadre des transactions commerciales.',
                'Crawlers AI is committed to complying with the General Data Protection Regulation (GDPR) and ensuring the protection of your personal data, including in the context of commercial transactions.',
                'Crawlers AI se compromete a cumplir con el Reglamento General de Protección de Datos (RGPD) y a garantizar la protección de sus datos personales, incluso en el marco de las transacciones comerciales.'
              )}
            </p>

            {/* Compliance Summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                {t3(language, 'Résumé de conformité', 'Compliance Summary', 'Resumen de conformidad')}
              </h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Minimisation des données : nous ne collectons que les données strictement nécessaires', 'Data minimization: we only collect strictly necessary data', 'Minimización de datos: solo recopilamos los datos estrictamente necesarios')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Paiements sécurisés via Stripe (PCI-DSS niveau 1) - aucune donnée bancaire stockée', 'Secure payments via Stripe (PCI-DSS Level 1) - no banking data stored', 'Pagos seguros a través de Stripe (PCI-DSS nivel 1) - ningún dato bancario almacenado')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Hébergement sur infrastructure européenne (Supabase EU)', 'Hosting on European infrastructure (Supabase EU)', 'Alojamiento en infraestructura europea (Supabase EU)')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Pas de vente ni partage de données à des tiers à des fins commerciales', 'No selling or sharing of data with third parties for commercial purposes', 'Sin venta ni intercambio de datos con terceros con fines comerciales')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Cookies techniques uniquement (exemptés de consentement)', 'Technical cookies only (consent exempt)', 'Solo cookies técnicas (exentas de consentimiento)')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Droit de rétractation de 14 jours sur les crédits non utilisés', '14-day withdrawal right on unused credits', 'Derecho de desistimiento de 14 días sobre los créditos no utilizados')}</span>
                </li>
              </ul>
            </div>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '1. Responsable du traitement', '1. Data Controller', '1. Responsable del tratamiento')}
              </h2>
              <div className="bg-muted/50 rounded-lg p-6 text-muted-foreground">
                <p><strong className="text-foreground">{t3(language, 'Responsable :', 'Controller:', 'Responsable:')}</strong> Adrien de Volontat</p>
                <p><strong className="text-foreground">{t3(language, 'Qualité :', 'Capacity:', 'Calidad:')}</strong> {t3(language, 'Entrepreneur individuel', 'Sole proprietor', 'Empresario individual')}</p>
                <p><strong className="text-foreground">Email :</strong> <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a></p>
                <p><strong className="text-foreground">{t3(language, 'Site :', 'Website:', 'Sitio web:')}</strong> crawlers.fr</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '2. Base légale du traitement', '2. Legal Basis for Processing', '2. Base legal del tratamiento')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Le traitement de vos données repose sur :', 'The processing of your data is based on:', 'El tratamiento de sus datos se basa en:')}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>{t3(language, 'Exécution du contrat :', 'Contract execution:', 'Ejecución del contrato:')}</strong> {t3(language, 'pour fournir les services gratuits et payants (audits, codes correctifs)', 'to provide free and paid services (audits, corrective codes)', 'para proporcionar los servicios gratuitos y de pago (auditorías, códigos correctivos)')}</li>
                <li><strong>{t3(language, 'Obligation légale :', 'Legal obligation:', 'Obligación legal:')}</strong> {t3(language, 'pour la conservation des données de facturation (10 ans)', 'for retention of billing data (10 years)', 'para la conservación de los datos de facturación (10 años)')}</li>
                <li><strong>{t3(language, 'Intérêt légitime :', 'Legitimate interest:', 'Interés legítimo:')}</strong> {t3(language, 'pour l\'amélioration de nos services et l\'analyse statistique anonymisée', 'for improving our services and anonymized statistical analysis', 'para la mejora de nuestros servicios y el análisis estadístico anonimizado')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '3. Données de paiement', '3. Payment Data', '3. Datos de pago')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language,
                  'Les paiements sont traités exclusivement par notre prestataire Stripe, certifié PCI-DSS niveau 1 (plus haut niveau de sécurité).',
                  'Payments are processed exclusively by our provider Stripe, PCI-DSS Level 1 certified (highest security level).',
                  'Los pagos son procesados exclusivamente por nuestro proveedor Stripe, certificado PCI-DSS nivel 1 (el más alto nivel de seguridad).'
                )}
              </p>
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-2">{t3(language, 'Ce que nous ne stockons PAS :', 'What we do NOT store:', 'Lo que NO almacenamos:')}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t3(language, 'Numéros de carte bancaire', 'Credit card numbers', 'Números de tarjeta bancaria')}</li>
                  <li>• {t3(language, 'Codes de sécurité (CVV)', 'Security codes (CVV)', 'Códigos de seguridad (CVV)')}</li>
                  <li>• {t3(language, 'Données d\'authentification bancaire', 'Banking authentication data', 'Datos de autenticación bancaria')}</li>
                </ul>
                <h3 className="font-semibold text-foreground mb-2 mt-4">{t3(language, 'Ce que nous conservons :', 'What we retain:', 'Lo que conservamos:')}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t3(language, 'Identifiant de transaction Stripe', 'Stripe transaction identifier', 'Identificador de transacción Stripe')}</li>
                  <li>• {t3(language, 'Montant et date de la transaction', 'Transaction amount and date', 'Monto y fecha de la transacción')}</li>
                  <li>• {t3(language, 'Email associé au paiement', 'Email associated with payment', 'Email asociado al pago')}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '4. Vos droits RGPD', '4. Your GDPR Rights', '4. Sus derechos RGPD')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Conformément au RGPD, vous disposez des droits suivants :', 'In accordance with the GDPR, you have the following rights:', 'De conformidad con el RGPD, usted dispone de los siguientes derechos:')}
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{t3(language, 'Droit d\'accès', 'Right of Access', 'Derecho de acceso')}</h3>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Obtenir une copie de vos données personnelles', 'Obtain a copy of your personal data', 'Obtener una copia de sus datos personales')}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{t3(language, 'Droit de rectification', 'Right to Rectification', 'Derecho de rectificación')}</h3>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Corriger des données inexactes', 'Correct inaccurate data', 'Corregir datos inexactos')}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{t3(language, 'Droit à l\'effacement', 'Right to Erasure', 'Derecho de supresión')}</h3>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Demander la suppression de vos données (sous réserve des obligations légales)', 'Request deletion of your data (subject to legal obligations)', 'Solicitar la eliminación de sus datos (sujeto a obligaciones legales)')}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{t3(language, 'Droit à la portabilité', 'Right to Portability', 'Derecho a la portabilidad')}</h3>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Recevoir vos données dans un format lisible', 'Receive your data in a readable format', 'Recibir sus datos en un formato legible')}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{t3(language, 'Droit d\'opposition', 'Right to Object', 'Derecho de oposición')}</h3>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Vous opposer au traitement de vos données', 'Object to the processing of your data', 'Oponerse al tratamiento de sus datos')}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{t3(language, 'Droit de limitation', 'Right to Restriction', 'Derecho de limitación')}</h3>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Limiter le traitement de vos données', 'Restrict the processing of your data', 'Limitar el tratamiento de sus datos')}</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '5. Exercer vos droits', '5. Exercise Your Rights', '5. Ejercer sus derechos')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language,
                  'Pour exercer vos droits ou pour toute question relative à la protection de vos données, contactez-nous :',
                  'To exercise your rights or for any questions regarding the protection of your data, contact us:',
                  'Para ejercer sus derechos o para cualquier pregunta relativa a la protección de sus datos, contáctenos:'
                )}
              </p>
              <div className="bg-muted/50 rounded-lg p-6">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Email :</strong>{' '}
                  <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t3(language,
                    'Nous répondrons à votre demande dans un délai maximum de 30 jours.',
                    'We will respond to your request within a maximum of 30 days.',
                    'Responderemos a su solicitud en un plazo máximo de 30 días.'
                  )}
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '6. Réclamation auprès de la CNIL', '6. Complaint to the CNIL', '6. Reclamación ante la CNIL')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Si vous estimez que le traitement de vos données ne respecte pas la réglementation, vous pouvez adresser une réclamation à la CNIL (Commission Nationale de l\'Informatique et des Libertés) : ',
                  'If you believe that the processing of your data does not comply with the regulations, you can file a complaint with the CNIL (French Data Protection Authority): ',
                  'Si considera que el tratamiento de sus datos no cumple con la normativa, puede presentar una reclamación ante la CNIL (Comisión Nacional de Informática y Libertades): '
                )}
                <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.cnil.fr</a>
              </p>
            </section>

            <p className="text-sm text-muted-foreground mt-12">
              {t3(language, 'Dernière mise à jour : 31 janvier 2026', 'Last updated: January 31, 2026', 'Última actualización: 31 de enero de 2026')}
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RGPD;