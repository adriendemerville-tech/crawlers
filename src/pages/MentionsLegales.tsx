import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t3 } from '@/utils/i18n';

const MentionsLegales = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/mentions-legales');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <html lang={language} />
        <title>{t3(language, 'Mentions légales | Crawlers.fr', 'Legal Notice | Crawlers.fr', 'Aviso legal | Crawlers.fr')}</title>
        <meta name="description" content={t3(language, 'Mentions légales de Crawlers.fr — éditeur, hébergement, conditions.', 'Legal notice for Crawlers.fr', 'Aviso legal de Crawlers.fr')} />
        <meta name="robots" content="noindex, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:locale" content="fr_FR" />
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
              {t3(language, 'Mentions Légales', 'Legal Notice', 'Aviso Legal')}
            </h1>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '1. Éditeur du site', '1. Website Publisher', '1. Editor del sitio')}
              </h2>
              <div className="bg-muted/50 rounded-lg p-6 space-y-2 text-muted-foreground">
                <p><strong className="text-foreground">{t3(language, 'Raison sociale :', 'Company name:', 'Razón social:')}</strong> Adrien de Volontat (Entrepreneur individuel)</p>
                <p><strong className="text-foreground">{t3(language, 'Nom commercial :', 'Trade name:', 'Nombre comercial:')}</strong> Crawlers</p>
                <p><strong className="text-foreground">SIRET :</strong> 992 399 667 00011</p>
                <p><strong className="text-foreground">{t3(language, 'Code APE :', 'APE Code:', 'Código APE:')}</strong> 6201Z — Programmation informatique</p>
                <p><strong className="text-foreground">{t3(language, 'Directeur de la publication :', 'Publication Director:', 'Director de la publicación:')}</strong> Adrien de Volontat</p>
                <p><strong className="text-foreground">{t3(language, 'Responsable du traitement des données :', 'Data Controller:', 'Responsable del tratamiento de datos:')}</strong> Adrien de Volontat — <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a></p>
                <p><strong className="text-foreground">{t3(language, 'URL du site :', 'Website URL:', 'URL del sitio:')}</strong> <a href="https://crawlers.fr" className="text-primary hover:underline">https://crawlers.fr</a></p>
                <p><strong className="text-foreground">Email :</strong> <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a></p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '2. Activité commerciale', '2. Commercial Activity', '2. Actividad comercial')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Crawlers AI est une plateforme proposant des services d\'audit SEO et GEO, de crawl multi-pages, d\'analyse concurrentielle, de création de contenu IA, de correction automatique de pages, de connexion CMS directe (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo), de gestion Google My Business et de maintenance prédictive par machine learning. L\'activité comprend la fourniture de services numériques gratuits et payants via un système de crédits prépayés et deux abonnements mensuels sans engagement : Pro Agency (59€ TTC/mois) et Pro Agency+ (99€ TTC/mois). Les analyses portent exclusivement sur des données publiquement accessibles.',
                  'Crawlers AI is a platform offering SEO and GEO audit services, multi-page crawling, competitive analysis, AI content creation, automatic page correction, direct CMS connection (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo), Google My Business management and predictive maintenance through machine learning. The activity includes the provision of free and paid digital services via a prepaid credit system and two monthly subscriptions with no commitment: Pro Agency (€59 incl. VAT/month) and Pro Agency+ (€99 incl. VAT/month). Analyses exclusively cover publicly accessible data.',
                  'Crawlers AI es una plataforma que ofrece servicios de auditoría SEO y GEO, crawl multi-páginas, análisis competitivo, creación de contenido IA, corrección automática de páginas, conexión CMS directa (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo), gestión Google My Business y mantenimiento predictivo mediante machine learning. La actividad incluye la prestación de servicios digitales gratuitos y de pago mediante un sistema de créditos prepagados y dos suscripciones mensuales sin compromiso: Pro Agency (59€ IVA incl./mes) y Pro Agency+ (99€ IVA incl./mes). Los análisis se refieren exclusivamente a datos públicamente accesibles.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '3. Hébergement', '3. Hosting', '3. Alojamiento')}
              </h2>
              <div className="bg-muted/50 rounded-lg p-6 space-y-2 text-muted-foreground">
                <p><strong className="text-foreground">{t3(language, 'Hébergeur application :', 'Application host:', 'Alojamiento de la aplicación:')}</strong> Lovable Technologies</p>
                <p><strong className="text-foreground">{t3(language, 'Infrastructure backend :', 'Backend infrastructure:', 'Infraestructura backend:')}</strong> Supabase Inc. (AWS eu-west-1)</p>
                <p><strong className="text-foreground">{t3(language, 'Services de rendu :', 'Rendering services:', 'Servicios de renderizado:')}</strong> Fly.io (Frankfurt, DE)</p>
                <p><strong className="text-foreground">{t3(language, 'Localisation des données :', 'Data location:', 'Ubicación de los datos:')}</strong> {t3(language, 'Union Européenne', 'European Union', 'Unión Europea')}</p>
                <p><strong className="text-foreground">{t3(language, 'Prestataire de paiement :', 'Payment provider:', 'Proveedor de pagos:')}</strong> Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin 2, Ireland</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '4. Tarification', '4. Pricing', '4. Precios')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language,
                  'Les prix affichés sont en euros TTC. Le détail des tarifs est disponible sur la page dédiée :',
                  'Displayed prices are in euros including VAT. Detailed pricing is available on the dedicated page:',
                  'Los precios mostrados están en euros con IVA incluido. El detalle de los precios está disponible en la página dedicada:'
                )}
              </p>
              <Link to="/tarifs" className="text-primary hover:underline">
                {t3(language, 'Consulter les tarifs', 'View pricing', 'Consultar los precios')}
              </Link>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '5. Propriété intellectuelle', '5. Intellectual Property', '5. Propiedad intelectual')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'L\'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes, sons, logiciels, etc.) est la propriété exclusive de Crawlers AI ou de ses partenaires. Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable.',
                  'All content on this site (texts, images, graphics, logos, icons, sounds, software, etc.) is the exclusive property of Crawlers AI or its partners. Any reproduction, representation, modification, publication, adaptation of all or part of the elements of the site, whatever the means or process used, is prohibited, except with prior written authorization.',
                  'Todo el contenido de este sitio (textos, imágenes, gráficos, logotipos, iconos, sonidos, software, etc.) es propiedad exclusiva de Crawlers AI o de sus socios. Toda reproducción, representación, modificación, publicación o adaptación de todo o parte de los elementos del sitio, cualquiera que sea el medio o procedimiento utilizado, está prohibida, salvo autorización escrita previa.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '6. Limitation de responsabilité', '6. Limitation of Liability', '6. Limitación de responsabilidad')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Crawlers AI ne pourra être tenu responsable des dommages directs et indirects causés au matériel de l\'utilisateur, lors de l\'accès au site. Crawlers AI décline toute responsabilité quant à l\'utilisation qui pourrait être faite des informations et contenus présents sur le site. Les outils d\'analyse fournis le sont à titre informatif et ne constituent pas des conseils professionnels.',
                  'Crawlers AI cannot be held responsible for direct and indirect damage caused to the user\'s equipment when accessing the site. Crawlers AI declines all responsibility for the use that may be made of the information and content on the site. The analysis tools provided are for informational purposes only and do not constitute professional advice.',
                  'Crawlers AI no podrá ser considerado responsable de los daños directos e indirectos causados al equipo del usuario durante el acceso al sitio. Crawlers AI declina toda responsabilidad en cuanto al uso que pueda hacerse de la información y contenidos presentes en el sitio. Las herramientas de análisis proporcionadas son a título informativo y no constituyen asesoramiento profesional.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '7. Liens hypertextes', '7. Hyperlinks', '7. Enlaces hipertexto')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Le site peut contenir des liens hypertextes vers d\'autres sites. Crawlers AI n\'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu. La décision d\'activer ces liens relève de la pleine et entière responsabilité de l\'utilisateur.',
                  'The site may contain hyperlinks to other sites. Crawlers AI has no control over these sites and disclaims any responsibility for their content. The decision to activate these links is the full and entire responsibility of the user.',
                  'El sitio puede contener enlaces hipertexto hacia otros sitios. Crawlers AI no ejerce ningún control sobre estos sitios y declina toda responsabilidad en cuanto a su contenido. La decisión de activar estos enlaces es responsabilidad total y exclusiva del usuario.'
                )}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '8. Médiation des litiges', '8. Dispute Mediation', '8. Mediación de litigios')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t3(language,
                  'Conformément aux dispositions du Code de la consommation concernant le règlement amiable des litiges, le consommateur peut recourir gratuitement au service de médiation CM2C :',
                  'In accordance with the provisions of the Consumer Code concerning the amicable settlement of disputes, the consumer may use the CM2C mediation service free of charge:',
                  'De conformidad con las disposiciones del Código de Consumo relativas a la resolución amistosa de litigios, el consumidor puede recurrir gratuitamente al servicio de mediación CM2C:'
                )}
              </p>
              <div className="bg-muted/50 rounded-lg p-6">
                <p className="text-muted-foreground">
                  CM2C - Centre de Médiation de la Consommation de Conciliateurs de Justice<br />
                  14 rue Saint Jean - 75017 Paris<br />
                  <a href="https://www.cm2c.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.cm2c.net</a>
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t3(language, '9. Droit applicable', '9. Applicable Law', '9. Derecho aplicable')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Les présentes mentions légales sont soumises au droit français. En cas de litige, et à défaut d\'accord amiable, les tribunaux français seront seuls compétents.',
                  'These legal notices are subject to French law. In the event of a dispute, and in the absence of an amicable agreement, the French courts will have sole jurisdiction.',
                  'Los presentes avisos legales están sujetos al derecho francés. En caso de litigio, y a falta de acuerdo amistoso, los tribunales franceses serán los únicos competentes.'
                )}
              </p>
            </section>

            <p className="text-sm text-muted-foreground mt-12">
              {t3(language, 'Dernière mise à jour : 27 mars 2026', 'Last updated: March 27, 2026', 'Última actualización: 27 de marzo de 2026')}
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MentionsLegales;