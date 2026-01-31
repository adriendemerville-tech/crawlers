import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const MentionsLegales = () => {
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
              {language === 'fr' ? 'Mentions Légales' : language === 'es' ? 'Aviso Legal' : 'Legal Notice'}
            </h1>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '1. Éditeur du site' : '1. Website Publisher'}
              </h2>
              <div className="bg-muted/50 rounded-lg p-6 space-y-2 text-muted-foreground">
                <p><strong className="text-foreground">{language === 'fr' ? 'Raison sociale :' : 'Company name:'}</strong> Adrien de Volontat (Entrepreneur individuel)</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Nom commercial :' : 'Trade name:'}</strong> Crawlers AI</p>
                <p><strong className="text-foreground">SIRET :</strong> 992 399 667 00011</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Numéro de TVA intracommunautaire :' : 'VAT number:'}</strong> [À compléter si applicable]</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Adresse du siège :' : 'Headquarters address:'}</strong> [À compléter]</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Directeur de la publication :' : 'Publication Director:'}</strong> Adrien de Volontat</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'URL du site :' : 'Website URL:'}</strong> <a href="https://crawlers.fr" className="text-primary hover:underline">https://crawlers.fr</a></p>
                <p><strong className="text-foreground">Email :</strong> <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a></p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '2. Activité commerciale' : '2. Commercial Activity'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Crawlers AI est une plateforme proposant des services d\'audit SEO et GEO, ainsi que des outils de génération de code correctif. L\'activité comprend la fourniture de services numériques gratuits et payants via un système de crédits prépayés.'
                  : 'Crawlers AI is a platform offering SEO and GEO audit services, as well as corrective code generation tools. The activity includes the provision of free and paid digital services via a prepaid credit system.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '3. Hébergement' : '3. Hosting'}
              </h2>
              <div className="bg-muted/50 rounded-lg p-6 space-y-2 text-muted-foreground">
                <p><strong className="text-foreground">{language === 'fr' ? 'Hébergeur application :' : 'Application host:'}</strong> Lovable Technologies</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Infrastructure backend :' : 'Backend infrastructure:'}</strong> Supabase Inc.</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Localisation :' : 'Location:'}</strong> {language === 'fr' ? 'Serveurs européens' : 'European servers'}</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Prestataire de paiement :' : 'Payment provider:'}</strong> Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin 2, Ireland</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '4. Tarification' : '4. Pricing'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr'
                  ? 'Les prix affichés sont en euros TTC. Le détail des tarifs est disponible sur la page dédiée :'
                  : 'Displayed prices are in euros including VAT. Detailed pricing is available on the dedicated page:'}
              </p>
              <Link to="/tarifs" className="text-primary hover:underline">
                {language === 'fr' ? 'Consulter les tarifs' : 'View pricing'}
              </Link>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '5. Propriété intellectuelle' : '5. Intellectual Property'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr' 
                  ? 'L\'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes, sons, logiciels, etc.) est la propriété exclusive de Crawlers AI ou de ses partenaires. Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable.'
                  : 'All content on this site (texts, images, graphics, logos, icons, sounds, software, etc.) is the exclusive property of Crawlers AI or its partners. Any reproduction, representation, modification, publication, adaptation of all or part of the elements of the site, whatever the means or process used, is prohibited, except with prior written authorization.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '6. Limitation de responsabilité' : '6. Limitation of Liability'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Crawlers AI ne pourra être tenu responsable des dommages directs et indirects causés au matériel de l\'utilisateur, lors de l\'accès au site. Crawlers AI décline toute responsabilité quant à l\'utilisation qui pourrait être faite des informations et contenus présents sur le site. Les outils d\'analyse fournis le sont à titre informatif et ne constituent pas des conseils professionnels.'
                  : 'Crawlers AI cannot be held responsible for direct and indirect damage caused to the user\'s equipment when accessing the site. Crawlers AI declines all responsibility for the use that may be made of the information and content on the site. The analysis tools provided are for informational purposes only and do not constitute professional advice.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '7. Liens hypertextes' : '7. Hyperlinks'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Le site peut contenir des liens hypertextes vers d\'autres sites. Crawlers AI n\'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu. La décision d\'activer ces liens relève de la pleine et entière responsabilité de l\'utilisateur.'
                  : 'The site may contain hyperlinks to other sites. Crawlers AI has no control over these sites and disclaims any responsibility for their content. The decision to activate these links is the full and entire responsibility of the user.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '8. Médiation des litiges' : '8. Dispute Mediation'}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {language === 'fr'
                  ? 'Conformément aux dispositions du Code de la consommation concernant le règlement amiable des litiges, le consommateur peut recourir gratuitement au service de médiation CM2C :'
                  : 'In accordance with the provisions of the Consumer Code concerning the amicable settlement of disputes, the consumer may use the CM2C mediation service free of charge:'}
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
                {language === 'fr' ? '9. Droit applicable' : '9. Applicable Law'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Les présentes mentions légales sont soumises au droit français. En cas de litige, et à défaut d\'accord amiable, les tribunaux français seront seuls compétents.'
                  : 'These legal notices are subject to French law. In the event of a dispute, and in the absence of an amicable agreement, the French courts will have sole jurisdiction.'}
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

export default MentionsLegales;
