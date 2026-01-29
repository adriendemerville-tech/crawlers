import { motion } from 'framer-motion';
import { Search, ClipboardCopy, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const translations = {
  fr: {
    title: 'Vos corrections techniques, générées en un clic.',
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
    title: 'Your technical fixes, generated in one click.',
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
    title: 'Sus correcciones técnicas, generadas en un clic.',
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
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/audit-expert')}
            className="gap-2 group border-primary/30 hover:border-primary hover:bg-primary/5"
          >
            {t.cta}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
