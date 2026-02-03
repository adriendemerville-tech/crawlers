import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Building2, Bot, Clock, FileText, Code, TrendingUp, CheckCircle2, XCircle, ArrowRight, Calculator } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

type PageRange = "less5" | "less20" | "less50" | "more100";

interface ServiceOption {
  id: string;
  label: string;
  description: string;
  agencyPrice: number;
  crawlersPrice: number;
  agencyDays: number;
  crawlersDays: number;
}

const PAGE_MULTIPLIERS: Record<PageRange, number> = {
  less5: 1,
  less20: 2,
  less50: 4,
  more100: 8,
};

const PAGE_LABELS: Record<PageRange, string> = {
  less5: "Moins de 5 pages",
  less20: "Moins de 20 pages",
  less50: "Moins de 50 pages",
  more100: "Plus de 100 pages",
};

const SERVICES: ServiceOption[] = [
  {
    id: "technical",
    label: "Audit technique simple",
    description: "Analyse des erreurs techniques, temps de chargement, accessibilité robots",
    agencyPrice: 450,
    crawlersPrice: 0,
    agencyDays: 5,
    crawlersDays: 0,
  },
  {
    id: "complete",
    label: "Audit SEO et GEO complet",
    description: "Analyse sémantique avancée, positionnement LLM, visibilité moteurs génératifs, plans d'actions pilotables",
    agencyPrice: 1200,
    crawlersPrice: 2,
    agencyDays: 10,
    crawlersDays: 0,
  },
  {
    id: "strategy",
    label: "Recommandations stratégiques",
    description: "Plan d'action priorisé, roadmap d'optimisation, analyse concurrentielle",
    agencyPrice: 800,
    crawlersPrice: 4,
    agencyDays: 7,
    crawlersDays: 0,
  },
  {
    id: "scripts",
    label: "Développement des <script> correctifs",
    description: "Code JSON-LD, balises méta, données structurées prêtes à déployer",
    agencyPrice: 600,
    crawlersPrice: 12,
    agencyDays: 5,
    crawlersDays: 0,
  },
];

const CREDIT_PRICE = 0.50;

