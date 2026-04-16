import { memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  PenTool, ArrowRight, Globe, Image, Layers, 
  FileText, Sparkles, Rocket
} from 'lucide-react';
import { motion } from 'framer-motion';

const translations = {
  fr: {
    badge: 'Pipeline éditoriale 4-étapes',
    title: 'Content Architect',
    subtitle: 'Briefing → Stratège → Rédacteur → Tonalisateur',
    description: 'Une pipeline éditoriale en 4 étapes orchestre des LLM spécialisés (routables par domaine) pour produire un contenu SEO/GEO structuré, enrichi d\'images IA, et le publier sur votre CMS — en un clic.',
    features: [
      { icon: Layers, label: 'Pipeline 4-étapes', desc: 'Briefing (workbench + univers de mots-clés) → Stratège (angle, outline) → Rédacteur (titre, corps) → Tonalisateur (voice DNA). Chaque étape est tracée (latence, tokens, coût).' },
      { icon: Sparkles, label: 'Routage LLM par domaine', desc: 'Choisissez le modèle (gemini-flash, gpt-5, gemini-pro…) pour chaque étape × type de contenu. Override manuel ou fallback automatique selon la complexité du site.' },
      { icon: Image, label: 'Images IA intégrées', desc: 'Imagen 3, FLUX, Ideogram — illustrations injectées dans le contenu avec alt text, caption et lazy loading.' },
      { icon: Globe, label: 'Publication multi-CMS', desc: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop ou Odoo — body-only, header/footer gérés par votre thème.' },
    ],
    cta: 'Découvrir Content Architect',
    stats: [
      { value: '4', label: 'étapes orchestrées' },
      { value: '7', label: 'CMS supportés' },
      { value: '100%', label: 'observabilité (logs/coût)' },
    ],
  },
  en: {
    badge: '4-stage editorial pipeline',
    title: 'Content Architect',
    subtitle: 'Briefing → Strategist → Writer → Tonalizer',
    description: 'A 4-stage editorial pipeline orchestrates specialized LLMs (routable per domain) to produce structured SEO/GEO content, enriched with AI images, and publish to your CMS — in one click.',
    features: [
      { icon: Layers, label: '4-stage pipeline', desc: 'Briefing (workbench + keyword universe) → Strategist (angle, outline) → Writer (title, body) → Tonalizer (voice DNA). Every stage logged (latency, tokens, cost).' },
      { icon: Sparkles, label: 'LLM routing per domain', desc: 'Pick the model (gemini-flash, gpt-5, gemini-pro…) for each stage × content type. Manual override or auto fallback based on site complexity.' },
      { icon: Image, label: 'Built-in AI images', desc: 'Imagen 3, FLUX, Ideogram — illustrations injected with alt text, caption and lazy loading.' },
      { icon: Globe, label: 'Multi-CMS publishing', desc: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop or Odoo — body-only, header/footer handled by your theme.' },
    ],
    cta: 'Discover Content Architect',
    stats: [
      { value: '4', label: 'orchestrated stages' },
      { value: '7', label: 'CMS supported' },
      { value: '100%', label: 'observability (logs/cost)' },
    ],
  },
  es: {
    badge: 'Pipeline editorial 4-etapas',
    title: 'Content Architect',
    subtitle: 'Briefing → Estratega → Redactor → Tonalizador',
    description: 'Una pipeline editorial en 4 etapas orquesta LLMs especializados (ruteables por dominio) para producir contenido SEO/GEO estructurado, enriquecido con imágenes IA, y publicarlo en tu CMS — en un clic.',
    features: [
      { icon: Layers, label: 'Pipeline 4-etapas', desc: 'Briefing (workbench + universo de palabras clave) → Estratega (ángulo, esquema) → Redactor (título, cuerpo) → Tonalizador (voice DNA). Cada etapa trazada (latencia, tokens, costo).' },
      { icon: Sparkles, label: 'Routeo LLM por dominio', desc: 'Elige el modelo (gemini-flash, gpt-5, gemini-pro…) para cada etapa × tipo de contenido. Override manual o fallback automático según complejidad.' },
      { icon: Image, label: 'Imágenes IA integradas', desc: 'Imagen 3, FLUX, Ideogram — ilustraciones inyectadas con alt text, caption y lazy loading.' },
      { icon: Globe, label: 'Publicación multi-CMS', desc: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop u Odoo — solo cuerpo, header/footer gestionados por tu tema.' },
    ],
    cta: 'Descubrir Content Architect',
    stats: [
      { value: '4', label: 'etapas orquestadas' },
      { value: '7', label: 'CMS soportados' },
      { value: '100%', label: 'observabilidad (logs/costo)' },
    ],
  },
};

export const ContentArchitectSection = memo(() => {
  const { language } = useLanguage();
  const t = translations[language];

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-emerald-950/5 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(160_60%_40%/0.06),transparent_60%)]" />

      <div className="relative mx-auto max-w-6xl px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-4">
            <Rocket className="h-3 w-3" />
            {t.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
            <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t.subtitle}
          </p>
          <p className="text-sm text-muted-foreground/70 max-w-xl mx-auto mt-3">
            {t.description}
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex justify-center gap-8 sm:gap-16 mb-14"
        >
          {t.stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto mb-12">
          {t.features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                className="group relative rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] transition-all duration-300"
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/15 transition-colors">
                    <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground mb-1">{feature.label}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="text-center space-y-4"
        >
          <Link to="/content-architect">
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-lg shadow-emerald-500/20"
            >
              <PenTool className="h-4 w-4" />
              {t.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          {/* Conversion Optimizer mention */}
          <div className="flex flex-col items-center gap-2 pt-4 border-t border-border/30 max-w-lg mx-auto">
            <p className="text-xs text-muted-foreground">
              {language === 'fr' ? 'Besoin d\'analyser le ton, les CTAs et la conversion de vos pages existantes ?' : language === 'es' ? '¿Necesita analizar el tono, los CTAs y la conversión de sus páginas?' : 'Need to analyze tone, CTAs and conversion on existing pages?'}
            </p>
            <Link to="/conversion-optimizer" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors">
              Conversion Optimizer — {language === 'fr' ? 'Audit UX/CRO contextuel' : language === 'es' ? 'Auditoría UX/CRO contextual' : 'Contextual UX/CRO audit'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

ContentArchitectSection.displayName = 'ContentArchitectSection';
