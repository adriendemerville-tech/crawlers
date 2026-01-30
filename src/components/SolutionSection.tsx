import { motion } from 'framer-motion';
import { Search, ClipboardCopy, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const translations = {
  fr: {
    title: 'Vos corrections techniques, générées en 3 clics.',
    subtitlePart1: 'Identifier un problème sans solution, c\'est frustrant.',
    subtitleHighlight: 'Audit Expert',
    subtitlePart2: ', recevez le',
    subtitleCode: 'code',
    subtitlePart3: 'correctif prêt à être déployé sur votre site.',
    pillar1Title: 'Diagnostic Clair',
    pillar1Desc: 'Analysez votre visibilité auprès des IA en toute sérénité. Chaque point d\'amélioration est expliqué simplement.',
    pillar2Title: 'Code Prêt-à-Copier',
    pillar2Desc: 'Recevez instantanément les snippets validés : JSON-LD, balises Meta, directives Robots. Un copier-coller suffit.',
    pillar3Title: 'Vérification Immédiate',
    pillar3Desc: 'Relancez l\'audit après modification et confirmez que vos optimisations sont bien prises en compte.',
    cta: 'Voir un exemple de correctif',
  },
  en: {
    title: 'Your technical fixes, generated in 3 clicks.',
    subtitlePart1: 'Identifying a problem without a solution is frustrating.',
    subtitleHighlight: 'Expert Audit',
    subtitlePart2: ', receive the',
    subtitleCode: 'code',
    subtitlePart3: 'ready to deploy on your site.',
    pillar1Title: 'Clear Diagnosis',
    pillar1Desc: 'Analyze your visibility to AI with peace of mind. Each improvement point is explained simply.',
    pillar2Title: 'Ready-to-Copy Code',
    pillar2Desc: 'Instantly receive validated snippets: JSON-LD, Meta tags, Robots directives. A simple copy-paste is enough.',
    pillar3Title: 'Instant Verification',
    pillar3Desc: 'Re-run the audit after modification and confirm that your optimizations are taken into account.',
    cta: 'See an example of a fix',
  },
  es: {
    title: 'Sus correcciones técnicas, generadas en 3 clics.',
    subtitlePart1: 'Identificar un problema sin solución es frustrante.',
    subtitleHighlight: 'Auditoría Experta',
    subtitlePart2: ', reciba el',
    subtitleCode: 'código',
    subtitlePart3: 'correctivo listo para implementar en su sitio.',
    pillar1Title: 'Diagnóstico Claro',
    pillar1Desc: 'Analice su visibilidad ante la IA con tranquilidad. Cada punto de mejora se explica de forma sencilla.',
    pillar2Title: 'Código Listo para Copiar',
    pillar2Desc: 'Reciba instantáneamente los snippets validados: JSON-LD, etiquetas Meta, directivas Robots. Un simple copiar-pegar es suficiente.',
    pillar3Title: 'Verificación Instantánea',
    pillar3Desc: 'Vuelva a ejecutar la auditoría después de la modificación y confirme que sus optimizaciones se tienen en cuenta.',
    cta: 'Ver un ejemplo de corrección',
  },
};

const pillars = [
  {
    icon: Search,
    titleKey: 'pillar1Title' as const,
    descKey: 'pillar1Desc' as const,
  },
  {
    icon: ClipboardCopy,
    titleKey: 'pillar2Title' as const,
    descKey: 'pillar2Desc' as const,
  },
  {
    icon: CheckCircle,
    titleKey: 'pillar3Title' as const,
    descKey: 'pillar3Desc' as const,
  },
];

export function SolutionSection() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = translations[language];

  return (
    <section className="pt-4 pb-10 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            {t.title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t.subtitlePart1}
            <br />
            Après chaque <span className="text-primary font-bold">{t.subtitleHighlight}</span>
            {t.subtitlePart2} <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-foreground">{t.subtitleCode}</code> {t.subtitlePart3}
          </p>
        </motion.div>

        {/* Three Pillars */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.titleKey}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="group"
            >
              <div className="relative p-8 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 h-full">
                {/* Icon */}
                <div className="mb-5">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                    <pillar.icon className="w-6 h-6" />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {t[pillar.titleKey]}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t[pillar.descKey]}
                </p>

                {/* Subtle accent line */}
                <div className="absolute bottom-0 left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center"
        >
          <div className="relative inline-flex flex-col items-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/audit-expert')}
              className="relative z-10 gap-1.5 group font-mono border-2 border-violet-500/50 hover:border-violet-500 hover:bg-violet-500/5 bg-violet-500/5 text-foreground transition-all duration-300 shadow-[0_3px_8px_rgba(0,0,0,0.12)]"
            >
              <span className="text-violet-400">&lt;</span>
              <span className="text-pink-500">button</span>
              <span className="text-cyan-500 ml-1">onClick</span>
              <span className="text-foreground/70">=</span>
              <span className="text-amber-500">"</span>
              <span className="text-violet-500 font-semibold">{t.cta}</span>
              <span className="text-amber-500">"</span>
              <span className="text-violet-400">/&gt;</span>
              {/* Arrow with circle - classic button style */}
              <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-500 text-white group-hover:bg-violet-600 transition-colors">
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={3} />
              </span>
            </Button>
            {/* Golden reflection bar with shimmer animation */}
            <div className="relative mt-2.5 w-[90%] h-1.5 rounded-full bg-gradient-to-r from-amber-400/20 via-amber-400/60 to-amber-400/20 overflow-hidden blur-[1px]">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
            </div>
            <div className="mt-0.5 w-[70%] h-1 rounded-full bg-gradient-to-r from-transparent via-amber-500/40 to-transparent blur-[3px]" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
