import { lazy, Suspense, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Share2, CalendarDays, BarChart3, PenTool, Link2, Globe,
  Sparkles, Target, Layers, Zap, CheckCircle2, MessageSquare, Image,
  TrendingUp, Languages, FileDown
} from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const features = [
  { icon: PenTool, title: 'Éditeur Multi-Plateformes', desc: 'Rédigez un seul post et obtenez des versions optimisées pour LinkedIn (3000 car.), Facebook (63 206 car.) et Instagram (2200 car.) avec compteurs en temps réel.' },
  { icon: Sparkles, title: 'Génération IA', desc: 'Gemini Flash génère du contenu social ancré dans vos données SEO/GEO : mots-clés positionnés, gaps de contenu, opportunités saisonnières.' },
  { icon: Link2, title: 'Smart Linking', desc: 'Résolution automatique de la meilleure page de votre site à lier dans chaque post, basée sur le scoring cocon + keyword_universe + EEAT.' },
  { icon: CalendarDays, title: 'Calendrier Éditorial', desc: 'Planifiez vos publications sur un calendrier synchronisé avec le contexte saisonnier et les pics de recherche détectés.' },
  { icon: BarChart3, title: 'Dashboard Analytics', desc: 'Impressions, clics, likes, partages et taux d\'engagement agrégés par plateforme. Corrélation avec le trafic organique.' },
  { icon: Image, title: 'Canevas Visuel IA', desc: 'Créez des visuels optimisés par plateforme avec retouche IA. Templates brandés avec extraction automatique de votre charte graphique.' },
  { icon: Languages, title: 'Traduction Auto', desc: 'Traduction FR → EN / ES en un clic avec adaptation des hashtags et du ton pour chaque marché.' },
  { icon: MessageSquare, title: 'Modération Sociale', desc: 'Consultez et répondez aux commentaires LinkedIn, Facebook et Instagram directement depuis votre console.' },
];

const smartFeatures = [
  { icon: Link2, title: 'Smart Link → Site', desc: 'L\'IA analyse votre cocon sémantique, votre keyword_universe et vos scores EEAT pour identifier automatiquement la page la plus pertinente à lier dans chaque post social.' },
  { icon: Layers, title: 'Smart Embed ← Social', desc: 'Suggestion automatique d\'intégration oEmbed de vos meilleurs posts sociaux dans vos pages web, pour enrichir le contenu et les signaux sociaux.' },
  { icon: Target, title: 'Plan d\'Actions Piloté', desc: 'Le Workbench Architect alimente les suggestions de posts sociaux. Chaque gap de contenu, quick win ou opportunité saisonnière génère une recommandation de post.' },
];

const workflow = [
  { step: '1', title: 'Connectez vos comptes', desc: 'Liez vos pages LinkedIn, Facebook et Instagram via OAuth. Crawlers.fr n\'accède qu\'aux permissions de publication.' },
  { step: '2', title: 'Créez ou générez', desc: 'Rédigez manuellement ou laissez l\'IA générer un post à partir d\'un mot-clé, d\'un article workbench ou d\'un contexte saisonnier.' },
  { step: '3', title: 'Prévisualisez et planifiez', desc: 'Vérifiez le rendu sur chaque plateforme, ajoutez un lien intelligent et planifiez la publication.' },
  { step: '4', title: 'Publiez et mesurez', desc: 'Publication directe via les APIs officielles. Suivi des métriques d\'engagement en temps réel.' },
];

const faq = [
  { q: 'Le Social Content Hub remplace-t-il Hootsuite ou Buffer ?', a: 'Il ne s\'agit pas d\'un simple planificateur. Le Social Hub croise vos données SEO/GEO (mots-clés, cocon, EEAT, saisonnalité) avec la distribution sociale. Aucun outil concurrent ne propose ce croisement de données.' },
  { q: 'Quelles plateformes sont supportées ?', a: 'LinkedIn (API Marketing v2), Facebook et Instagram (Meta Graph API). Les publications utilisent les APIs officielles — pas de scraping.' },
  { q: 'Comment fonctionne le Smart Linking ?', a: 'L\'algorithme score chaque page de votre site sur 3 axes : pertinence du mot-clé (keyword_universe), position dans le cocon sémantique et score EEAT. La page avec le meilleur score composite est automatiquement suggérée.' },
  { q: 'Faut-il un abonnement Pro Agency ?', a: '5 contenus sont gratuits chaque mois pour tous les utilisateurs inscrits. Au-delà, le plan Pro Agency (29€/mois) débloque un accès illimité, la publication directe et les analytics avancées.' },
  { q: 'Mes données sociales restent-elles privées ?', a: 'Oui. Les tokens OAuth sont chiffrés. Les contenus générés par l\'IA n\'utilisent que vos données de site (mots-clés, cocon) — jamais vos données personnelles.' },
  { q: 'Qu\'est-ce que le Smart Embed ?', a: 'Quand un de vos posts LinkedIn ou Facebook performe bien (engagement élevé), le système suggère de l\'intégrer en oEmbed/iframe dans une page de votre site pour renforcer les signaux sociaux et enrichir le contenu.' },
];

