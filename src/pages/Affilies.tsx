import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MethodologyTooltip } from '@/components/Profile/geo/MethodologyTooltip';
import {
  ArrowRight,
  Link2,
  TrendingUp,
  Shield,
  Bot,
  Users,
  Clock,
  Check,
  Sparkles,
  BarChart3,
  Globe
} from 'lucide-react';

export default function AffiliesPage() {
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);

  const tiers = [
    {
      id: 'starter',
      name: 'Partenaire',
      commission: '20%',
      duration: '12 mois',
      features: [
        'Commission sur toutes les souscriptions',
        'Tableau de bord en temps reel',
        'Paiement automatique mensuel'
      ]
    },
    {
      id: 'pro',
      name: 'Ambassadeur',
      commission: '30%',
      duration: '12 mois',
      popular: true,
      features: [
        'Commission elargie 30%',
        'Acces anticip aux nouvelles fonctionnalites',
        'Support dedie',
        'Badges et recompenses exclusives'
      ]
    }
  ];

  const geoFeatures = [
    {
      icon: Bot,
      title: 'Detection des crawlers IA',
      desc: 'Identifiez GPTBot, ClaudeBot, PerplexityBot et 15+ autres crawlers en temps reel'
    },
    {
      icon: Link2,
      title: 'Attribution multi-touch',
      desc: 'Correllez les visites humaines aux crawlers avec une fenetre de 30 jours et ponderation exponentielle'
    },
    {
      icon: BarChart3,
      title: 'Analytics avancees',
      desc: 'Visualisez les sources ChatGPT, Claude, Perplexity, Gemini et leurs conversions'
    },
    {
      icon: Shield,
      title: 'Bouclier Cloudflare',
      desc: 'Deployez un worker securise qui capture tous les hits sans impacter les performances'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-violet-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.15),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge 
                variant="outline" 
                className="w-fit border-amber-500/50 text-amber-500 px-3 py-1"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Sprint 2 GEO disponible
              </Badge>
              
              <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
                Programme <span className="text-violet-500">Affilies</span>
                <br />
                <span className="text-2xl lg:text-3xl font-normal text-muted-foreground">
                  Propulsez la visibilite IA
                </span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-xl">
                Rejoignez le programme d'affiliation Crawlers et gagnez jusqu'a 30% de commission 
                sur chaque souscription. Offrez a vos clients un acces exclusif au 
                <span className="text-violet-400 font-medium"> tracking GEO Bot IA ↔ Humain</span> — 
                une technologie unique sur le marche.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Link to="/signup">
                  <Button 
                    size="lg"
                    className="border border-violet-500 hover:bg-violet-500/10"
                    variant="outline"
                  >
                    Devenir affilie
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/app">
                  <Button 
                    size="lg"
                    variant="outline"
                    className="border border-foreground/20 hover:bg-foreground/5"
                  >
                    Voir la console GEO
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-violet-500" />
                  <span>Paiement mensuel automatise</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-violet-500" />
                  <span>Sans engagement</span>
                </div>
              </div>
            </div>

            {/* Visual Demo */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 via-amber-500/10 to-violet-500/20 blur-2xl rounded-3xl" />
              <Card className="relative border border-violet-500/30 bg-background/80 backdrop-blur">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <span className="text-sm font-medium">Attribution IA en temps reel</span>
                    <MethodologyTooltip 
                      title="Attribution multi-touch ponderee"
                      description="Modele exponentiel w(d) = exp(-d/15) avec demi-vie de 10.4 jours. Chaque visite humaine est correlee aux crawlers ayant visite la page dans les 30 jours precedents."
                    />
                  </div>
                  
                  <div className="space-y-3">
                    {[
                      { source: 'ChatGPT', visits: 234, conversion: '12.4%', color: 'text-green-500' },
                      { source: 'Claude', visits: 189, conversion: '9.8%', color: 'text-amber-500' },
                      { source: 'Perplexity', visits: 156, conversion: '8.2%', color: 'text-violet-500' }
                    ].map((item) => (
                      <div key={item.source} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-violet-500" />
                          <span className="text-sm">{item.source}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">{item.visits} visites</span>
                          <span className={`${item.color} font-medium w-12 text-right`}>
                            {item.conversion}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fenetre d'attribution</span>
                      <Badge variant="outline" className="border-violet-500/50">
                        <Clock className="h-3 w-3 mr-1" />
                        30 jours strict
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* GEO Sprint 2 Section */}
      <section className="py-24 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4 border-amber-500/50 text-amber-500">
              Sprint 2 GEO inclus
            </Badge>
            <h2 className="text-3xl font-bold mb-4">
              Tracking Bot IA <span className="text-violet-500">↔</span> Humain
            </h2>
            <p className="text-muted-foreground">
              Vos clients accedent a une technologie exclusive : la correlation automatique 
              entre les crawlers d'IA et les visites humaines, avec attribution ponderee 
              sur 30 jours.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {geoFeatures.map((feature) => (
              <Card 
                key={feature.title}
                className="border border-border hover:border-violet-500/50 transition-colors group"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="p-3 rounded-lg bg-violet-500/10 w-fit group-hover:bg-violet-500/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-violet-500" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Commission Tiers */}
      <section className="py-24 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Niveaux d'affiliation</h2>
            <p className="text-muted-foreground">
              Choisissez le niveau qui correspond a votre volume et a votre engagement.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {tiers.map((tier) => (
              <Card 
                key={tier.id}
                className={`relative border transition-all duration-300 ${
                  tier.popular 
                    ? 'border-amber-500/50 lg:scale-105' 
                    : 'border-border hover:border-violet-500/30'
                }`}
                onMouseEnter={() => setHoveredTier(tier.id)}
                onMouseLeave={() => setHoveredTier(null)}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-amber-500 text-black border-0">
                      Plus populaire
                    </Badge>
                  </div>
                )}
                
                <CardContent className="p-8 space-y-6">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">{tier.name}</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold text-violet-500">{tier.commission}</span>
                      <span className="text-muted-foreground">/recurrent</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Pendant {tier.duration}
                    </p>
                  </div>

                  <ul className="space-y-3">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/signup" className="block">
                    <Button 
                      className={`w-full border ${
                        tier.popular 
                          ? 'border-amber-500 hover:bg-amber-500/10 text-amber-500' 
                          : 'border-violet-500 hover:bg-violet-500/10'
                      }`}
                      variant="outline"
                    >
                      Rejoindre ce niveau
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-violet-500 mb-2">500+</div>
              <div className="text-muted-foreground">Affilies actifs</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-amber-500 mb-2">2.4M€</div>
              <div className="text-muted-foreground">Commissions versees</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-violet-500 mb-2">98%</div>
              <div className="text-muted-foreground">Taux de retention</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pret a propulser la visibilite IA de vos clients ?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Rejoignez le programme d'affiliation Crawlers et offrez-leur un acces exclusif 
            au tracking GEO le plus avance du marche.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/signup">
              <Button 
                size="lg"
                className="border border-violet-500 hover:bg-violet-500/10"
                variant="outline"
              >
                <Globe className="mr-2 h-4 w-4" />
                Creer mon compte affilie
              </Button>
            </Link>
            <Link to="/contact">
              <Button 
                size="lg"
                variant="outline"
                className="border border-foreground/20 hover:bg-foreground/5"
              >
                <Users className="mr-2 h-4 w-4" />
                Contacter le partenariat
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
