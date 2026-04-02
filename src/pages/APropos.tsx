import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, Brain, Shield, Zap, Code2, BarChart3, Globe } from 'lucide-react';

const translations = {
  fr: {
    title: 'À propos de Crawlers.fr — Audit SEO & GEO par IA',
    metaDesc: 'Découvrez l\'histoire de Crawlers.fr, plateforme SaaS d\'audit SEO & GEO créée par Adrien de Volontat. Mission, technologie, valeurs et vision 2026.',
    heading: 'À propos de Crawlers.fr',
    subtitle: 'Premier outil francophone d\'audit SEO, GEO et visibilité IA — conçu pour les professionnels du référencement.',
    missionTitle: 'Notre mission',
    missionText: 'Démocratiser l\'audit SEO expert et la visibilité IA. Crawlers.fr permet à toute équipe marketing de diagnostiquer, corriger et optimiser son site pour les moteurs de recherche classiques ET les moteurs de réponse IA (ChatGPT, Gemini, Perplexity) — en quelques minutes, sans compétence technique.',
    storyTitle: 'L\'histoire',
    storyText: 'Crawlers.fr est né d\'un constat simple : en 2026, les outils SEO existants ignorent encore largement les moteurs de réponse IA. Les agences et freelances SEO doivent jongler entre 5 à 8 outils différents pour couvrir le SEO technique, le GEO, le maillage interne et la génération de contenu. Crawlers.fr réunit tout dans une seule plateforme, avec une approche "audit-first" qui produit des résultats actionnables immédiatement.',
    founderTitle: 'Le fondateur',
    founderName: 'Adrien de Volontat',
    founderRole: 'Fondateur & CTO',
    founderBio: 'Ingénieur logiciel français spécialisé en architectures serverless et intelligence artificielle appliquée au SEO. Adrien a conçu l\'intégralité de la stack technique de Crawlers.fr : 7 algorithmes propriétaires, plus de 180 fonctions edge en production, et une architecture multi-fallback qui garantit la fiabilité de chaque audit. Son objectif : transformer l\'audit SEO d\'une prestation artisanale en un diagnostic automatisé, reproductible et mesurable.',
    techTitle: 'Technologie',
    techItems: [
      { icon: 'code', label: '221 000+ lignes de code', desc: 'Architecture serverless, 183+ edge functions en production' },
      { icon: 'brain', label: '7 algorithmes propriétaires', desc: 'IAS, Anti-Wiki, Triangle Prédictif, Score GEO, Citabilité LLM, Empreinte Lexicale, Red Team' },
      { icon: 'shield', label: 'RGPD natif', desc: 'Hébergement européen, pare-feu de données Google, isolation RLS par utilisateur' },
      { icon: 'globe', label: 'Multi-modèles IA', desc: 'Gemini 2.5 Pro, GPT-5, Claude, Grok — pour auditer ET être audité par les LLMs' },
    ],
    valuesTitle: 'Nos valeurs',
    values: [
      { title: 'Transparence', desc: 'Chaque score est accompagné de sa méthodologie. Pas de boîte noire.' },
      { title: 'Précision', desc: 'Données vérifiées en temps réel via DataForSEO, Google APIs et crawl direct.' },
      { title: 'Actionnable', desc: 'Chaque diagnostic produit un correctif déployable, pas un simple constat.' },
      { title: 'Indépendance', desc: 'Aucune affiliation à un moteur de recherche. Analyse objective et impartiale.' },
    ],
    numbersTitle: 'Crawlers.fr en chiffres',
    numbers: [
      { value: '200+', label: 'critères d\'audit SEO' },
      { value: '8', label: 'LLMs testés en parallèle' },
      { value: '7', label: 'CMS supportés' },
      { value: '< 60s', label: 'temps de génération d\'audit' },
    ],
    ctaTitle: 'Prêt à auditer votre site ?',
    ctaText: 'Lancez votre premier audit SEO & GEO gratuitement, sans inscription.',
    ctaBtn: 'Lancer un audit gratuit',
  },
  en: {
    title: 'About Crawlers.fr — AI-Powered SEO & GEO Audit',
    metaDesc: 'Learn about Crawlers.fr, the SaaS SEO & GEO audit platform created by Adrien de Volontat. Mission, technology, values and 2026 vision.',
    heading: 'About Crawlers.fr',
    subtitle: 'The first French-language SEO, GEO and AI visibility audit tool — built for search professionals.',
    missionTitle: 'Our Mission',
    missionText: 'Democratize expert SEO auditing and AI visibility. Crawlers.fr enables any marketing team to diagnose, fix and optimize their site for both traditional search engines AND AI answer engines (ChatGPT, Gemini, Perplexity) — in minutes, without technical expertise.',
    storyTitle: 'The Story',
    storyText: 'Crawlers.fr was born from a simple observation: in 2026, existing SEO tools still largely ignore AI answer engines. Agencies and SEO freelancers must juggle 5 to 8 different tools to cover technical SEO, GEO, internal linking and content generation. Crawlers.fr brings everything together in a single platform, with an "audit-first" approach that produces immediately actionable results.',
    founderTitle: 'The Founder',
    founderName: 'Adrien de Volontat',
    founderRole: 'Founder & CTO',
    founderBio: 'French software engineer specialized in serverless architectures and AI applied to SEO. Adrien designed the entire technical stack of Crawlers.fr: 7 proprietary algorithms, 180+ edge functions in production, and a multi-fallback architecture ensuring reliability of every audit. His goal: transform SEO auditing from a craft service into an automated, reproducible and measurable diagnostic.',
    techTitle: 'Technology',
    techItems: [
      { icon: 'code', label: '221,000+ lines of code', desc: 'Serverless architecture, 183+ edge functions in production' },
      { icon: 'brain', label: '7 proprietary algorithms', desc: 'IAS, Anti-Wiki, Predictive Triangle, GEO Score, LLM Citability, Lexical Footprint, Red Team' },
      { icon: 'shield', label: 'GDPR native', desc: 'European hosting, Google data firewall, per-user RLS isolation' },
      { icon: 'globe', label: 'Multi-model AI', desc: 'Gemini 2.5 Pro, GPT-5, Claude, Grok — to audit AND be audited by LLMs' },
    ],
    valuesTitle: 'Our Values',
    values: [
      { title: 'Transparency', desc: 'Every score comes with its methodology. No black box.' },
      { title: 'Precision', desc: 'Real-time verified data via DataForSEO, Google APIs and direct crawling.' },
      { title: 'Actionable', desc: 'Every diagnostic produces a deployable fix, not just an observation.' },
      { title: 'Independence', desc: 'No affiliation with any search engine. Objective and impartial analysis.' },
    ],
    numbersTitle: 'Crawlers.fr in Numbers',
    numbers: [
      { value: '200+', label: 'SEO audit criteria' },
      { value: '8', label: 'LLMs tested in parallel' },
      { value: '7', label: 'CMS supported' },
      { value: '< 60s', label: 'audit generation time' },
    ],
    ctaTitle: 'Ready to audit your site?',
    ctaText: 'Launch your first free SEO & GEO audit — no signup required.',
    ctaBtn: 'Start a free audit',
  },
  es: {
    title: 'Acerca de Crawlers.fr — Auditoría SEO & GEO con IA',
    metaDesc: 'Conozca la historia de Crawlers.fr, plataforma SaaS de auditoría SEO & GEO creada por Mukesh Bagri. Misión, tecnología, valores y visión 2026.',
    heading: 'Acerca de Crawlers.fr',
    subtitle: 'La primera herramienta francófona de auditoría SEO, GEO y visibilidad IA — diseñada para profesionales del posicionamiento.',
    missionTitle: 'Nuestra misión',
    missionText: 'Democratizar la auditoría SEO experta y la visibilidad IA. Crawlers.fr permite a cualquier equipo de marketing diagnosticar, corregir y optimizar su sitio para los motores de búsqueda clásicos Y los motores de respuesta IA (ChatGPT, Gemini, Perplexity) — en minutos, sin competencia técnica.',
    storyTitle: 'La historia',
    storyText: 'Crawlers.fr nació de una observación simple: en 2026, las herramientas SEO existentes todavía ignoran en gran medida los motores de respuesta IA. Las agencias y freelancers SEO deben hacer malabarismos con 5 a 8 herramientas diferentes. Crawlers.fr reúne todo en una sola plataforma, con un enfoque "audit-first" que produce resultados inmediatamente accionables.',
    founderTitle: 'El fundador',
    founderName: 'Mukesh Bagri',
    founderRole: 'Fundador & CTO',
    founderBio: 'Ingeniero de software especializado en arquitecturas serverless e inteligencia artificial aplicada al SEO. Mukesh diseñó toda la pila técnica de Crawlers.fr: 7 algoritmos propietarios, más de 180 funciones edge en producción, y una arquitectura multi-fallback que garantiza la fiabilidad de cada auditoría.',
    techTitle: 'Tecnología',
    techItems: [
      { icon: 'code', label: '221.000+ líneas de código', desc: 'Arquitectura serverless, 183+ funciones edge en producción' },
      { icon: 'brain', label: '7 algoritmos propietarios', desc: 'IAS, Anti-Wiki, Triángulo Predictivo, Score GEO, Citabilidad LLM, Huella Léxica, Red Team' },
      { icon: 'shield', label: 'RGPD nativo', desc: 'Alojamiento europeo, firewall de datos Google, aislamiento RLS por usuario' },
      { icon: 'globe', label: 'IA multi-modelo', desc: 'Gemini 2.5 Pro, GPT-5, Claude, Grok' },
    ],
    valuesTitle: 'Nuestros valores',
    values: [
      { title: 'Transparencia', desc: 'Cada score viene con su metodología. Sin caja negra.' },
      { title: 'Precisión', desc: 'Datos verificados en tiempo real vía DataForSEO, Google APIs y crawl directo.' },
      { title: 'Accionable', desc: 'Cada diagnóstico produce un correctivo desplegable, no solo una observación.' },
      { title: 'Independencia', desc: 'Sin afiliación a ningún motor de búsqueda. Análisis objetivo e imparcial.' },
    ],
    numbersTitle: 'Crawlers.fr en cifras',
    numbers: [
      { value: '200+', label: 'criterios de auditoría SEO' },
      { value: '8', label: 'LLMs testados en paralelo' },
      { value: '7', label: 'CMS soportados' },
      { value: '< 60s', label: 'tiempo de generación de auditoría' },
    ],
    ctaTitle: '¿Listo para auditar su sitio?',
    ctaText: 'Lance su primera auditoría SEO & GEO gratis, sin registro.',
    ctaBtn: 'Iniciar auditoría gratuita',
  },
};

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  code: Code2,
  brain: Brain,
  shield: Shield,
  globe: Globe,
};

