import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t3 } from '@/utils/i18n';

const ConditionsUtilisation = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/conditions-utilisation');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <html lang={language} />
        <title>{t3(language, 'Conditions d\'utilisation | Crawlers.fr', 'Terms of Use | Crawlers.fr', 'Condiciones de uso | Crawlers.fr')}</title>
        <meta name="description" content={t3(language, 'Conditions générales d\'utilisation de Crawlers.fr', 'Terms of use for Crawlers.fr', 'Condiciones de uso de Crawlers.fr')} />
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
              {t3(language, 'Conditions Générales d\'Utilisation et de Vente (CGU/CGV)', 'Terms of Use and Sale', 'Términos de Uso y Venta')}
            </h1>

            <p className="text-muted-foreground leading-relaxed mb-8">
              {t3(language,
                'En accédant et en utilisant le site Crawlers AI, vous acceptez sans réserve les présentes conditions générales d\'utilisation et de vente. Ces conditions régissent l\'accès aux services gratuits et payants proposés par la plateforme.',
                'By accessing and using the Crawlers AI website, you unconditionally accept these terms of use and sale. These terms govern access to both free and paid services offered by the platform.',
                'Al acceder y utilizar el sitio Crawlers AI, usted acepta sin reservas los presentes términos de uso y venta. Estos términos rigen el acceso a los servicios gratuitos y de pago ofrecidos por la plataforma.'
              )}
            </p>

            {/* 1. Objet */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '1. Objet', '1. Purpose', '1. Objeto')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Crawlers AI est une plateforme proposant des outils d\'analyse SEO et GEO pour optimiser la visibilité des sites web auprès des moteurs de recherche traditionnels et des moteurs de recherche IA (ChatGPT, Perplexity, Claude, etc.). La plateforme propose des services gratuits (outils d\'analyse, audit technique), des services payants (audit stratégique, audit comparé, crawl multi-pages, codes correctifs) accessibles via un système de crédits prépayés, ainsi qu\'un abonnement mensuel Pro Agency.',
                  'Crawlers AI is a platform offering SEO and GEO analysis tools to optimize website visibility for traditional search engines and AI search engines (ChatGPT, Perplexity, Claude, etc.). The platform offers free services (analysis tools, technical audit), paid services (strategic audit, compared audit, multi-page crawl, corrective codes) accessible via a prepaid credit system, and a monthly Pro Agency subscription.',
                  'Crawlers AI es una plataforma que ofrece herramientas de análisis SEO y GEO para optimizar la visibilidad de los sitios web en los motores de búsqueda tradicionales y los motores de búsqueda IA (ChatGPT, Perplexity, Claude, etc.). La plataforma ofrece servicios gratuitos (herramientas de análisis, auditoría técnica), servicios de pago (auditoría estratégica, auditoría comparada, crawl multi-páginas, códigos correctivos) accesibles mediante un sistema de créditos prepagados, así como una suscripción mensual Pro Agency.'
                )}
              </p>
            </section>

            {/* 2. Accès aux services */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '2. Accès aux services', '2. Access to Services', '2. Acceso a los servicios')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Les services de Crawlers AI sont répartis en quatre catégories :', 'Crawlers AI services are divided into four categories:', 'Los servicios de Crawlers AI se dividen en cuatro categorías:')}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>{t3(language, 'Services gratuits sans inscription :', 'Free services without registration:', 'Servicios gratuitos sin registro:')}</strong> {t3(language, 'Analyse des bots IA, Score GEO, Visibilité LLM, PageSpeed', 'AI bot analysis, GEO Score, LLM Visibility, PageSpeed', 'Análisis de bots IA, Score GEO, Visibilidad LLM, PageSpeed')}</li>
                <li><strong>{t3(language, 'Services gratuits avec inscription :', 'Free services with registration:', 'Servicios gratuitos con registro:')}</strong> {t3(language, 'Audit technique SEO complet (200 points), 2 premiers audits stratégiques offerts, crédits de bienvenue automatiques', 'Complete technical SEO audit (200 points), first 2 strategic audits free, automatic welcome credits', 'Auditoría técnica SEO completa (200 puntos), 2 primeras auditorías estratégicas gratuitas, créditos de bienvenida automáticos')}</li>
                <li><strong>{t3(language, 'Services premium payants :', 'Premium paid services:', 'Servicios premium de pago:')}</strong> {t3(language, 'Audit stratégique IA (2 crédits), Audit comparé (4 crédits), Crawl multi-pages (1 crédit / 50 pages), modules de codes correctifs (1 crédit ou paiement unique)', 'Strategic AI audit (2 credits), Compared audit (4 credits), Multi-page crawl (1 credit / 50 pages), corrective code modules (1 credit or one-time payment)', 'Auditoría estratégica IA (2 créditos), Auditoría comparada (4 créditos), Crawl multi-páginas (1 crédito / 50 páginas), módulos de códigos correctivos (1 crédito o pago único)')}</li>
                <li><strong>{t3(language, 'Abonnement Pro Agency :', 'Pro Agency Subscription:', 'Suscripción Pro Agency:')}</strong> {t3(language, '59€/mois sans engagement – audits experts et codes correctifs illimités, console multi-comptes, marque blanche, support prioritaire, crawl multi-pages (Fair Use : 5 000 pages/mois incluses)', '€59/month no commitment – unlimited expert audits and corrective codes, multi-account console, white label, priority support, multi-page crawl (Fair Use: 5,000 pages/month included)', '59€/mes sin compromiso – auditorías expertas y códigos correctivos ilimitados, consola multi-cuentas, marca blanca, soporte prioritario, crawl multi-páginas (Fair Use: 5.000 páginas/mes incluidas)')}</li>
              </ul>
            </section>

            {/* 3. Tarification */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '3. Tarification et modalités de paiement', '3. Pricing and Payment Terms', '3. Precios y modalidades de pago')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'Les prix sont indiqués en euros TTC. Les paiements sont sécurisés par Stripe.', 'Prices are indicated in euros including VAT. Payments are secured by Stripe.', 'Los precios se indican en euros IVA incluido. Los pagos están asegurados por Stripe.')}
              </p>
              <div className="bg-muted/50 rounded-lg p-6 mb-4">
                <h3 className="font-semibold text-foreground mb-3">{t3(language, 'Packs de crédits :', 'Credit packs:', 'Paquetes de créditos:')}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t3(language, 'Essentiel : 10 crédits = 5€ TTC', 'Essential: 10 credits = €5 incl. VAT', 'Esencial: 10 créditos = 5€ IVA incl.')}</li>
                  <li>• {t3(language, 'Pro : 50 crédits = 19€ TTC', 'Pro: 50 credits = €19 incl. VAT', 'Pro: 50 créditos = 19€ IVA incl.')}</li>
                  <li>• {t3(language, 'Premium : 150 crédits = 45€ TTC', 'Premium: 150 credits = €45 incl. VAT', 'Premium: 150 créditos = 45€ IVA incl.')}</li>
                  <li>• <strong>{t3(language, 'Pack Ultime : 500 crédits = 99€ TTC', 'Ultimate Pack: 500 credits = €99 incl. VAT', 'Pack Último: 500 créditos = 99€ IVA incl.')}</strong></li>
                </ul>
              </div>
              <div className="bg-muted/50 rounded-lg p-6 mb-4">
                <h3 className="font-semibold text-foreground mb-3">{t3(language, 'Abonnement Pro Agency :', 'Pro Agency Subscription:', 'Suscripción Pro Agency:')}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t3(language, '59€ TTC / mois, sans engagement, résiliable à tout moment', '€59 incl. VAT / month, no commitment, cancellable at any time', '59€ IVA incl. / mes, sin compromiso, cancelable en cualquier momento')}</li>
                  <li>• {t3(language, 'Inclut : audits experts illimités, codes correctifs illimités, console multi-comptes, marque blanche, support prioritaire', 'Includes: unlimited expert audits, unlimited corrective codes, multi-account console, white label, priority support', 'Incluye: auditorías expertas ilimitadas, códigos correctivos ilimitados, consola multi-cuentas, marca blanca, soporte prioritario')}</li>
                  <li>• {t3(language, 'Crawl multi-pages : Fair Use Policy de 5 000 pages/mois incluses', 'Multi-page crawl: Fair Use Policy of 5,000 pages/month included', 'Crawl multi-páginas: Fair Use Policy de 5.000 páginas/mes incluidas')}</li>
                </ul>
              </div>
              <div className="bg-muted/50 rounded-lg p-6 mb-4">
                <h3 className="font-semibold text-foreground mb-3">{t3(language, 'Coût par service (en crédits) :', 'Cost per service (in credits):', 'Coste por servicio (en créditos):')}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t3(language, 'Audit Expert stratégique : 2 crédits', 'Strategic Expert Audit: 2 credits', 'Auditoría Experta estratégica: 2 créditos')}</li>
                  <li>• {t3(language, 'Audit Comparé (2 sites) : 4 crédits', 'Compared Audit (2 sites): 4 credits', 'Auditoría Comparada (2 sitios): 4 créditos')}</li>
                  <li>• {t3(language, 'Crawl Multi-pages : 1 crédit pour 50 pages', 'Multi-page Crawl: 1 credit per 50 pages', 'Crawl Multi-páginas: 1 crédito por 50 páginas')}</li>
                </ul>
              </div>
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-3">{t3(language, 'Codes correctifs (paiement unique) :', 'Corrective codes (one-time payment):', 'Códigos correctivos (pago único):')}</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t3(language, 'Module basique : 3€ TTC', 'Basic module: €3 incl. VAT', 'Módulo básico: 3€ IVA incl.')}</li>
                  <li>• {t3(language, 'Module avancé : 6€ TTC', 'Advanced module: €6 incl. VAT', 'Módulo avanzado: 6€ IVA incl.')}</li>
                  <li>• {t3(language, 'Module complet : 12€ TTC', 'Complete module: €12 incl. VAT', 'Módulo completo: 12€ IVA incl.')}</li>
                </ul>
              </div>
            </section>

            {/* 4. Droit de rétractation */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '4. Droit de rétractation', '4. Right of Withdrawal', '4. Derecho de desistimiento')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language,
                  'Conformément aux articles L.221-18 et suivants du Code de la consommation, vous disposez d\'un délai de 14 jours à compter de l\'achat pour exercer votre droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.',
                  'In accordance with articles L.221-18 et seq. of the French Consumer Code, you have a period of 14 days from the purchase to exercise your right of withdrawal, without having to justify reasons or pay penalties.',
                  'De conformidad con los artículos L.221-18 y siguientes del Código de Consumo francés, usted dispone de un plazo de 14 días desde la compra para ejercer su derecho de desistimiento, sin necesidad de justificar motivos ni pagar penalización alguna.'
                )}
              </p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                <p className="text-muted-foreground">
                  <strong className="text-amber-600 dark:text-amber-400">{t3(language, 'Exception :', 'Exception:', 'Excepción:')}</strong>{' '}
                  {t3(language,
                    'Conformément à l\'article L.221-28 du Code de la consommation, le droit de rétractation ne peut être exercé pour les contenus numériques non fournis sur un support matériel dont l\'exécution a commencé après accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation. Cela inclut les crédits utilisés, les rapports d\'audit générés, les codes correctifs générés et consultés, et les abonnements Pro Agency dès le début de leur exécution.',
                    'In accordance with article L.221-28 of the French Consumer Code, the right of withdrawal cannot be exercised for digital content not supplied on a tangible medium the execution of which has begun after the consumer\'s prior express consent and acknowledgment that they thereby forfeit their right of withdrawal. This includes used credits, generated audit reports, corrective codes that have been generated and viewed, and Pro Agency subscriptions once execution has begun.',
                    'De conformidad con el artículo L.221-28 del Código de Consumo francés, el derecho de desistimiento no puede ejercerse para los contenidos digitales no suministrados en un soporte material cuya ejecución haya comenzado tras el consentimiento previo expreso del consumidor y la renuncia expresa a su derecho de desistimiento. Esto incluye los créditos utilizados, los informes de auditoría generados, los códigos correctivos generados y consultados, y las suscripciones Pro Agency desde el inicio de su ejecución.'
                  )}
                </p>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Pour exercer votre droit de rétractation sur des crédits non utilisés, contactez-nous à contact@crawlers.fr avec votre numéro de commande.',
                  'To exercise your right of withdrawal on unused credits, contact us at contact@crawlers.fr with your order number.',
                  'Para ejercer su derecho de desistimiento sobre créditos no utilizados, contáctenos en contact@crawlers.fr con su número de pedido.'
                )}
              </p>
            </section>

            {/* 5. Livraison */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '5. Livraison des services numériques', '5. Delivery of Digital Services', '5. Entrega de servicios digitales')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Les crédits sont crédités sur votre compte immédiatement après confirmation du paiement par Stripe. Les rapports d\'audit et les codes correctifs sont générés et accessibles instantanément après utilisation des crédits. Les contenus numériques sont disponibles dans votre espace personnel. L\'abonnement Pro Agency est activé immédiatement après confirmation du paiement.',
                  'Credits are credited to your account immediately after payment confirmation by Stripe. Audit reports and corrective codes are generated and accessible instantly after using credits. Digital content is available in your personal space. The Pro Agency subscription is activated immediately after payment confirmation.',
                  'Los créditos se acreditan en su cuenta inmediatamente después de la confirmación del pago por Stripe. Los informes de auditoría y los códigos correctivos se generan y son accesibles instantáneamente tras el uso de los créditos. Los contenidos digitales están disponibles en su espacio personal. La suscripción Pro Agency se activa inmediatamente tras la confirmación del pago.'
                )}
              </p>
            </section>

            {/* 5 bis. Injection de code */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '5 bis. Injection de code via Widget / GTM', '5a. Code Injection via Widget / GTM', '5 bis. Inyección de código via Widget / GTM')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language,
                  'La fonctionnalité « Code correctif » permet à l\'utilisateur de générer un script JavaScript encapsulé, injectable sur son site via un widget dédié ou Google Tag Manager (GTM). L\'opération est volontaire, initiée par l\'utilisateur, et entièrement réversible.',
                  'The "Corrective code" feature allows the user to generate an encapsulated JavaScript script, injectable on their site via a dedicated widget or Google Tag Manager (GTM). The operation is voluntary, initiated by the user, and fully reversible.',
                  'La funcionalidad « Código correctivo » permite al usuario generar un script JavaScript encapsulado, inyectable en su sitio a través de un widget dedicado o Google Tag Manager (GTM). La operación es voluntaria, iniciada por el usuario y completamente reversible.'
                )}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>{t3(language, 'Le code est exécuté en sandboxing sémantique (isolation du DOM)', 'The code runs in semantic sandboxing (DOM isolation)', 'El código se ejecuta en sandboxing semántico (aislamiento del DOM)')}</li>
                <li>{t3(language, 'Aucune donnée personnelle n\'est collectée par le script', 'No personal data is collected by the script', 'El script no recopila datos personales')}</li>
                <li>{t3(language, 'L\'utilisateur peut désactiver ou supprimer le script à tout moment', 'The user can disable or remove the script at any time', 'El usuario puede desactivar o eliminar el script en cualquier momento')}</li>
              </ul>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-muted-foreground">
                  <strong className="text-amber-600 dark:text-amber-400">{t3(language, 'Responsabilité :', 'Liability:', 'Responsabilidad:')}</strong>{' '}
                  {t3(language,
                    'Crawlers AI ne saurait être tenu responsable des effets de l\'injection de code sur un site tiers. L\'utilisateur est seul responsable de la validation, du déploiement et de la surveillance du script sur son propre site.',
                    'Crawlers AI cannot be held liable for the effects of code injection on a third-party site. The user is solely responsible for the validation, deployment, and monitoring of the script on their own site.',
                    'Crawlers AI no podrá ser considerado responsable de los efectos de la inyección de código en un sitio de terceros. El usuario es el único responsable de la validación, despliegue y supervisión del script en su propio sitio.'
                  )}
                </p>
              </div>
            </section>

            {/* 6. Validité des crédits */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '6. Durée de validité des crédits', '6. Credit Validity Period', '6. Período de validez de los créditos')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language,
                  'Les crédits achetés sont valables sans limitation de durée. Ils restent utilisables tant que votre compte est actif. En cas de suppression de compte à votre demande, les crédits non utilisés sont perdus.',
                  'Purchased credits are valid without time limit. They remain usable as long as your account is active. If your account is deleted at your request, unused credits are forfeited.',
                  'Los créditos comprados son válidos sin límite de tiempo. Permanecen utilizables mientras su cuenta esté activa. En caso de eliminación de la cuenta a su solicitud, los créditos no utilizados se pierden.'
                )}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Les types de crédits suivants sont reconnus : achat (purchase), utilisation (usage), bonus, crédit administratif (admin_credit), débit administratif (admin_debit), parrainage (referral) et bienvenue (welcome). Les crédits de bienvenue sont attribués automatiquement à la création du compte.',
                  'The following credit types are recognized: purchase, usage, bonus, admin credit (admin_credit), admin debit (admin_debit), referral, and welcome. Welcome credits are automatically granted upon account creation.',
                  'Se reconocen los siguientes tipos de créditos: compra (purchase), uso (usage), bonus, crédito administrativo (admin_credit), débito administrativo (admin_debit), referido (referral) y bienvenida (welcome). Los créditos de bienvenida se otorgan automáticamente al crear la cuenta.'
                )}
              </p>
            </section>

            {/* 7. Remboursement */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '7. Remboursement', '7. Refund', '7. Reembolso')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'En cas de problème technique empêchant la génération d\'un rapport ou d\'un code correctif après utilisation de crédits, les crédits concernés seront recrédités sur votre compte sous 48h. Pour toute réclamation, contactez contact@crawlers.fr avec les détails du problème rencontré.',
                  'In case of a technical problem preventing the generation of a report or corrective code after using credits, the concerned credits will be recredited to your account within 48 hours. For any complaint, contact contact@crawlers.fr with details of the problem encountered.',
                  'En caso de problema técnico que impida la generación de un informe o un código correctivo tras el uso de créditos, los créditos afectados se reacreditarán en su cuenta en un plazo de 48 horas. Para cualquier reclamación, contacte contact@crawlers.fr con los detalles del problema encontrado.'
                )}
              </p>
            </section>

            {/* 8. Utilisation des outils */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '8. Utilisation des outils', '8. Use of Tools', '8. Uso de las herramientas')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language, 'L\'utilisateur s\'engage à :', 'The user agrees to:', 'El usuario se compromete a:')}
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>{t3(language, 'Utiliser les outils de manière légale et éthique', 'Use the tools legally and ethically', 'Utilizar las herramientas de manera legal y ética')}</li>
                <li>{t3(language, 'Ne pas tenter de surcharger ou perturber les serveurs', 'Not attempt to overload or disrupt the servers', 'No intentar sobrecargar ni perturbar los servidores')}</li>
                <li>{t3(language, 'Ne pas utiliser les outils à des fins malveillantes', 'Not use the tools for malicious purposes', 'No utilizar las herramientas con fines maliciosos')}</li>
                <li>{t3(language, 'Respecter les droits de propriété intellectuelle des tiers', 'Respect the intellectual property rights of third parties', 'Respetar los derechos de propiedad intelectual de terceros')}</li>
                <li>{t3(language, 'Ne pas automatiser massivement les requêtes sans autorisation', 'Not massively automate requests without authorization', 'No automatizar masivamente las solicitudes sin autorización')}</li>
                <li>{t3(language, 'Ne pas revendre ou redistribuer les codes correctifs générés', 'Not resell or redistribute generated corrective codes', 'No revender ni redistribuir los códigos correctivos generados')}</li>
                <li>{t3(language, 'N\'utiliser les fonctions d\'analyse concurrentielle qu\'à des fins de veille stratégique licite, sans extraction massive de contenu à des fins de republication', 'Only use competitive analysis features for legitimate strategic intelligence purposes, without mass content extraction for republication', 'Utilizar las funciones de análisis competitivo únicamente con fines de vigilancia estratégica lícita, sin extracción masiva de contenido para su republicación')}</li>
                <li>{t3(language, 'Ne pas contourner une authentification ou un accès restreint pour accéder au contenu non public d\'un site tiers', 'Not bypass authentication or restricted access to access non-public content on a third-party site', 'No eludir una autenticación ni un acceso restringido para acceder a contenido no público de un sitio de terceros')}</li>
                <li>{t3(language, 'Accepter les CGVU lors de l\'inscription (case à cocher obligatoire)', 'Accept the Terms upon registration (mandatory checkbox)', 'Aceptar los términos al registrarse (casilla obligatoria)')}</li>
              </ul>
            </section>

            {/* 9. Résultats d'analyse */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '9. Résultats d\'analyse', '9. Analysis Results', '9. Resultados de análisis')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Les résultats fournis par nos outils sont donnés à titre indicatif. Ils ne constituent pas des conseils professionnels et ne garantissent pas l\'amélioration du référencement. Crawlers AI ne peut être tenu responsable des décisions prises sur la base de ces résultats.',
                  'The results provided by our tools are given for informational purposes only. They do not constitute professional advice and do not guarantee SEO improvement. Crawlers AI cannot be held responsible for decisions made based on these results.',
                  'Los resultados proporcionados por nuestras herramientas se ofrecen a título indicativo. No constituyen asesoramiento profesional y no garantizan la mejora del posicionamiento. Crawlers AI no puede ser considerado responsable de las decisiones tomadas sobre la base de estos resultados.'
                )}
              </p>
            </section>

            {/* 10. Propriété intellectuelle */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '10. Propriété intellectuelle', '10. Intellectual Property', '10. Propiedad intelectual')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Tous les éléments du site (design, logos, textes, code source, algorithmes) sont protégés par le droit de la propriété intellectuelle. Les codes correctifs générés pour vous peuvent être utilisés librement sur vos propres sites. Les rapports marque blanche générés dans le cadre d\'un abonnement Pro Agency peuvent être redistribués à vos clients. Toute reproduction ou redistribution commerciale non autorisée est strictement interdite.',
                  'All elements of the site (design, logos, texts, source code, algorithms) are protected by intellectual property law. Corrective codes generated for you can be freely used on your own sites. White label reports generated under a Pro Agency subscription may be redistributed to your clients. Any unauthorized commercial reproduction or redistribution is strictly prohibited.',
                  'Todos los elementos del sitio (diseño, logotipos, textos, código fuente, algoritmos) están protegidos por el derecho de propiedad intelectual. Los códigos correctivos generados para usted pueden utilizarse libremente en sus propios sitios. Los informes de marca blanca generados en el marco de una suscripción Pro Agency pueden redistribuirse a sus clientes. Toda reproducción o redistribución comercial no autorizada está estrictamente prohibida.'
                )}
              </p>
            </section>

            {/* 11. Limitation de responsabilité */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '11. Limitation de responsabilité', '11. Limitation of Liability', '11. Limitación de responsabilidad')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Crawlers AI est fourni "en l\'état" sans garantie d\'aucune sorte. Nous ne garantissons pas la disponibilité continue du service ni l\'exactitude des résultats. En aucun cas, Crawlers AI ne pourra être tenu responsable de dommages directs ou indirects résultant de l\'utilisation du site, dans la limite permise par la loi.',
                  'Crawlers AI is provided "as is" without warranty of any kind. We do not guarantee continuous availability of the service or accuracy of results. Under no circumstances shall Crawlers AI be liable for direct or indirect damages resulting from the use of the site, to the extent permitted by law.',
                  'Crawlers AI se proporciona "tal cual" sin garantía de ningún tipo. No garantizamos la disponibilidad continua del servicio ni la exactitud de los resultados. En ningún caso Crawlers AI podrá ser considerado responsable de daños directos o indirectos resultantes del uso del sitio, en la medida permitida por la ley.'
                )}
              </p>
            </section>

            {/* 12. Médiation */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '12. Médiation des litiges', '12. Dispute Mediation', '12. Mediación de litigios')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language,
                  'Conformément aux articles L.612-1 et suivants du Code de la consommation, en cas de litige, vous pouvez recourir gratuitement au service de médiation de la consommation. Le médiateur compétent est :',
                  'In accordance with articles L.612-1 et seq. of the French Consumer Code, in case of dispute, you can use the consumer mediation service free of charge. The competent mediator is:',
                  'De conformidad con los artículos L.612-1 y siguientes del Código de Consumo francés, en caso de litigio, puede recurrir gratuitamente al servicio de mediación del consumo. El mediador competente es:'
                )}
              </p>
              <div className="bg-muted/50 rounded-lg p-6">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{t3(language, 'Médiateur de la consommation :', 'Consumer Mediator:', 'Mediador del consumo:')}</strong><br />
                  CM2C (Centre de Médiation de la Consommation de Conciliateurs de Justice)<br />
                  14 rue Saint Jean - 75017 Paris<br />
                  <a href="https://www.cm2c.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.cm2c.net</a>
                </p>
              </div>
            </section>

            {/* 13. Modifications */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '13. Modifications des CGU/CGV', '13. Modifications to Terms', '13. Modificaciones de los términos')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Crawlers AI se réserve le droit de modifier les présentes CGU/CGV à tout moment. Les modifications entrent en vigueur dès leur publication sur le site. Les utilisateurs seront informés par email des modifications substantielles. L\'utilisation continue du site après modification vaut acceptation des nouvelles conditions.',
                  'Crawlers AI reserves the right to modify these Terms at any time. Modifications take effect upon publication on the site. Users will be informed by email of substantial modifications. Continued use of the site after modification constitutes acceptance of the new terms.',
                  'Crawlers AI se reserva el derecho de modificar los presentes términos en cualquier momento. Las modificaciones entran en vigor desde su publicación en el sitio. Los usuarios serán informados por email de las modificaciones sustanciales. El uso continuado del sitio tras la modificación implica la aceptación de los nuevos términos.'
                )}
              </p>
            </section>

            {/* 14. Droit applicable */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '14. Droit applicable', '14. Applicable Law', '14. Derecho aplicable')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Les présentes CGU/CGV sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux français, sous réserve des règles de compétence impératives au bénéfice du consommateur.',
                  'These Terms are governed by French law. Any dispute shall be subject to the exclusive jurisdiction of the French courts, subject to mandatory jurisdiction rules for the benefit of the consumer.',
                  'Los presentes términos se rigen por el derecho francés. Todo litigio será sometido a la competencia exclusiva de los tribunales franceses, sujeto a las reglas de competencia imperativas en beneficio del consumidor.'
                )}
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

export default ConditionsUtilisation;
