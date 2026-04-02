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
        <meta name="robots" content="noindex, nofollow" />
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
                'Crawlers AI (Adrien de Volontat, entrepreneur individuel — SIRET 992 399 667 00011) s\'engage à protéger la vie privée des utilisateurs de son site. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos données personnelles, y compris dans le cadre des transactions de paiement et des connexions CMS.',
                'Crawlers AI (Adrien de Volontat, sole proprietor — SIRET 992 399 667 00011) is committed to protecting the privacy of its website users. This privacy policy explains how we collect, use and protect your personal data, including in the context of payment transactions and CMS connections.',
                'Crawlers AI (Adrien de Volontat, empresario individual — SIRET 992 399 667 00011) se compromete a proteger la privacidad de los usuarios de su sitio. Esta política de privacidad explica cómo recopilamos, utilizamos y protegemos sus datos personales, incluso en el marco de las transacciones de pago y las conexiones CMS.'
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
                <li>{t3(language, 'URLs analysées via nos outils (audits SEO/GEO, crawls multi-pages, analyses concurrentielles, matrice d\'audit)', 'URLs analyzed via our tools (SEO/GEO audits, multi-page crawls, competitive analysis, audit matrix)', 'URLs analizadas a través de nuestras herramientas (auditorías SEO/GEO, crawls multi-páginas, análisis competitivo, matriz de auditoría)')}</li>
                <li>{t3(language, 'Données de navigation anonymisées (pages visitées, durée de visite)', 'Anonymized browsing data (pages visited, visit duration)', 'Datos de navegación anonimizados (páginas visitadas, duración de la visita)')}</li>
                <li>{t3(language, 'Préférences linguistiques', 'Language preferences', 'Preferencias lingüísticas')}</li>
                <li>{t3(language, 'Rapports, codes correctifs, graphes sémantiques (Cocoon) et plans d\'action générés', 'Generated reports, corrective codes, semantic graphs (Cocoon) and action plans', 'Informes, códigos correctivos, grafos semánticos (Cocoon) y planes de acción generados')}</li>
                <li>{t3(language, 'Données de télémétrie du widget/GTM (ping de statut, sans données personnelles des visiteurs)', 'Widget/GTM telemetry data (status ping, no visitor personal data)', 'Datos de telemetría del widget/GTM (ping de estado, sin datos personales de visitantes)')}</li>
                <li>{t3(language, 'Prédictions de trafic et scores d\'impact calculés par machine learning (métriques agrégées et anonymisées)', 'Traffic predictions and impact scores calculated by machine learning (aggregated and anonymized metrics)', 'Predicciones de tráfico y puntuaciones de impacto calculadas por machine learning (métricas agregadas y anonimizadas)')}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-2">{t3(language, 'Données de compte (si inscription) :', 'Account data (if registered):', 'Datos de cuenta (si está registrado):')}</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>{t3(language, 'Prénom et nom', 'First and last name', 'Nombre y apellido')}</li>
                <li>{t3(language, 'Adresse email', 'Email address', 'Dirección de correo electrónico')}</li>
                <li>{t3(language, 'Type de persona (indépendant, agence, e-commerce, etc.)', 'Persona type (freelancer, agency, e-commerce, etc.)', 'Tipo de persona (independiente, agencia, e-commerce, etc.)')}</li>
                <li>{t3(language, 'Historique des achats de crédits et abonnements (Pro Agency, Pro Agency+)', 'Credit purchases and subscription history (Pro Agency, Pro Agency+)', 'Historial de compras de créditos y suscripciones (Pro Agency, Pro Agency+)')}</li>
                <li>{t3(language, 'Solde de crédits', 'Credit balance', 'Saldo de créditos')}</li>
                <li>{t3(language, 'Tokens d\'accès Google Search Console / GA4 (chiffrés, stockés côté serveur)', 'Google Search Console / GA4 access tokens (encrypted, stored server-side)', 'Tokens de acceso Google Search Console / GA4 (cifrados, almacenados del lado del servidor)')}</li>
                <li>{t3(language, 'Identifiants CMS (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo) : clés API ou tokens OAuth chiffrés', 'CMS credentials (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo): encrypted API keys or OAuth tokens', 'Credenciales CMS (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo): claves API o tokens OAuth cifrados')}</li>
                <li>{t3(language, 'Connexion Google My Business (OAuth, optionnelle)', 'Google My Business connection (OAuth, optional)', 'Conexión Google My Business (OAuth, opcional)')}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-2">{t3(language, 'Données de paiement :', 'Payment data:', 'Datos de pago:')}</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>{t3(language, 'Les paiements sont traités exclusivement par Stripe Payments Europe Ltd. (Dublin, Irlande). Nous ne stockons jamais vos données bancaires.', 'Payments are processed exclusively by Stripe Payments Europe Ltd. (Dublin, Ireland). We never store your banking data.', 'Los pagos son procesados exclusivamente por Stripe Payments Europe Ltd. (Dublín, Irlanda). Nunca almacenamos sus datos bancarios.')}</li>
                <li>{t3(language, 'Seules les informations de transaction (montant, date, identifiant Stripe, type d\'achat) sont conservées.', 'Only transaction information (amount, date, Stripe identifier, purchase type) is retained.', 'Solo se conserva la información de la transacción (monto, fecha, identificador Stripe, tipo de compra).')}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-2">{t3(language, 'Données d\'équipe agence :', 'Agency team data:', 'Datos del equipo de agencia:')}</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{t3(language, 'Liste des membres d\'équipe et clients rattachés (nom, email, rôle)', 'Team member and client list (name, email, role)', 'Lista de miembros del equipo y clientes asociados (nombre, email, rol)')}</li>
                <li>{t3(language, 'Invitations envoyées et acceptées', 'Sent and accepted invitations', 'Invitaciones enviadas y aceptadas')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '2. Bases légales du traitement', '2. Legal Bases for Processing', '2. Bases legales del tratamiento')}
              </h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>{t3(language, 'Exécution du contrat :', 'Performance of contract:', 'Ejecución del contrato:')}</strong> {t3(language, 'gestion du compte, fourniture des services d\'audit, traitement des paiements', 'account management, provision of audit services, payment processing', 'gestión de la cuenta, prestación de servicios de auditoría, procesamiento de pagos')}</li>
                <li><strong>{t3(language, 'Intérêt légitime :', 'Legitimate interest:', 'Interés legítimo:')}</strong> {t3(language, 'amélioration du service, statistiques anonymisées, sécurité de la plateforme', 'service improvement, anonymized statistics, platform security', 'mejora del servicio, estadísticas anonimizadas, seguridad de la plataforma')}</li>
                <li><strong>{t3(language, 'Obligation légale :', 'Legal obligation:', 'Obligación legal:')}</strong> {t3(language, 'conservation des données de facturation (10 ans)', 'retention of billing data (10 years)', 'conservación de los datos de facturación (10 años)')}</li>
                <li><strong>{t3(language, 'Consentement :', 'Consent:', 'Consentimiento:')}</strong> {t3(language, 'connexion Google Search Console / GA4 / Google My Business (OAuth), connexion CMS (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo), injection de code via widget', 'Google Search Console / GA4 / Google My Business connection (OAuth), CMS connection (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo), code injection via widget', 'conexión Google Search Console / GA4 / Google My Business (OAuth), conexión CMS (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo), inyección de código via widget')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '3. Utilisation des données', '3. Use of Data', '3. Uso de los datos')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Vos données sont utilisées pour :', 'Your data is used to:', 'Sus datos se utilizan para:')}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{t3(language, 'Fournir les résultats d\'analyse demandés', 'Provide requested analysis results', 'Proporcionar los resultados de análisis solicitados')}</li>
                <li>{t3(language, 'Gérer votre compte et vos crédits', 'Manage your account and credits', 'Gestionar su cuenta y sus créditos')}</li>
                <li>{t3(language, 'Traiter les transactions de paiement', 'Process payment transactions', 'Procesar las transacciones de pago')}</li>
                <li>{t3(language, 'Améliorer nos services et l\'expérience utilisateur', 'Improve our services and user experience', 'Mejorar nuestros servicios y la experiencia del usuario')}</li>
                <li>{t3(language, 'Envoyer des notifications transactionnelles (confirmations d\'achat, alertes de suivi)', 'Send transactional notifications (purchase confirmations, tracking alerts)', 'Enviar notificaciones transaccionales (confirmaciones de compra, alertas de seguimiento)')}</li>
                <li>{t3(language, 'Générer des statistiques d\'utilisation anonymisées', 'Generate anonymized usage statistics', 'Generar estadísticas de uso anonimizadas')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '4. Sous-traitants', '4. Subcontractors', '4. Subcontratistas')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Nous faisons appel aux sous-traitants suivants :', 'We use the following subcontractors:', 'Utilizamos los siguientes subcontratistas:')}
              </p>
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div>
                  <p className="font-medium text-foreground">Stripe Payments Europe Ltd.</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Traitement des paiements. Données transmises : email, montant, devise. Certifié PCI-DSS niveau 1.', 'Payment processing. Data transmitted: email, amount, currency. PCI-DSS Level 1 certified.', 'Procesamiento de pagos. Datos transmitidos: email, monto, divisa. Certificado PCI-DSS nivel 1.')}</p>
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {t3(language, 'Politique de confidentialité Stripe', 'Stripe Privacy Policy', 'Política de privacidad de Stripe')}
                  </a>
                </div>
                <div>
                  <p className="font-medium text-foreground">Supabase Inc.</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Hébergement base de données, authentification, stockage fichiers. Serveurs UE (AWS eu-west-1).', 'Database hosting, authentication, file storage. EU servers (AWS eu-west-1).', 'Alojamiento de base de datos, autenticación, almacenamiento de archivos. Servidores UE (AWS eu-west-1).')}</p>
                  <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {t3(language, 'Politique de confidentialité Supabase', 'Supabase Privacy Policy', 'Política de privacidad de Supabase')}
                  </a>
                </div>
                <div>
                  <p className="font-medium text-foreground">Lovable Technologies</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Hébergement de l\'application web.', 'Web application hosting.', 'Alojamiento de la aplicación web.')}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">OpenAI / OpenRouter</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Génération de recommandations IA. Données transmises : contenu HTML public analysé (aucune donnée personnelle). Aucun entraînement sur les données.', 'AI recommendation generation. Data transmitted: analyzed public HTML content (no personal data). No training on data.', 'Generación de recomendaciones IA. Datos transmitidos: contenido HTML público analizado (sin datos personales). Sin entrenamiento con los datos.')}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Google LLC</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'APIs PageSpeed Insights, Search Console et Analytics (GA4). Connexion OAuth optionnelle initiée par l\'utilisateur.', 'PageSpeed Insights, Search Console and Analytics (GA4) APIs. Optional OAuth connection initiated by the user.', 'APIs PageSpeed Insights, Search Console y Analytics (GA4). Conexión OAuth opcional iniciada por el usuario.')}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">DataForSEO</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Données SERP et backlinks. Données transmises : domaines et URLs publics.', 'SERP and backlink data. Data transmitted: public domains and URLs.', 'Datos SERP y backlinks. Datos transmitidos: dominios y URLs públicos.')}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Firecrawl / Fly.io</p>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Services de crawl et rendu de pages. Données transmises : URLs publiques à analyser.', 'Crawl and page rendering services. Data transmitted: public URLs to analyze.', 'Servicios de crawl y renderizado de páginas. Datos transmitidos: URLs públicas a analizar.')}</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '5. Cookies', '5. Cookies', '5. Cookies')}
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
                {t3(language, '6. Conservation des données', '6. Data Retention', '6. Conservación de los datos')}
              </h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>{t3(language, 'Cache d\'audit :', 'Audit cache:', 'Caché de auditoría:')}</strong> {t3(language, '24 heures (suppression automatique)', '24 hours (automatic deletion)', '24 horas (eliminación automática)')}</li>
                <li><strong>{t3(language, 'Données de compte :', 'Account data:', 'Datos de cuenta:')}</strong> {t3(language, 'conservées pendant la durée du compte, puis 3 ans après suppression pour obligations légales', 'retained for the duration of the account, then 3 years after deletion for legal obligations', 'conservados durante la vigencia de la cuenta, luego 3 años después de la eliminación por obligaciones legales')}</li>
                <li><strong>{t3(language, 'Données de paiement :', 'Payment data:', 'Datos de pago:')}</strong> {t3(language, 'conservées 10 ans conformément aux obligations comptables (art. L123-22 du Code de commerce)', 'retained 10 years in accordance with accounting obligations (art. L123-22 French Commercial Code)', 'conservados 10 años de acuerdo con las obligaciones contables (art. L123-22 del Código de Comercio)')}</li>
                <li><strong>{t3(language, 'Rapports et graphes sémantiques :', 'Reports and semantic graphs:', 'Informes y grafos semánticos:')}</strong> {t3(language, 'conservés tant que le compte est actif', 'retained as long as the account is active', 'conservados mientras la cuenta esté activa')}</li>
                <li><strong>{t3(language, 'Données analytiques :', 'Analytical data:', 'Datos analíticos:')}</strong> {t3(language, 'anonymisées et conservées maximum 13 mois (recommandation CNIL)', 'anonymized and retained maximum 13 months (CNIL recommendation)', 'anonimizados y conservados un máximo de 13 meses (recomendación CNIL)')}</li>
                <li><strong>{t3(language, 'Conversations LLM depth :', 'LLM depth conversations:', 'Conversaciones LLM depth:')}</strong> {t3(language, 'expiration automatique après 24 heures', 'automatic expiration after 24 hours', 'expiración automática después de 24 horas')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '7. Partage des données', '7. Data Sharing', '7. Compartición de datos')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Nous ne vendons, n\'échangeons ni ne louons vos données personnelles à des tiers. Les données sont partagées uniquement avec nos sous-traitants techniques listés ci-dessus, dans le strict cadre de l\'exécution du service, et sur réquisition judiciaire le cas échéant.',
                  'We do not sell, trade or rent your personal data to third parties. Data is shared only with our technical subcontractors listed above, strictly within the framework of service execution, and upon judicial request if applicable.',
                  'No vendemos, intercambiamos ni alquilamos sus datos personales a terceros. Los datos se comparten únicamente con nuestros subcontratistas técnicos listados anteriormente, en el estricto marco de la ejecución del servicio, y por requisición judicial en su caso.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '8. Sécurité', '8. Security', '8. Seguridad')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées : chiffrement HTTPS, authentification sécurisée, Row-Level Security (RLS) sur toutes les tables de données, verrous SQL anti-tamper sur les champs sensibles (crédits, plan, abonnement), sandboxing sémantique des scripts injectés. Les paiements sont sécurisés par Stripe, certifié PCI-DSS niveau 1.',
                  'We implement appropriate technical and organizational security measures: HTTPS encryption, secure authentication, Row-Level Security (RLS) on all data tables, SQL anti-tamper locks on sensitive fields (credits, plan, subscription), semantic sandboxing of injected scripts. Payments are secured by Stripe, PCI-DSS Level 1 certified.',
                  'Implementamos medidas de seguridad técnicas y organizativas apropiadas: cifrado HTTPS, autenticación segura, Row-Level Security (RLS) en todas las tablas de datos, bloqueos SQL anti-manipulación en campos sensibles (créditos, plan, suscripción), sandboxing semántico de los scripts inyectados. Los pagos están asegurados por Stripe, certificado PCI-DSS nivel 1.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '9. Vos droits', '9. Your Rights', '9. Sus derechos')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Conformément au RGPD (Règlement UE 2016/679), vous disposez des droits suivants :', 'In accordance with the GDPR (EU Regulation 2016/679), you have the following rights:', 'De conformidad con el RGPD (Reglamento UE 2016/679), usted dispone de los siguientes derechos:')}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{t3(language, 'Droit d\'accès à vos données personnelles (art. 15)', 'Right of access to your personal data (art. 15)', 'Derecho de acceso a sus datos personales (art. 15)')}</li>
                <li>{t3(language, 'Droit de rectification (art. 16)', 'Right to rectification (art. 16)', 'Derecho de rectificación (art. 16)')}</li>
                <li>{t3(language, 'Droit à l\'effacement — "droit à l\'oubli" (art. 17)', 'Right to erasure — "right to be forgotten" (art. 17)', 'Derecho de supresión — "derecho al olvido" (art. 17)')}</li>
                <li>{t3(language, 'Droit à la limitation du traitement (art. 18)', 'Right to restriction of processing (art. 18)', 'Derecho a la limitación del tratamiento (art. 18)')}</li>
                <li>{t3(language, 'Droit à la portabilité des données (art. 20)', 'Right to data portability (art. 20)', 'Derecho a la portabilidad de los datos (art. 20)')}</li>
                <li>{t3(language, 'Droit d\'opposition (art. 21)', 'Right to object (art. 21)', 'Derecho de oposición (art. 21)')}</li>
                <li>{t3(language, 'Droit de retirer votre consentement à tout moment', 'Right to withdraw consent at any time', 'Derecho a retirar su consentimiento en cualquier momento')}</li>
                <li>{t3(language, 'Droit d\'introduire une réclamation auprès de la CNIL (cnil.fr)', 'Right to lodge a complaint with the CNIL (cnil.fr)', 'Derecho a presentar una reclamación ante la CNIL (cnil.fr)')}</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                {t3(language,
                  'Pour exercer ces droits, contactez-nous à : contact@crawlers.fr. Nous répondrons sous 30 jours conformément au RGPD.',
                  'To exercise these rights, contact us at: contact@crawlers.fr. We will respond within 30 days in accordance with the GDPR.',
                  'Para ejercer estos derechos, contáctenos en: contact@crawlers.fr. Responderemos en un plazo de 30 días conforme al RGPD.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '10. Contact & Responsable du traitement', '10. Contact & Data Controller', '10. Contacto & Responsable del tratamiento')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Pour toute question concernant cette politique de confidentialité ou vos données personnelles :',
                  'For any questions regarding this privacy policy or your personal data:',
                  'Para cualquier pregunta relativa a esta política de privacidad o a sus datos personales:'
                )}
              </p>
              <div className="bg-muted/50 rounded-lg p-6 mt-4 space-y-2">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{t3(language, 'Responsable du traitement :', 'Data Controller:', 'Responsable del tratamiento:')}</strong> Adrien de Volontat
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Email :</strong>{' '}
                  <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a>
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{t3(language, 'Autorité de contrôle :', 'Supervisory authority:', 'Autoridad de control:')}</strong>{' '}
                  <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">CNIL — cnil.fr</a>
                </p>
              </div>
            </section>

            <p className="text-sm text-muted-foreground mt-12">
              {t3(language, 'Dernière mise à jour : 16 mars 2026', 'Last updated: March 16, 2026', 'Última actualización: 16 de marzo de 2026')}
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PolitiqueConfidentialite;