import { lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { useLanguage } from '@/contexts/LanguageContext';
import { getExpertTermBySlug, expertCategories } from '@/data/expertTerms';
import { ArrowLeft, Calendar, Code2, Lightbulb, BookOpen, MessageSquare, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TrustBadge, SoftwareApplicationSchema } from '@/components/TrustBadge';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));


export default function ExpertTermPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  
  const term = getExpertTermBySlug(slug || '', language);
  
  if (!term) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Terme non trouvé</h1>
          <Link to="/lexique" className="text-primary hover:underline">
            Retour au lexique
          </Link>
        </main>
        <Suspense fallback={null}><Footer /></Suspense>
      </div>
    );
  }

  const category = expertCategories[term.category];
  const categoryLabel = category.label[language as keyof typeof category.label] || category.label.fr;
  const formattedDate = new Date(term.updatedAt).toLocaleDateString(
    language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  // JSON-LD Schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "name": term.term,
    "description": term.fullDefinition,
    "inDefinedTermSet": {
      "@type": "DefinedTermSet",
      "name": "Crawlers.fr Expert Lexicon",
      "url": "https://crawlers.fr/lexique"
    }
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
      { "@type": "ListItem", "position": 2, "name": "Lexique", "item": "https://crawlers.fr/lexique" },
      { "@type": "ListItem", "position": 3, "name": term.term, "item": `https://crawlers.fr/lexique/${term.slug}` }
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{term.term} - Définition Expert | Crawlers.fr</title>
        <meta name="description" content={term.fullDefinition.slice(0, 155)} />
        <link rel="canonical" href={`https://crawlers.fr/lexique/${term.slug}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>
      <SoftwareApplicationSchema />

      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary flex items-center gap-1">
            <Home className="h-3.5 w-3.5" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/lexique" className="hover:text-primary">Lexique</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{term.term}</span>
        </nav>

        {/* Hero Section */}
        <header className="mb-10">
          <div className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium mb-4",
            category.bgColor, category.textColor, category.borderColor, "border"
          )}>
            {categoryLabel}
          </div>
          
          <h1 className="text-4xl font-bold text-foreground mb-4 font-mono">{term.term}</h1>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Mis à jour le {formattedDate}
            </span>
          </div>
        </header>

        {/* AI-Ready Definition Box */}
        <section className="mb-10 p-6 rounded-xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Définition</h2>
              <p className="text-foreground leading-relaxed">{term.fullDefinition}</p>
            </div>
          </div>
        </section>

        {/* Deep Dive */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-warning" />
            Deep Dive
          </h2>
          <div className="prose prose-invert max-w-none">
            {term.deepDive.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{line.replace('## ', '')}</h3>;
              }
              if (line.startsWith('### ')) {
                return <h4 key={i} className="text-lg font-semibold mt-4 mb-2">{line.replace('### ', '')}</h4>;
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return <li key={i} className="text-muted-foreground ml-4">{line.slice(2)}</li>;
              }
              if (line.trim()) {
                return <p key={i} className="text-muted-foreground mb-3">{line}</p>;
              }
              return null;
            })}
          </div>
        </section>

        {/* Code Playground */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Code2 className="h-6 w-6 text-cyan-400" />
            Code Playground
          </h2>
          <p className="text-sm text-muted-foreground mb-3">{term.codeExample.description}</p>
          <div className="relative rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-zinc-400 font-mono ml-2">{term.codeExample.language}</span>
            </div>
            <pre className="p-4 overflow-x-auto text-sm">
              <code className="text-zinc-300 font-mono whitespace-pre">{term.codeExample.code}</code>
            </pre>
          </div>
        </section>

        {/* Expert Opinion */}
        <section className="mb-10 p-6 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <MessageSquare className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Avis d'Expert 2026</h2>
              <p className="text-muted-foreground leading-relaxed">{term.expertOpinion}</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="p-6 rounded-xl bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Besoin d'aide sur {term.term} ?</h3>
          <p className="text-muted-foreground mb-4">Nos experts peuvent vous accompagner sur vos projets de crawling et d'optimisation GEO.</p>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link to="/audit-expert">Contactez l'expert Crawlers.fr</Link>
          </Button>
        </section>

        {/* Back Link */}
        <div className="mt-10">
          <Link to="/lexique" className="inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Retour au lexique
          </Link>
        </div>
      </main>

      {/* Trust Badge */}
      <TrustBadge className="border-t border-border" />

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}
