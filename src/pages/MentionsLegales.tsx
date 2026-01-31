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
                <p><strong className="text-foreground">{language === 'fr' ? 'Propriétaire et Directeur de la publication :' : 'Owner and Publication Director:'}</strong> Adrien de Volontat</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Nom du site :' : 'Website name:'}</strong> Crawlers AI</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'URL du site :' : 'Website URL:'}</strong> <a href="https://crawlers.fr" className="text-primary hover:underline">https://crawlers.fr</a></p>
                <p><strong className="text-foreground">Email :</strong> <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a></p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '2. Hébergement' : '2. Hosting'}
              </h2>
              <div className="bg-muted/50 rounded-lg p-6 space-y-2 text-muted-foreground">
                <p><strong className="text-foreground">{language === 'fr' ? 'Hébergeur :' : 'Host:'}</strong> Lovable / Supabase</p>
                <p><strong className="text-foreground">{language === 'fr' ? 'Infrastructure :' : 'Infrastructure:'}</strong> Cloud européen</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '3. Propriété intellectuelle' : '3. Intellectual Property'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr' 
                  ? 'L\'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes, sons, logiciels, etc.) est la propriété exclusive de Crawlers AI ou de ses partenaires. Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable.'
                  : 'All content on this site (texts, images, graphics, logos, icons, sounds, software, etc.) is the exclusive property of Crawlers AI or its partners. Any reproduction, representation, modification, publication, adaptation of all or part of the elements of the site, whatever the means or process used, is prohibited, except with prior written authorization.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '4. Limitation de responsabilité' : '4. Limitation of Liability'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Crawlers AI ne pourra être tenu responsable des dommages directs et indirects causés au matériel de l\'utilisateur, lors de l\'accès au site. Crawlers AI décline toute responsabilité quant à l\'utilisation qui pourrait être faite des informations et contenus présents sur le site. Les outils d\'analyse fournis le sont à titre informatif et ne constituent pas des conseils professionnels.'
                  : 'Crawlers AI cannot be held responsible for direct and indirect damage caused to the user\'s equipment when accessing the site. Crawlers AI declines all responsibility for the use that may be made of the information and content on the site. The analysis tools provided are for informational purposes only and do not constitute professional advice.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '5. Liens hypertextes' : '5. Hyperlinks'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Le site peut contenir des liens hypertextes vers d\'autres sites. Crawlers AI n\'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu. La décision d\'activer ces liens relève de la pleine et entière responsabilité de l\'utilisateur.'
                  : 'The site may contain hyperlinks to other sites. Crawlers AI has no control over these sites and disclaims any responsibility for their content. The decision to activate these links is the full and entire responsibility of the user.'}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {language === 'fr' ? '6. Droit applicable' : '6. Applicable Law'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'fr'
                  ? 'Les présentes mentions légales sont soumises au droit français. En cas de litige, et à défaut d\'accord amiable, les tribunaux français seront seuls compétents.'
                  : 'These legal notices are subject to French law. In the event of a dispute, and in the absence of an amicable agreement, the French courts will have sole jurisdiction.'}
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

export default MentionsLegales;
