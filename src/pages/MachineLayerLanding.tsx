import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScanLine, Bot, ArrowRight, Layers, Eye, Code2 } from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

export default function MachineLayerLanding() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Couche machine : parler aux robots avant les humains — Crawlers.fr</title>
        <meta name="description" content="L'inversion est en cours : les pages doivent désormais parler aux robots et aux IA d'abord. Découvrez la couche machine et scannez gratuitement la vôtre." />
        <link rel="canonical" href="https://crawlers.fr/machine-layer-scanner" />
        <meta property="og:title" content="Couche machine : parler aux robots avant les humains" />
        <meta property="og:description" content="L'inversion est en cours. Audit gratuit de la couche machine de votre site." />
        <meta property="og:url" content="https://crawlers.fr/machine-layer-scanner" />
        <meta property="og:type" content="website" />
      </Helmet>

      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <section className="text-center mb-16">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <Bot className="h-3 w-3 mr-1.5" /> Le tournant GEO
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight">
            On n'écrit plus pour les humains d'abord.<br />
            <span className="text-primary">On écrit pour les robots d'abord.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Pendant 25 ans, le web a été pensé pour les yeux humains. En 2026, ChatGPT, Claude,
            Perplexity et Google AI Overviews lisent les pages <em>avant</em> que vous arriviez.
            Si votre <strong>couche machine</strong> est vide, vous n'existez plus.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" variant="outline">
              <Link to="/app/machine-layer">
                <ScanLine className="h-4 w-4 mr-2" /> Scanner mon site gratuitement
              </Link>
            </Button>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">L'inversion en trois temps</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Eye, title: 'Hier — Human-first', desc: 'Le HTML servait l\'œil. Les balises meta étaient un bonus SEO.' },
              { icon: Layers, title: 'Aujourd\'hui — Hybrid', desc: 'Les LLM scannent le head, le JSON-LD, llms.txt. Les humains arrivent ensuite via une réponse générée.' },
              { icon: Bot, title: 'Demain — Machine-first', desc: 'Le contenu visible devient secondaire. La qualité de la couche machine décide de votre visibilité.' },
            ].map((s, i) => (
              <Card key={i} className="p-6 border-border/60 bg-card/40">
                <s.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Ce que vit un robot quand il arrive sur votre page</h2>
          <Card className="p-6 border-border/60 bg-card/40">
            <ul className="space-y-3 text-sm">
              <li>· Il lit le <code className="text-xs">&lt;head&gt;</code> avant tout : title, description, canonical, hreflang</li>
              <li>· Il cherche votre <strong>JSON-LD</strong> pour comprendre <em>qui</em> vous êtes</li>
              <li>· Il interroge <code className="text-xs">/robots.txt</code>, <code className="text-xs">/sitemap.xml</code>, <code className="text-xs">/llms.txt</code>, <code className="text-xs">/ai.txt</code></li>
              <li>· Il vérifie les headers HTTP : <code className="text-xs">X-Robots-Tag</code>, <code className="text-xs">Content-Language</code>, <code className="text-xs">Link</code></li>
              <li>· Si tout cela est vide ou mal rédigé, il vous classe comme « page sans contexte machine » et vous écarte des réponses générées.</li>
            </ul>
          </Card>
        </section>

        <section className="text-center">
          <Card className="p-8 sm:p-12 border-primary/40 bg-gradient-to-br from-primary/5 to-accent/5">
            <Code2 className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Auditez votre couche machine en 30 secondes</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Score 0-100, liste exhaustive des signaux, détection des manques, recommandations rédigées
              prêtes à coller. Sans inscription.
            </p>
            <Button asChild size="lg" variant="outline">
              <Link to="/app/machine-layer">
                Lancer mon scan <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </Card>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}
