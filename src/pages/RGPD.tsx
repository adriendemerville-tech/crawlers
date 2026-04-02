import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t3 } from '@/utils/i18n';

const RGPD = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/rgpd');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <html lang={language} />
        <title>{t3(language, 'RGPD - Protection des données | Crawlers.fr', 'GDPR - Data Protection | Crawlers.fr', 'RGPD - Protección de datos | Crawlers.fr')}</title>
        <meta name="description" content={t3(language, 'Conformité RGPD et protection des données personnelles sur Crawlers.fr', 'GDPR compliance and personal data protection on Crawlers.fr', 'Cumplimiento RGPD y protección de datos personales en Crawlers.fr')} />
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
            <div className="flex items-center gap-3 mb-8">
              <Shield className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold text-foreground m-0">
                RGPD / GDPR
              </h1>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-8">
              {t3(language,
                'Crawlers (Adrien de Volontat, entrepreneur individuel — SIRET 992 399 667 00011) s\'engage à respecter le Règlement Général sur la Protection des Données (RGPD) et à garantir la protection de vos données personnelles, y compris dans le cadre des transactions commerciales, de l\'injection de code correctif sur vos sites et des connexions CMS directes.',
                'Crawlers (Adrien de Volontat, sole proprietor — SIRET 992 399 667 00011) is committed to complying with the General Data Protection Regulation (GDPR) and ensuring the protection of your personal data, including in the context of commercial transactions, corrective code injection on your sites and direct CMS connections.',
                'Crawlers (Adrien de Volontat, empresario individual — SIRET 992 399 667 00011) se compromete a cumplir con el Reglamento General de Protección de Datos (RGPD) y a garantizar la protección de sus datos personales, incluso en el marco de las transacciones comerciales, la inyección de código correctivo en sus sitios y las conexiones CMS directas.'
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
                  <span>{t3(language, 'Paiements sécurisés via Stripe (PCI-DSS niveau 1) — aucune donnée bancaire stockée', 'Secure payments via Stripe (PCI-DSS Level 1) — no banking data stored', 'Pagos seguros a través de Stripe (PCI-DSS nivel 1) — ningún dato bancario almacenado')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Hébergement sur infrastructure européenne', 'Hosting on European infrastructure', 'Alojamiento en infraestructura europea')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Pas de vente ni partage de données à des tiers à des fins commerciales', 'No selling or sharing of data with third parties for commercial purposes', 'Sin venta ni intercambio de datos con terceros con fines comerciales')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Cookies techniques uniquement (exemptés de consentement CNIL)', 'Technical cookies only (CNIL consent exempt)', 'Solo cookies técnicas (exentas de consentimiento CNIL)')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Droit de rétractation de 14 jours sur les crédits non utilisés', '14-day withdrawal right on unused credits', 'Derecho de desistimiento de 14 días sobre los créditos no utilizados')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Injection de code correctif encapsulée (sandboxing sémantique), révocable à tout instant', 'Corrective code injection sandboxed (semantic isolation), revocable at any time', 'Inyección de código correctivo encapsulada (sandboxing semántico), revocable en cualquier momento')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Architecture « Data Firewall » : ségrégation stricte entre l\'écosystème Google et les LLMs tiers', '"Data Firewall" architecture: strict segregation between the Google ecosystem and third-party LLMs', 'Arquitectura «Data Firewall»: segregación estricta entre el ecosistema Google y los LLMs de terceros')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{t3(language, 'Connexions CMS (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo) : tokens chiffrés, révocables à tout moment', 'CMS connections (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo): encrypted tokens, revocable at any time', 'Conexiones CMS (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo): tokens cifrados, revocables en cualquier momento')}</span>
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
                <li><strong>{t3(language, 'Exécution du contrat :', 'Contract execution:', 'Ejecución del contrato:')}</strong> {t3(language, 'pour fournir les services gratuits et payants (audits SEO/GEO, codes correctifs, crawl multi-pages, audit comparé, suivi de visibilité IA, matrice d\'audit, graphes Cocoon, maintenance prédictive)', 'to provide free and paid services (SEO/GEO audits, corrective codes, multi-page crawl, comparative audit, AI visibility tracking, audit matrix, Cocoon graphs, predictive maintenance)', 'para proporcionar los servicios gratuitos y de pago (auditorías SEO/GEO, códigos correctivos, crawl multi-páginas, auditoría comparativa, seguimiento de visibilidad IA, matriz de auditoría, grafos Cocoon, mantenimiento predictivo)')}</li>
                <li><strong>{t3(language, 'Consentement explicite :', 'Explicit consent:', 'Consentimiento explícito:')}</strong> {t3(language, 'pour l\'injection de code correctif via widget ou GTM, la connexion OAuth Google (Search Console, GA4, Google My Business) et la connexion CMS (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo)', 'for corrective code injection via widget or GTM, Google OAuth connection (Search Console, GA4, Google My Business) and CMS connection (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo)', 'para la inyección de código correctivo vía widget o GTM, la conexión OAuth Google (Search Console, GA4, Google My Business) y la conexión CMS (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo)')}</li>
                <li><strong>{t3(language, 'Obligation légale :', 'Legal obligation:', 'Obligación legal:')}</strong> {t3(language, 'pour la conservation des données de facturation (10 ans)', 'for retention of billing data (10 years)', 'para la conservación de los datos de facturación (10 años)')}</li>
                <li><strong>{t3(language, 'Intérêt légitime :', 'Legitimate interest:', 'Interés legítimo:')}</strong> {t3(language, 'pour l\'amélioration de nos services et l\'analyse statistique anonymisée', 'for improving our services and anonymized statistical analysis', 'para la mejora de nuestros servicios y el análisis estadístico anonimizado')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '3. Données collectées', '3. Data Collected', '3. Datos recopilados')}
              </h2>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-2">{t3(language, 'Données d\'identification', 'Identification Data', 'Datos de identificación')}</h3>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>• {t3(language, 'Nom, prénom, adresse email (inscription)', 'Name, first name, email address (registration)', 'Nombre, apellido, dirección de correo electrónico (registro)')}</li>
                    <li>• {t3(language, 'Type de persona (indépendant, agence, e-commerce, etc.)', 'Persona type (freelancer, agency, e-commerce, etc.)', 'Tipo de persona (independiente, agencia, e-commerce, etc.)')}</li>
                    <li>• {t3(language, 'Clé API unique par site suivi (UUID auto-générée)', 'Unique API key per tracked site (auto-generated UUID)', 'Clave API única por sitio rastreado (UUID autogenerada)')}</li>
                    <li>• {t3(language, 'Code de parrainage (optionnel)', 'Referral code (optional)', 'Código de referido (opcional)')}</li>
                  </ul>
                </div>
                <div className="bg-muted/50 rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-2">{t3(language, 'Données d\'audit et d\'analyse', 'Audit and Analysis Data', 'Datos de auditoría y análisis')}</h3>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>• {t3(language, 'URLs analysées et résultats d\'audit (scores SEO/GEO, métriques PageSpeed, analyse crawlers, matrice d\'audit)', 'Analyzed URLs and audit results (SEO/GEO scores, PageSpeed metrics, crawler analysis, audit matrix)', 'URLs analizadas y resultados de auditoría (puntuaciones SEO/GEO, métricas PageSpeed, análisis de crawlers, matriz de auditoría)')}</li>
                    <li>• {t3(language, 'Rapports sauvegardés, plans d\'action et graphes sémantiques (Cocoon)', 'Saved reports, action plans and semantic graphs (Cocoon)', 'Informes guardados, planes de acción y grafos semánticos (Cocoon)')}</li>
                    <li>• {t3(language, 'Codes correctifs générés et configurations associées', 'Generated corrective codes and associated configurations', 'Códigos correctivos generados y configuraciones asociadas')}</li>
                    <li>• {t3(language, 'Données de crawl multi-pages (contenu HTML, structure, liens)', 'Multi-page crawl data (HTML content, structure, links)', 'Datos de crawl multi-páginas (contenido HTML, estructura, enlaces)')}</li>
                    <li>• {t3(language, 'Prédictions de trafic et scores d\'impact calculés par machine learning (métriques agrégées et anonymisées)', 'Traffic predictions and impact scores calculated by machine learning (aggregated and anonymized metrics)', 'Predicciones de tráfico y puntuaciones de impacto calculadas por machine learning (métricas agregadas y anonimizadas)')}</li>
                    <li>• {t3(language, 'Données d\'engagement GA4 agrégées (sessions, taux d\'engagement, taux de rebond, durée de session) — collectées via OAuth avec votre consentement explicite, conservées 13 mois', 'Aggregated GA4 engagement data (sessions, engagement rate, bounce rate, session duration) — collected via OAuth with your explicit consent, retained for 13 months', 'Datos de engagement GA4 agregados (sesiones, tasa de engagement, tasa de rebote, duración de sesión) — recopilados vía OAuth con su consentimiento explícito, conservados 13 meses')}</li>
                  </ul>
                </div>
                <div className="bg-muted/50 rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-2">{t3(language, 'Données de connectivité widget', 'Widget Connectivity Data', 'Datos de conectividad del widget')}</h3>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>• {t3(language, 'Domaine du site connecté (vérifié contre la clé API)', 'Connected site domain (verified against API key)', 'Dominio del sitio conectado (verificado contra la clave API)')}</li>
                    <li>• {t3(language, 'Horodatage du dernier ping widget (last_widget_ping)', 'Last widget ping timestamp (last_widget_ping)', 'Marca de tiempo del último ping del widget (last_widget_ping)')}</li>
                    <li>• {t3(language, 'Configuration courante du code injecté', 'Current configuration of injected code', 'Configuración actual del código inyectado')}</li>
                  </ul>
                </div>
                <div className="bg-muted/50 rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-2">{t3(language, 'Données de navigation (anonymes)', 'Navigation Data (anonymous)', 'Datos de navegación (anónimos)')}</h3>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>• {t3(language, 'Pages visitées, type d\'événement, identifiant de session (analytics internes, sans cookies tiers)', 'Pages visited, event type, session identifier (internal analytics, no third-party cookies)', 'Páginas visitadas, tipo de evento, identificador de sesión (analíticas internas, sin cookies de terceros)')}</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '4. Données de paiement', '4. Payment Data', '4. Datos de pago')}
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
                  <li>• {t3(language, 'Identifiant de transaction Stripe (stripe_session_id)', 'Stripe transaction identifier (stripe_session_id)', 'Identificador de transacción Stripe (stripe_session_id)')}</li>
                  <li>• {t3(language, 'Montant, date et type de la transaction (usage, purchase, bonus, referral, welcome, admin_credit)', 'Amount, date and transaction type (usage, purchase, bonus, referral, welcome, admin_credit)', 'Monto, fecha y tipo de transacción (usage, purchase, bonus, referral, welcome, admin_credit)')}</li>
                  <li>• {t3(language, 'Email associé au paiement', 'Email associated with payment', 'Email asociado al pago')}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '5. Sous-traitants et transferts de données', '5. Sub-processors and Data Transfers', '5. Subcontratistas y transferencias de datos')}
              </h2>
              <div className="bg-muted/50 rounded-lg p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-muted-foreground">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-semibold text-foreground">{t3(language, 'Sous-traitant', 'Sub-processor', 'Subcontratista')}</th>
                        <th className="text-left py-2 pr-4 font-semibold text-foreground">{t3(language, 'Finalité', 'Purpose', 'Finalidad')}</th>
                        <th className="text-left py-2 font-semibold text-foreground">{t3(language, 'Localisation', 'Location', 'Ubicación')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 pr-4">Stripe</td>
                        <td className="py-2 pr-4">{t3(language, 'Paiements sécurisés', 'Secure payments', 'Pagos seguros')}</td>
                        <td className="py-2">{t3(language, 'UE (Dublin)', 'EU (Dublin)', 'UE (Dublín)')}</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 pr-4">Lovable Technologies</td>
                        <td className="py-2 pr-4">{t3(language, 'Hébergement frontend', 'Frontend hosting', 'Alojamiento frontend')}</td>
                        <td className="py-2">{t3(language, 'UE', 'EU', 'UE')}</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 pr-4">Supabase Inc.</td>
                        <td className="py-2 pr-4">{t3(language, 'Infrastructure backend et base de données', 'Backend infrastructure and database', 'Infraestructura backend y base de datos')}</td>
                        <td className="py-2">{t3(language, 'UE', 'EU', 'UE')}</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4">Google / OpenAI</td>
                        <td className="py-2 pr-4">{t3(language, 'Génération de recommandations IA (données anonymisées)', 'AI recommendation generation (anonymized data)', 'Generación de recomendaciones IA (datos anonimizados)')}</td>
                        <td className="py-2">{t3(language, 'UE / États-Unis (clauses contractuelles types)', 'EU / United States (standard contractual clauses)', 'UE / Estados Unidos (cláusulas contractuales tipo)')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '6. Durées de conservation', '6. Retention Periods', '6. Plazos de conservación')}
              </h2>
              <div className="bg-muted/50 rounded-lg p-6">
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>• <strong className="text-foreground">{t3(language, 'Données de compte :', 'Account data:', 'Datos de cuenta:')}</strong> {t3(language, 'durée de l\'inscription + 3 ans après suppression', 'duration of registration + 3 years after deletion', 'duración del registro + 3 años después de la eliminación')}</li>
                  <li>• <strong className="text-foreground">{t3(language, 'Rapports et audits :', 'Reports and audits:', 'Informes y auditorías:')}</strong> {t3(language, 'durée de l\'inscription (supprimés avec le compte)', 'duration of registration (deleted with account)', 'duración del registro (eliminados con la cuenta)')}</li>
                  <li>• <strong className="text-foreground">{t3(language, 'Données de facturation :', 'Billing data:', 'Datos de facturación:')}</strong> {t3(language, '10 ans (obligation légale)', '10 years (legal obligation)', '10 años (obligación legal)')}</li>
                  <li>• <strong className="text-foreground">{t3(language, 'Cache d\'audit :', 'Audit cache:', 'Caché de auditoría:')}</strong> {t3(language, '24 heures (automatiquement purgé)', '24 hours (automatically purged)', '24 horas (purgado automáticamente)')}</li>
                  <li>• <strong className="text-foreground">{t3(language, 'Analytics de navigation :', 'Navigation analytics:', 'Analíticas de navegación:')}</strong> {t3(language, '13 mois (conformité CNIL)', '13 months (CNIL compliance)', '13 meses (conformidad CNIL)')}</li>
                  <li>• <strong className="text-foreground">{t3(language, 'Données de crawl :', 'Crawl data:', 'Datos de crawl:')}</strong> {t3(language, 'conservées tant que le site est suivi par l\'utilisateur', 'retained as long as the site is tracked by the user', 'conservados mientras el sitio sea rastreado por el usuario')}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '7. Sécurité des données', '7. Data Security', '7. Seguridad de los datos')}
              </h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{t3(language, 'Chiffrement en transit (TLS 1.3) et au repos', 'Encryption in transit (TLS 1.3) and at rest', 'Cifrado en tránsito (TLS 1.3) y en reposo')}</li>
                <li>{t3(language, 'Politiques RLS (Row-Level Security) sur toutes les tables sensibles : chaque utilisateur n\'accède qu\'à ses propres données', 'RLS (Row-Level Security) policies on all sensitive tables: each user only accesses their own data', 'Políticas RLS (Row-Level Security) en todas las tablas sensibles: cada usuario solo accede a sus propios datos')}</li>
                <li>{t3(language, 'Protection anti-tamper via trigger SQL sur les colonnes sensibles (credits_balance, plan_type, api_key)', 'Anti-tamper protection via SQL trigger on sensitive columns (credits_balance, plan_type, api_key)', 'Protección anti-manipulación mediante trigger SQL en columnas sensibles (credits_balance, plan_type, api_key)')}</li>
                <li>{t3(language, 'Limitation de débit : 15 audits par heure par utilisateur authentifié', 'Rate limiting: 15 audits per hour per authenticated user', 'Limitación de velocidad: 15 auditorías por hora por usuario autenticado')}</li>
                <li>{t3(language, 'Protection SSRF : validation des URLs avec blocage des IPs privées', 'SSRF protection: URL validation with private IP blocking', 'Protección SSRF: validación de URLs con bloqueo de IPs privadas')}</li>
                <li>{t3(language, 'Clés API gérées via secrets d\'environnement (jamais exposées côté client)', 'API keys managed via environment secrets (never exposed client-side)', 'Claves API gestionadas mediante secretos de entorno (nunca expuestas del lado del cliente)')}</li>
                <li>{t3(language, 'Injection de code correctif isolée par sandboxing sémantique (isolation DOM)', 'Corrective code injection isolated by semantic sandboxing (DOM isolation)', 'Inyección de código correctivo aislada por sandboxing semántico (aislamiento DOM)')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '8. Vos droits RGPD', '8. Your GDPR Rights', '8. Sus derechos RGPD')}
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
                  <p className="text-sm text-muted-foreground">{t3(language, 'Demander la suppression de vos données (sous réserve des obligations légales de conservation)', 'Request deletion of your data (subject to legal retention obligations)', 'Solicitar la eliminación de sus datos (sujeto a obligaciones legales de conservación)')}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">{t3(language, 'Droit à la portabilité', 'Right to Portability', 'Derecho a la portabilidad')}</h3>
                  <p className="text-sm text-muted-foreground">{t3(language, 'Recevoir vos données dans un format lisible par machine (JSON)', 'Receive your data in a machine-readable format (JSON)', 'Recibir sus datos en un formato legible por máquina (JSON)')}</p>
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
                {t3(language, '9. Exercer vos droits', '9. Exercise Your Rights', '9. Ejercer sus derechos')}
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
                    'Nous répondrons à votre demande dans un délai maximum de 30 jours. Vous pouvez également supprimer votre compte et vos données directement depuis votre console.',
                    'We will respond to your request within a maximum of 30 days. You can also delete your account and data directly from your console.',
                    'Responderemos a su solicitud en un plazo máximo de 30 días. También puede eliminar su cuenta y datos directamente desde su consola.'
                  )}
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '10. Réclamation auprès de la CNIL', '10. Complaint to the CNIL', '10. Reclamación ante la CNIL')}
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
              {t3(language, 'Dernière mise à jour : 12 mars 2026', 'Last updated: March 12, 2026', 'Última actualización: 12 de marzo de 2026')}
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RGPD;
