import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t3 } from '@/utils/i18n';

const PolitiqueConfidentialite = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/politique-confidentialite');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <html lang={language} />
        <title>{t3(language, 'Politique de confidentialité | Crawlers.fr', 'Privacy Policy | Crawlers.fr', 'Política de privacidad | Crawlers.fr')}</title>
        <meta name="description" content={t3(language, 'Politique de confidentialité de Crawlers.fr', 'Privacy policy for Crawlers.fr', 'Política de privacidad de Crawlers.fr')} />
        <meta property="og:locale" content={language === 'fr' ? 'fr_FR' : language === 'es' ? 'es_ES' : 'en_US'} />
        <meta property="og:locale:alternate" content="fr_FR" />
        <meta property="og:locale:alternate" content="en_US" />
        <meta property="og:locale:alternate" content="es_ES" />
      </Helmet>
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
            <h1 className="text-3xl font-bold text-foreground mb-8">
              {t3(language, 'Politique de Confidentialité', 'Privacy Policy', 'Política de Privacidad')}
            </h1>

            <p className="text-muted-foreground leading-relaxed mb-8">
              {t3(language,
                'Crawlers AI s\'engage à protéger la vie privée des utilisateurs de son site. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos données personnelles, y compris dans le cadre des transactions de paiement.',
                'Crawlers AI is committed to protecting the privacy of its website users. This privacy policy explains how we collect, use and protect your personal data, including in the context of payment transactions.',
                'Crawlers AI se compromete a proteger la privacidad de los usuarios de su sitio. Esta política de privacidad explica cómo recopilamos, utilizamos y protegemos sus datos personales, incluso en el marco de las transacciones de pago.'
              )}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '1. Données collectées', '1. Data Collected', '1. Datos recopilados')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Nous collectons les données suivantes :', 'We collect the following data:', 'Recopilamos los siguientes datos:')}
              </p>
              
              <h3 className="text-lg font-medium text-foreground mb-2">{t3(language, 'Données d\'utilisation :', 'Usage data:', 'Datos de uso:')}</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>{t3(language, 'URLs analysées via nos outils (audits, crawls, analyses concurrentielles)', 'URLs analyzed via our tools (audits, crawls, competitive analysis)', 'URLs analizadas a través de nuestras herramientas (auditorías, crawls, análisis competitivo)')}</li>
                <li>{t3(language, 'Données de navigation anonymisées (pages visitées, durée de visite)', 'Anonymized browsing data (pages visited, visit duration)', 'Datos de navegación anonimizados (páginas visitadas, duración de la visita)')}</li>
                <li>{t3(language, 'Préférences linguistiques', 'Language preferences', 'Preferencias lingüísticas')}</li>
                <li>{t3(language, 'Rapports, codes correctifs et graphes sémantiques (Cocoon) générés', 'Generated reports, corrective codes and semantic graphs (Cocoon)', 'Informes, códigos correctivos y grafos semánticos (Cocoon) generados')}</li>
                <li>{t3(language, 'Données de télémétrie du widget/GTM (ping de statut, sans données personnelles des visiteurs)', 'Widget/GTM telemetry data (status ping, no visitor personal data)', 'Datos de telemetría del widget/GTM (ping de estado, sin datos personales de visitantes)')}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-2">{t3(language, 'Données de compte (si inscription) :', 'Account data (if registered):', 'Datos de cuenta (si está registrado):')}</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>{t3(language, 'Prénom et nom', 'First and last name', 'Nombre y apellido')}</li>
                <li>{t3(language, 'Adresse email', 'Email address', 'Dirección de correo electrónico')}</li>
                <li>{t3(language, 'Historique des achats de crédits', 'Credit purchase history', 'Historial de compras de créditos')}</li>
                <li>{t3(language, 'Solde de crédits', 'Credit balance', 'Saldo de créditos')}</li>
                <li>{t3(language, 'Tokens d\'accès Google Search Console / GA4 (chiffrés)', 'Google Search Console / GA4 access tokens (encrypted)', 'Tokens de acceso Google Search Console / GA4 (cifrados)')}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-2">{t3(language, 'Données de paiement :', 'Payment data:', 'Datos de pago:')}</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{t3(language, 'Les paiements sont traités par Stripe. Nous ne stockons pas vos données bancaires.', 'Payments are processed by Stripe. We do not store your banking data.', 'Los pagos son procesados por Stripe. No almacenamos sus datos bancarios.')}</li>
                <li>{t3(language, 'Seules les informations de transaction (montant, date, identifiant Stripe) sont conservées.', 'Only transaction information (amount, date, Stripe identifier) is retained.', 'Solo se conserva la información de la transacción (monto, fecha, identificador Stripe).')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '2. Utilisation des données', '2. Use of Data', '2. Uso de los datos')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Vos données sont utilisées pour :', 'Your data is used to:', 'Sus datos se utilizan para:')}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{t3(language, 'Fournir les résultats d\'analyse demandés', 'Provide requested analysis results', 'Proporcionar los resultados de análisis solicitados')}</li>
                <li>{t3(language, 'Gérer votre compte et vos crédits', 'Manage your account and credits', 'Gestionar su cuenta y sus créditos')}</li>
                <li>{t3(language, 'Traiter les transactions de paiement', 'Process payment transactions', 'Procesar las transacciones de pago')}</li>
                <li>{t3(language, 'Améliorer nos services et l\'expérience utilisateur', 'Improve our services and user experience', 'Mejorar nuestros servicios y la experiencia del usuario')}</li>
                <li>{t3(language, 'Envoyer des notifications transactionnelles (confirmations d\'achat)', 'Send transactional notifications (purchase confirmations)', 'Enviar notificaciones transaccionales (confirmaciones de compra)')}</li>
                <li>{t3(language, 'Générer des statistiques d\'utilisation anonymisées', 'Generate anonymized usage statistics', 'Generar estadísticas de uso anonimizadas')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '3. Sous-traitants', '3. Subcontractors', '3. Subcontratistas')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Nous faisons appel aux sous-traitants suivants :', 'We use the following subcontractors:', 'Utilizamos los siguientes subcontratistas:')}
              </p>
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div>
                  <p className="font-medium text-foreground">Stripe Payments Europe Ltd.</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Traitement des paiements. Les données transmises : email, montant, devise.', 'Payment processing. Data transmitted: email, amount, currency.', 'Procesamiento de pagos. Datos transmitidos: email, monto, divisa.')}</p>
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {t3(language, 'Politique de confidentialité Stripe', 'Stripe Privacy Policy', 'Política de privacidad de Stripe')}
                  </a>
                </div>
                <div>
                  <p className="font-medium text-foreground">Supabase Inc.</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Hébergement base de données et authentification. Serveurs européens.', 'Database hosting and authentication. European servers.', 'Alojamiento de base de datos y autenticación. Servidores europeos.')}</p>
                  <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {t3(language, 'Politique de confidentialité Supabase', 'Supabase Privacy Policy', 'Política de privacidad de Supabase')}
                  </a>
                </div>
                <div>
                  <p className="font-medium text-foreground">Lovable Technologies</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Hébergement de l\'application web.', 'Web application hosting.', 'Alojamiento de la aplicación web.')}</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '4. Cookies', '4. Cookies', '4. Cookies')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Notre site utilise des cookies techniques nécessaires au fonctionnement du site (authentification, préférences). Ces cookies ne collectent pas de données personnelles identifiables et sont exemptés de consentement conformément aux recommandations de la CNIL. Nous n\'utilisons pas de cookies publicitaires ou de tracking tiers.',
                  'Our site uses technical cookies necessary for the operation of the site (authentication, preferences). These cookies do not collect identifiable personal data and are exempt from consent in accordance with CNIL recommendations. We do not use advertising or third-party tracking cookies.',
                  'Nuestro sitio utiliza cookies técnicas necesarias para el funcionamiento del sitio (autenticación, preferencias). Estas cookies no recopilan datos personales identificables y están exentas de consentimiento de acuerdo con las recomendaciones de la CNIL. No utilizamos cookies publicitarias ni de seguimiento de terceros.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '5. Conservation des données', '5. Data Retention', '5. Conservación de los datos')}
              </h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>{t3(language, 'Données de compte :', 'Account data:', 'Datos de cuenta:')}</strong> {t3(language, 'conservées pendant la durée du compte, puis 3 ans après suppression pour obligations légales', 'retained for the duration of the account, then 3 years after deletion for legal obligations', 'conservados durante la vigencia de la cuenta, luego 3 años después de la eliminación por obligaciones legales')}</li>
                <li><strong>{t3(language, 'Données de paiement :', 'Payment data:', 'Datos de pago:')}</strong> {t3(language, 'conservées 10 ans conformément aux obligations comptables', 'retained 10 years in accordance with accounting obligations', 'conservados 10 años de acuerdo con las obligaciones contables')}</li>
                <li><strong>{t3(language, 'Rapports générés :', 'Generated reports:', 'Informes generados:')}</strong> {t3(language, 'conservés tant que le compte est actif', 'retained as long as the account is active', 'conservados mientras la cuenta esté activa')}</li>
                <li><strong>{t3(language, 'Données analytiques :', 'Analytical data:', 'Datos analíticos:')}</strong> {t3(language, 'anonymisées et conservées maximum 13 mois', 'anonymized and retained maximum 13 months', 'anonimizados y conservados un máximo de 13 meses')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '6. Partage des données', '6. Data Sharing', '6. Compartición de datos')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Nous ne vendons, n\'échangeons ni ne louons vos données personnelles à des tiers. Les données sont partagées uniquement avec nos sous-traitants techniques listés ci-dessus, et sur réquisition judiciaire le cas échéant.',
                  'We do not sell, trade or rent your personal data to third parties. Data is shared only with our technical subcontractors listed above, and upon judicial request if applicable.',
                  'No vendemos, intercambiamos ni alquilamos sus datos personales a terceros. Los datos se comparten únicamente con nuestros subcontratistas técnicos listados anteriormente, y por requisición judicial en su caso.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '7. Sécurité', '7. Security', '7. Seguridad')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées : chiffrement HTTPS, authentification sécurisée, accès restreint aux données. Les paiements sont sécurisés par Stripe, certifié PCI-DSS niveau 1.',
                  'We implement appropriate technical and organizational security measures: HTTPS encryption, secure authentication, restricted data access. Payments are secured by Stripe, PCI-DSS Level 1 certified.',
                  'Implementamos medidas de seguridad técnicas y organizativas apropiadas: cifrado HTTPS, autenticación segura, acceso restringido a los datos. Los pagos están asegurados por Stripe, certificado PCI-DSS nivel 1.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '8. Vos droits', '8. Your Rights', '8. Sus derechos')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Conformément au RGPD, vous disposez des droits suivants :', 'In accordance with the GDPR, you have the following rights:', 'De conformidad con el RGPD, usted dispone de los siguientes derechos:')}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{t3(language, 'Droit d\'accès à vos données personnelles', 'Right of access to your personal data', 'Derecho de acceso a sus datos personales')}</li>
                <li>{t3(language, 'Droit de rectification', 'Right to rectification', 'Derecho de rectificación')}</li>
                <li>{t3(language, 'Droit à l\'effacement ("droit à l\'oubli")', 'Right to erasure ("right to be forgotten")', 'Derecho de supresión ("derecho al olvido")')}</li>
                <li>{t3(language, 'Droit à la portabilité des données', 'Right to data portability', 'Derecho a la portabilidad de los datos')}</li>
                <li>{t3(language, 'Droit d\'opposition', 'Right to object', 'Derecho de oposición')}</li>
                <li>{t3(language, 'Droit de retirer votre consentement', 'Right to withdraw consent', 'Derecho a retirar su consentimiento')}</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                {t3(language,
                  'Pour exercer ces droits, contactez-nous à : contact@crawlers.fr. Nous répondrons sous 30 jours.',
                  'To exercise these rights, contact us at: contact@crawlers.fr. We will respond within 30 days.',
                  'Para ejercer estos derechos, contáctenos en: contact@crawlers.fr. Responderemos en un plazo de 30 días.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '9. Contact', '9. Contact', '9. Contacto')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Pour toute question concernant cette politique de confidentialité ou vos données personnelles :',
                  'For any questions regarding this privacy policy or your personal data:',
                  'Para cualquier pregunta relativa a esta política de privacidad o a sus datos personales:'
                )}
              </p>
              <div className="bg-muted/50 rounded-lg p-6 mt-4">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Email :</strong>{' '}
                  <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a>
                </p>
              </div>
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

export default PolitiqueConfidentialite;