export default function ComparatifAuditGeo() {
  const [pageRange, setPageRange] = useState<PageRange>("less20");
  const [selectedServices, setSelectedServices] = useState<string[]>(["technical"]);
  const [urgency, setUrgency] = useState<number[]>([1]);

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const pricing = useMemo(() => {
    const multiplier = PAGE_MULTIPLIERS[pageRange];
    const urgencyMultiplier = urgency[0] === 1 ? 1 : urgency[0] === 2 ? 1.3 : 1.5;

    let agencyTotal = 0;
    let crawlersTotal = 0;
    let agencyDays = 0;
    let crawlersDays = 0;

    selectedServices.forEach((serviceId) => {
      const service = SERVICES.find((s) => s.id === serviceId);
      if (service) {
        agencyTotal += service.agencyPrice * multiplier * urgencyMultiplier;
        crawlersTotal += service.crawlersPrice * multiplier;
        agencyDays = Math.max(agencyDays, service.agencyDays);
        crawlersDays = Math.max(crawlersDays, service.crawlersDays);
      }
    });

    // Apply 30% discount on agency prices as requested
    agencyTotal = agencyTotal * 0.70;

    // Adjust days based on urgency
    if (urgency[0] === 2) agencyDays = Math.ceil(agencyDays * 0.7);
    if (urgency[0] === 3) agencyDays = Math.ceil(agencyDays * 0.5);

    return {
      agency: Math.round(agencyTotal),
      crawlers: crawlersTotal,
      crawlersEuros: crawlersTotal * CREDIT_PRICE,
      agencyDays: Math.max(agencyDays, 3),
      crawlersDays: "< 5 min",
      savings: Math.round(agencyTotal - crawlersTotal * CREDIT_PRICE),
      savingsPercent: Math.round(((agencyTotal - crawlersTotal * CREDIT_PRICE) / agencyTotal) * 100),
    };
  }, [pageRange, selectedServices, urgency]);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Combien coûte un audit de référencement GEO ? Comparatif agence vs IA",
    "description": "Comparez les prix d'un audit GEO entre une agence SEO traditionnelle et Crawlers.fr. Simulateur de coût gratuit.",
    "mainEntity": {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Combien coûte un audit GEO en agence ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Un audit GEO complet en agence coûte entre 1 500 € et 5 000 € selon la taille du site et les prestations incluses."
          }
        },
        {
          "@type": "Question",
          "name": "Quelle est la différence de prix entre une agence et Crawlers.fr ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Crawlers.fr propose des audits GEO à partir de 0,50 € le crédit, soit une économie moyenne de 95% par rapport aux tarifs agence."
          }
        }
      ]
    }
  };

  return (
    <>
      <Helmet>
        <title>Combien coûte un audit GEO ? Comparatif agence vs IA | Crawlers.fr</title>
        <meta
          name="description"
          content="Découvrez le coût réel d'un audit de référencement GEO. Comparatif détaillé entre agence SEO et intelligence artificielle. Simulateur de prix gratuit."
        />
        <meta name="keywords" content="audit GEO prix, coût audit référencement, tarif agence SEO, comparatif audit IA, Crawlers.fr" />
        <link rel="canonical" href="https://crawlers.fr/comparatif-audit-geo" />
        <meta property="og:title" content="Combien coûte un audit GEO ? Comparatif agence vs IA" />
        <meta property="og:description" content="Simulateur de prix pour comparer le coût d'un audit GEO entre agence et IA." />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-12 md:py-20">
          {/* Hero Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Badge variant="outline" className="mb-4 text-primary border-primary">
              <Calculator className="w-4 h-4 mr-2" />
              Simulateur de prix
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Combien coûte un audit de référencement GEO ?
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Comparatif détaillé : <span className="text-primary font-semibold">agence traditionnelle</span> vs{" "}
              <span className="text-primary font-semibold">intelligence artificielle</span>
            </p>
          </motion.section>

          {/* Simulator Section */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-20"
          >
            <Card className="max-w-5xl mx-auto border-2">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">Simulateur de coût d'audit GEO</CardTitle>
                <CardDescription>
                  Configurez vos besoins et comparez instantanément les tarifs
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  {/* Configuration */}
                  <div className="space-y-6">
                    <div>
                      <Label className="text-base font-semibold mb-3 block">
                        <FileText className="w-4 h-4 inline mr-2" />
                        Nombre de pages du site
                      </Label>
                      <Select value={pageRange} onValueChange={(v) => setPageRange(v as PageRange)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAGE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-base font-semibold mb-3 block">
                        <Clock className="w-4 h-4 inline mr-2" />
                        Niveau d'urgence
                      </Label>
                      <div className="px-2">
                        <Slider
                          value={urgency}
                          onValueChange={setUrgency}
                          min={1}
                          max={3}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>Standard</span>
                          <span>Prioritaire</span>
                          <span>Urgent</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-base font-semibold mb-3 block">
                        Services inclus
                      </Label>
                      <div className="space-y-3">
                        {SERVICES.map((service) => (
                          <div
                            key={service.id}
                            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedServices.includes(service.id)
                                ? "bg-primary/5 border-primary"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => toggleService(service.id)}
                          >
                            <Checkbox
                              id={service.id}
                              checked={selectedServices.includes(service.id)}
                              onCheckedChange={() => toggleService(service.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={service.id}
                                className="font-medium cursor-pointer"
                              >
                                {service.label}
                              </Label>
                              <p className="text-xs text-muted-foreground mt-1">
                                {service.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Results */}
                  <div className="space-y-6">
                    {/* Agency pricing */}
                    <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
                            <Building2 className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Agence SEO traditionnelle</h3>
                            <p className="text-xs text-muted-foreground">Tarif moyen constaté</p>
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-orange-600 mb-2">
                          {pricing.agency.toLocaleString("fr-FR")} €
                          <span className="text-sm font-normal text-muted-foreground ml-2">HT</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          Délai : {pricing.agencyDays} jours ouvrés
                        </div>
                      </CardContent>
                    </Card>

                    {/* Crawlers.fr pricing */}
                    <Card className="border-primary bg-primary/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
                        -{pricing.savingsPercent}%
                      </div>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Bot className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Crawlers.fr (IA)</h3>
                            <p className="text-xs text-muted-foreground">Analyse automatisée</p>
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-primary mb-2">
                          {pricing.crawlers === 0 ? (
                            <span className="text-success">Gratuit</span>
                          ) : (
                            <>
                              {pricing.crawlers} crédits
                              <span className="text-sm font-normal text-muted-foreground ml-2">
                                ({pricing.crawlersEuros.toFixed(2)} €)
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          Délai : {pricing.crawlersDays}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Savings */}
                    {selectedServices.length > 0 && (
                      <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                        <div className="flex items-center gap-2 text-success font-semibold">
                          <TrendingUp className="w-5 h-5" />
                          Économie réalisée : {pricing.savings.toLocaleString("fr-FR")} €
                        </div>
                      </div>
                    )}

                    <Button asChild size="lg" className="w-full">
                      <Link to="/audit-expert">
                        Lancer mon audit GEO gratuit
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* SEO Content Section - Redesigned with embedded table */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-4xl mx-auto space-y-10"
          >
            {/* Intro */}
            <div className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold">
                Comprendre le coût réel d'un audit de référencement GEO
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                En 2026, <strong className="text-foreground">le référencement ne se limite plus aux moteurs de recherche traditionnels</strong>. 
                L'émergence du GEO (Generative Engine Optimization) bouleverse les pratiques établies. Les entreprises 
                doivent désormais optimiser leur présence non seulement pour Google, mais aussi pour les moteurs de 
                recherche génératifs comme <strong className="text-foreground">ChatGPT Search, Perplexity, Claude</strong> et les AI Overviews.
              </p>
            </div>

            {/* Section 1 */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-2 inline-block">
                Pourquoi les tarifs des agences SEO restent-ils élevés ?
              </h3>
              
              <p className="text-muted-foreground leading-relaxed">
                Les agences de référencement traditionnelles facturent généralement entre <strong className="text-foreground">1 500 € et 5 000 € 
                pour un audit complet</strong>. Ces tarifs s'expliquent par plusieurs facteurs : la main-d'œuvre 
                qualifiée nécessaire, les outils professionnels sous licence, le temps d'analyse manuelle et la 
                rédaction de recommandations personnalisées.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Un consultant SEO senior passe en moyenne 15 à 25 heures sur un audit approfondi.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Cependant, cette approche présente des limites importantes : les délais peuvent s'étendre sur 
                plusieurs semaines, les mises à jour nécessitent de nouveaux audits payants, et <strong className="text-foreground">la dimension 
                GEO est souvent négligée</strong> car les outils traditionnels ne la mesurent pas efficacement.
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-2 inline-block">
                L'alternative IA : rapidité et exhaustivité
              </h3>
              
              <p className="text-muted-foreground leading-relaxed">
                <Link to="/" className="text-primary hover:underline font-medium">Crawlers.fr</Link> propose une approche 
                radicalement différente. Notre plateforme utilise l'intelligence artificielle pour analyser votre 
                site sous l'angle SEO traditionnel <strong className="text-foreground">et</strong> GEO en quelques minutes.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                L'audit technique de base est entièrement gratuit, sans inscription requise.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Pour les analyses avancées — audit sémantique, positionnement sur les LLM, génération de code 
                correctif JSON-LD — le système de crédits permet un contrôle total des coûts. À <strong className="text-foreground">0,50 € 
                le crédit</strong>, un audit complet revient à moins de 5 €, soit <strong className="text-foreground">une économie de plus 
                de 95%</strong> par rapport aux tarifs agence.
              </p>
            </div>

            {/* Embedded Comparison Table */}
            <div className="my-12">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-2 inline-block mb-6">
                Comparatif des fonctionnalités
              </h3>
              
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 bg-muted/30">
                      <th className="text-left p-4 font-semibold">Fonctionnalité</th>
                      <th className="text-center p-4">
                        <div className="flex items-center justify-center gap-2">
                          <Building2 className="w-5 h-5 text-orange-600" />
                          <span className="font-semibold">Agence</span>
                        </div>
                      </th>
                      <th className="text-center p-4">
                        <div className="flex items-center justify-center gap-2">
                          <Bot className="w-5 h-5 text-primary" />
                          <span className="font-semibold">Crawlers.fr</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: "Audit technique instantané", agency: true, crawlers: true },
                      { feature: "Analyse des données structurées", agency: true, crawlers: true },
                      { feature: "Visibilité sur ChatGPT/Perplexity", agency: false, crawlers: true },
                      { feature: "Plans d'actions pilotables", agency: false, crawlers: true },
                      { feature: "Génération de code correctif", agency: true, crawlers: true },
                      { feature: "Résultats en moins de 5 minutes", agency: false, crawlers: true },
                      { feature: "Mises à jour illimitées", agency: false, crawlers: true },
                      { feature: "Accompagnement humain personnalisé", agency: true, crawlers: false },
                      { feature: "Rapport exportable PDF", agency: true, crawlers: true },
                    ].map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-medium">{row.feature}</td>
                        <td className="text-center p-4">
                          {row.agency ? (
                            <CheckCircle2 className="w-5 h-5 text-success mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive mx-auto" />
                          )}
                        </td>
                        <td className="text-center p-4">
                          {row.crawlers ? (
                            <CheckCircle2 className="w-5 h-5 text-success mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3 */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-2 inline-block">
                Que vérifie un audit GEO complet ?
              </h3>
              
              <p className="text-muted-foreground leading-relaxed">
                Un audit GEO moderne analyse plusieurs dimensions critiques pour votre visibilité :
              </p>
              
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span><strong className="text-foreground">Accessibilité des crawlers IA</strong> : vos pages sont-elles accessibles aux robots de ChatGPT, Anthropic et Google AI ?</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span><strong className="text-foreground">Données structurées</strong> : présence et validité du balisage JSON-LD pour les entités, produits, FAQ</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span><strong className="text-foreground">Fichiers de configuration</strong> : robots.txt, llms.txt, ai-plugin.json correctement configurés</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span><strong className="text-foreground">Qualité du contenu</strong> : structure sémantique, hiérarchie des headings, densité d'information</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span><strong className="text-foreground">Citations et mentions</strong> : comment votre marque est référencée par les moteurs génératifs</span>
                </li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-2 inline-block">
                Agence ou IA : que choisir ?
              </h3>
              
              <p className="text-muted-foreground leading-relaxed">
                Le choix dépend de vos besoins spécifiques. L'accompagnement humain reste pertinent 
                pour les stratégies complexes, les refontes de site ou les formations d'équipe.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                En revanche, pour un diagnostic rapide, un suivi régulier ou des corrections techniques, 
                l'automatisation par IA offre un rapport qualité-prix imbattable.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Notre recommandation : commencez par un <Link to="/audit-expert" className="text-primary hover:underline font-medium">
                audit gratuit sur Crawlers.fr</Link> pour identifier vos priorités, puis décidez si un accompagnement 
                agence complémentaire est nécessaire pour votre stratégie globale.
              </p>
            </div>

            {/* Section 5 - Le meilleur dispositif */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-2 inline-block">
                Le meilleur dispositif : bien choisir son agence, la challenger avec Crawlers.fr
              </h3>
              
              <p className="text-muted-foreground leading-relaxed">
                La question n'est pas tant de choisir entre une agence SEO et une solution IA, mais plutôt 
                de <strong className="text-foreground">construire un dispositif intelligent qui tire le meilleur des deux mondes</strong>. 
                Les entreprises les plus performantes en référencement adoptent une approche hybride : elles s'appuient 
                sur l'expertise humaine pour la stratégie globale et utilisent l'automatisation pour le contrôle qualité 
                et le suivi opérationnel.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Le premier réflexe, avant de signer un contrat avec une agence, devrait être de 
                <strong className="text-foreground"> réaliser un audit indépendant de votre site</strong>. 
                Crawlers.fr vous permet d'obtenir en quelques minutes un diagnostic objectif de votre situation SEO et GEO. 
                Ce rapport constitue une base factuelle précieuse pour challenger les propositions commerciales des agences. 
                Combien d'entre elles mentionnent spontanément votre visibilité sur les moteurs génératifs ? 
                Combien intègrent l'optimisation pour ChatGPT ou Perplexity dans leur offre standard ?
              </p>

              <p className="text-muted-foreground leading-relaxed">
                En disposant de votre propre audit, vous pouvez <strong className="text-foreground">négocier en position de force</strong>. 
                Vous savez exactement quels problèmes techniques affectent votre site, quelles données structurées 
                sont manquantes, comment les crawlers IA perçoivent vos pages. L'agence ne peut plus vous vendre 
                des prestations génériques : elle doit répondre à des besoins identifiés et mesurables. 
                C'est la fin de l'asymétrie d'information qui profitait historiquement aux prestataires.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Une fois la collaboration engagée avec une agence, Crawlers.fr devient un 
                <strong className="text-foreground"> outil de suivi et de contrôle continu</strong>. 
                Lancez un audit chaque mois pour vérifier que les optimisations promises ont bien été implémentées. 
                Comparez l'évolution de votre score GEO dans le temps. Identifiez les régressions avant qu'elles 
                n'impactent votre trafic. Cette vigilance constante, impossible à maintenir manuellement sans 
                coûts prohibitifs, devient accessible pour quelques crédits.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Le véritable enjeu en 2026 n'est plus seulement d'être bien référencé sur Google, mais 
                d'<strong className="text-foreground">exister dans les réponses des IA génératives</strong>. 
                Or, ce terrain est encore mal maîtrisé par la plupart des agences traditionnelles. Leurs outils, 
                leurs méthodes, leurs indicateurs de performance ont été conçus pour un web dominé par les moteurs 
                de recherche classiques. Le GEO représente un changement de paradigme qu'elles n'ont pas toutes intégré.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                En combinant l'intelligence stratégique d'une agence spécialisée et la puissance analytique 
                de Crawlers.fr, vous construisez un dispositif résilient. L'agence apporte la vision long terme, 
                la créativité éditoriale, l'accompagnement humain. La plateforme IA garantit l'excellence technique, 
                la réactivité, la mesure objective des progrès. <strong className="text-foreground">C'est cette complémentarité 
                qui fait la différence</strong> sur des marchés de plus en plus concurrentiels.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Enfin, n'oubliez pas que le référencement est un marathon, pas un sprint. Les algorithmes évoluent, 
                les comportements utilisateurs changent, les moteurs génératifs gagnent en importance. 
                Disposer d'un outil de diagnostic instantané et abordable comme Crawlers.fr vous permet de 
                <strong className="text-foreground"> rester agile et réactif</strong>, quelles que soient les évolutions du marché. 
                C'est cette capacité d'adaptation qui distinguera les sites visibles de demain des sites invisibles.
              </p>
            </div>
            {/* CTA Card */}
            <Card className="bg-primary/5 border-primary mt-12">
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold mb-3">Prêt à auditer votre site ?</h3>
                <p className="text-muted-foreground mb-6 text-lg">
                  Découvrez gratuitement votre score GEO et les optimisations prioritaires.
                </p>
                <Button asChild size="lg" className="text-base px-8">
                  <Link to="/audit-expert">
                    Lancer l'audit gratuit
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.section>
        </main>

        <Footer />
      </div>
    </>
  );
}