const SocialContentCreator = memo(() => {
  useCanonicalHreflang('/social-content-creator');

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "Social Content Hub by Crawlers.fr",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "description": "Créez, planifiez et publiez du contenu social optimisé SEO/GEO sur LinkedIn, Facebook et Instagram, alimenté par vos données de site.",
        "offers": [
          { "@type": "Offer", "name": "Pro Agency", "price": "29", "priceCurrency": "EUR" },
          { "@type": "Offer", "name": "Pro Agency +", "price": "99", "priceCurrency": "EUR" },
        ],
        "featureList": [
          "AI-powered social content generation",
          "Smart Link resolution from SEO data",
          "Multi-platform publishing (LinkedIn, Facebook, Instagram)",
          "Editorial calendar with seasonal sync",
          "Engagement analytics dashboard",
          "Auto-translation FR/EN/ES",
          "Smart Embed suggestions",
          "Comment moderation"
        ],
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Social Content Hub", "item": "https://crawlers.fr/social-content-creator" },
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": faq.map(item => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": { "@type": "Answer", "text": item.a }
        }))
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>Social Content Hub — Publication Sociale SEO/GEO | Crawlers.fr</title>
        <meta name="description" content="Créez, planifiez et publiez du contenu social optimisé SEO/GEO sur LinkedIn, Facebook et Instagram. Smart Linking, génération IA et analytics intégrés." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Social Content Hub — Crawlers.fr" />
        <meta property="og:description" content="Distribution sociale alimentée par vos données SEO/GEO. Publication directe LinkedIn, Facebook, Instagram." />
        <meta property="og:url" content="https://crawlers.fr/social-content-creator" />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden py-20 lg:py-28">
          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-transparent to-accent/5" />
          <div className="relative max-w-5xl mx-auto px-4 text-center">
            <Badge variant="outline" className="mb-6 text-sm px-4 py-1.5 border-border">
              <Share2 className="h-3.5 w-3.5 mr-1.5" /> 5 contenus gratuits / mois
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-tight mb-6">
              Social Content Hub
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              Le premier outil de distribution sociale <strong>alimenté par vos données SEO et GEO</strong>.
              Créez, planifiez et publiez sur LinkedIn, Facebook et Instagram — avec Smart Linking automatique vers vos pages.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/app/social">
                  Accéder au Social Hub <ArrowRight className="h-5 w-5 ml-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/pro-agency">Découvrir Pro Agency</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="py-16 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-4">Tout ce qu'il faut pour dominer le social</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Un éditeur complet, une IA qui connaît votre site, et des analytics croisées SEO/Social.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f, i) => (
                <Card key={i} className="border-border/50 hover:border-foreground/20 transition-colors">
                  <CardContent className="pt-6">
                    <f.icon className="h-8 w-8 text-muted-foreground mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Smart Linking / Embed section */}
        <section className="py-16">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">Exclusivité Crawlers.fr</Badge>
              <h2 className="text-3xl font-bold text-foreground mb-4">Le pont bidirectionnel Site ↔ Social</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Aucun outil concurrent ne croise vos données SEO avec votre distribution sociale. Crawlers.fr le fait automatiquement dans les deux sens.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {smartFeatures.map((f, i) => (
                <Card key={i} className="border-border bg-muted/30">
                  <CardContent className="pt-6">
                    <f.icon className="h-10 w-10 text-foreground mb-4" />
                    <h3 className="font-bold text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="py-16 bg-muted/30">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-12">Comment ça marche</h2>
            <div className="space-y-8">
              {workflow.map((w, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-lg">
                    {w.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg mb-1">{w.title}</h3>
                    <p className="text-muted-foreground">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quotas */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-10">Quotas mensuels</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { plan: 'Gratuit', posts: '5 posts/mois', features: ['Éditeur basique', 'Export ZIP uniquement', 'Pas de publication directe'] },
                { plan: 'Pro Agency', posts: '30 posts/mois', features: ['Publication directe 3 plateformes', 'Smart Linking', 'Calendrier éditorial', 'Analytics basiques'], highlight: true },
                { plan: 'Pro Agency+', posts: '100 posts/mois', features: ['Tout Pro Agency', 'Traduction auto', 'Modération commentaires', 'Analytics avancées'] },
              ].map((tier, i) => (
                <Card key={i} className={tier.highlight ? 'border-foreground ring-2 ring-foreground/10' : 'border-border/50'}>
                  <CardContent className="pt-6 text-center">
                    <h3 className="font-bold text-foreground mb-1">{tier.plan}</h3>
                    <p className="text-2xl font-bold text-foreground mb-4">{tier.posts}</p>
                    <ul className="text-sm text-muted-foreground space-y-2 text-left">
                      {tier.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-foreground flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-muted/30">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-10">Questions fréquentes</h2>
            <div className="space-y-6">
              {faq.map((item, i) => (
                <div key={i} className="border-b border-border pb-5">
                  <h3 className="font-semibold text-foreground mb-2">{item.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">Prêt à croiser SEO et Social ?</h2>
            <p className="text-muted-foreground mb-8">Rejoignez les premiers utilisateurs du Social Content Hub.</p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/app/social">Lancer le Social Hub <ArrowRight className="h-5 w-5 ml-1" /></Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/tarifs">Voir les tarifs</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
});

export default SocialContentCreator;