export default function APropos() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;
  useCanonicalHreflang('/a-propos');

  // Inject Person JSON-LD
  useEffect(() => {
    const personSchema = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Mukesh Bagri",
      "jobTitle": "Fondateur & CTO de Crawlers.fr",
      "url": "https://crawlers.fr/a-propos",
      "worksFor": {
        "@type": "Organization",
        "name": "Crawlers.fr",
        "url": "https://crawlers.fr"
      },
      "knowsAbout": ["SEO", "GEO", "Generative Engine Optimization", "Architecture serverless", "Intelligence artificielle"],
      "sameAs": [
        "https://www.linkedin.com/in/mukesh-bagri/"
      ]
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'founder-person');
    script.textContent = JSON.stringify(personSchema);
    document.head.appendChild(script);
    return () => {
      document.querySelectorAll('script[data-schema="founder-person"]').forEach(el => el.remove());
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{t.title}</title>
        <meta name="description" content={t.metaDesc} />
        <meta property="og:title" content={t.title} />
        <meta property="og:description" content={t.metaDesc} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crawlers.fr/a-propos" />
      </Helmet>
      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-16 space-y-20">
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            {t.heading}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t.subtitle}</p>
        </section>

        {/* Mission */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{t.missionTitle}</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-base">{t.missionText}</p>
        </section>

        {/* Story */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">{t.storyTitle}</h2>
          <p className="text-muted-foreground leading-relaxed text-base">{t.storyText}</p>
        </section>

        {/* Founder */}
        <section className="rounded-2xl border border-border bg-card p-8 space-y-4">
          <h2 className="text-2xl font-bold text-foreground">{t.founderTitle}</h2>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="shrink-0 w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl font-bold text-primary">
              MB
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">{t.founderName}</h3>
              <p className="text-sm text-primary font-medium">{t.founderRole}</p>
              <p className="text-muted-foreground leading-relaxed">{t.founderBio}</p>
            </div>
          </div>
        </section>

        {/* Tech */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">{t.techTitle}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {t.techItems.map((item, i) => {
              const Icon = iconMap[item.icon] || Zap;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{item.label}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Values */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">{t.valuesTitle}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {t.values.map((v, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
                <h3 className="font-semibold text-foreground">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Numbers */}
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-8 space-y-6">
          <h2 className="text-2xl font-bold text-foreground text-center">{t.numbersTitle}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {t.numbers.map((n, i) => (
              <div key={i} className="text-center space-y-1">
                <div className="text-3xl font-bold text-primary">{n.value}</div>
                <div className="text-sm text-muted-foreground">{n.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center space-y-4 pb-8">
          <h2 className="text-2xl font-bold text-foreground">{t.ctaTitle}</h2>
          <p className="text-muted-foreground">{t.ctaText}</p>
          <Link to="/audit-expert">
            <Button size="lg" className="gap-2">
              {t.ctaBtn} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
