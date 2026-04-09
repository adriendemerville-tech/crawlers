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
    badge: 'Nouveau',
    title: 'Content Architect',
    subtitle: 'Créez des pages optimisées en quelques secondes',
    description: 'Générez des contenus SEO parfaitement structurés, enrichis d\'images IA et publiez-les directement sur votre CMS — en un clic.',
    features: [
      { icon: FileText, label: 'Contenus SEO structurés', desc: 'H1, H2, FAQ, schema.org, meta — tout est généré automatiquement selon les meilleures pratiques.' },
      { icon: Image, label: 'Images IA intégrées', desc: 'Illustrations cinématiques générées et injectées dans le contenu, avec alt text et lazy loading.' },
      { icon: Globe, label: 'Publication multi-CMS', desc: 'Publiez directement sur WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop ou Odoo.' },
      { icon: Sparkles, label: 'Brief éditorial intelligent', desc: 'Ton, longueur, CTA, liens internes — le brief est calculé automatiquement depuis votre stratégie.' },
    ],
    cta: 'Découvrir Content Architect',
    stats: [
      { value: '7', label: 'CMS supportés' },
      { value: '< 30s', label: 'par article' },
      { value: '100%', label: 'SEO-ready' },
    ],
  },
  en: {
    badge: 'New',
    title: 'Content Architect',
    subtitle: 'Create optimized pages in seconds',
    description: 'Generate perfectly structured SEO content, enriched with AI images, and publish directly to your CMS — in one click.',
    features: [
      { icon: FileText, label: 'Structured SEO content', desc: 'H1, H2, FAQ, schema.org, meta — everything is auto-generated following best practices.' },
      { icon: Image, label: 'Built-in AI images', desc: 'Cinematic illustrations generated and injected into content, with alt text and lazy loading.' },
      { icon: Globe, label: 'Multi-CMS publishing', desc: 'Publish directly to WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop or Odoo.' },
      { icon: Sparkles, label: 'Smart editorial brief', desc: 'Tone, length, CTA, internal links — the brief is auto-calculated from your strategy.' },
    ],
    cta: 'Discover Content Architect',
    stats: [
      { value: '7', label: 'CMS supported' },
      { value: '< 30s', label: 'per article' },
      { value: '100%', label: 'SEO-ready' },
    ],
  },
  es: {
    badge: 'Nuevo',
    title: 'Content Architect',
    subtitle: 'Crea páginas optimizadas en segundos',
    description: 'Genera contenido SEO perfectamente estructurado, enriquecido con imágenes IA, y publícalo directamente en tu CMS — en un clic.',
    features: [
      { icon: FileText, label: 'Contenido SEO estructurado', desc: 'H1, H2, FAQ, schema.org, meta — todo se genera automáticamente siguiendo las mejores prácticas.' },
      { icon: Image, label: 'Imágenes IA integradas', desc: 'Ilustraciones cinematográficas generadas e inyectadas en el contenido, con alt text y lazy loading.' },
      { icon: Globe, label: 'Publicación multi-CMS', desc: 'Publica directamente en WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop u Odoo.' },
      { icon: Sparkles, label: 'Brief editorial inteligente', desc: 'Tono, longitud, CTA, enlaces internos — el brief se calcula automáticamente desde tu estrategia.' },
    ],
    cta: 'Descubrir Content Architect',
    stats: [
      { value: '7', label: 'CMS soportados' },
      { value: '< 30s', label: 'por artículo' },
      { value: '100%', label: 'SEO-ready' },
    ],
  },
};

export const ContentArchitectSection = memo(() => {
  const { language } = useLanguage();
  const t = translations[language];

  return (
    <section className="relative overflow-hidden border-b border-border py-20 sm:py-28">
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400 mb-4">
            <Rocket className="h-3 w-3" />
            {t.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
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
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
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
                    <Icon className="h-5 w-5 text-emerald-400" />
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

          {/* UX Optimizer mention */}
          <div className="flex flex-col items-center gap-2 pt-4 border-t border-border/30 max-w-lg mx-auto">
            <p className="text-xs text-muted-foreground">
              {language === 'fr' ? 'Besoin d\'analyser le ton, les CTAs et la conversion de vos pages existantes ?' : language === 'es' ? '¿Necesita analizar el tono, los CTAs y la conversión de sus páginas?' : 'Need to analyze tone, CTAs and conversion on existing pages?'}
            </p>
            <Link to="/ux-optimizer" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors">
              UX Optimizer — {language === 'fr' ? 'Audit UX/CRO contextuel' : language === 'es' ? 'Auditoría UX/CRO contextual' : 'Contextual UX/CRO audit'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

ContentArchitectSection.displayName = 'ContentArchitectSection';
