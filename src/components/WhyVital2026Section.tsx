import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertTriangle, TrendingUp, Eye, ShieldCheck, Zap, Award } from 'lucide-react';

const translations = {
  fr: {
    badge: 'Alerte 2026',
    title: 'Pourquoi c\'est vital en 2026 ?',
    subtitle: 'Les règles du jeu ont changé. Voici ce que vous risquez.',
    points: [
      {
        icon: 'alert',
        title: '80% des recherches passent par Google',
        text: 'Si GoogleBot ne vous lit pas, vous n\'existez pas dans 80% des recherches actuelles. Ce chiffre double chaque année.',
      },
      {
        icon: 'eye',
        title: 'Invisibilité = Mort commerciale',
        text: 'Vos concurrents sont cités par ChatGPT et Gemini. Pas vous ? Vous perdez des leads qualifiés chaque jour.',
      },
      {
        icon: 'shield',
        title: 'E-E-A-T détermine votre citabilité',
        text: 'Les LLM analysent l\'Expérience, l\'Expertise, l\'Autorité et la Fiabilité. Sans signaux forts, zéro citation.',
      },
      {
        icon: 'zap',
        title: 'robots.txt mal configuré = Blocage total',
        text: 'Un test robots.txt AI révèle souvent un blocage involontaire de GPTBot, ClaudeBot ou PerplexityBot.',
      },
      {
        icon: 'trend',
        title: 'Google SGE change la donne',
        text: 'L\'Optimisation Search Generative Experience devient le nouveau SEO. Adaptez-vous ou disparaissez des SERP.',
      },
      {
        icon: 'award',
        title: 'Audit GEO gratuit = Avantage compétitif',
        text: 'Un audit GEO gratuit révèle vos failles en 30 secondes. Vos concurrents l\'ont déjà fait.',
      },
    ],
  },
  en: {
    badge: 'Alert 2026',
    title: 'Why is this vital in 2026?',
    subtitle: 'The rules have changed. Here\'s what you\'re risking.',
    points: [
      {
        icon: 'alert',
        title: '80% of searches go through Google',
        text: 'If GoogleBot can\'t read you, you don\'t exist in 80% of current searches. This doubles every year.',
      },
      {
        icon: 'eye',
        title: 'Invisibility = Commercial death',
        text: 'Your competitors are cited by ChatGPT and Gemini. Not you? You\'re losing qualified leads daily.',
      },
      {
        icon: 'shield',
        title: 'E-E-A-T determines your citability',
        text: 'LLMs analyze Experience, Expertise, Authority, and Trustworthiness. Without strong signals, zero citations.',
      },
      {
        icon: 'zap',
        title: 'Misconfigured robots.txt = Total block',
        text: 'An AI robots.txt test often reveals unintentional blocking of GPTBot, ClaudeBot, or PerplexityBot.',
      },
      {
        icon: 'trend',
        title: 'Google SGE changes everything',
        text: 'Search Generative Experience Optimization is the new SEO. Adapt or disappear from SERPs.',
      },
      {
        icon: 'award',
        title: 'Free GEO audit = Competitive edge',
        text: 'A free GEO audit reveals your weaknesses in 30 seconds. Your competitors have already done it.',
      },
    ],
  },
  es: {
    badge: 'Alerta 2026',
    title: '¿Por qué es vital en 2026?',
    subtitle: 'Las reglas han cambiado. Esto es lo que arriesgas.',
    points: [
      {
        icon: 'alert',
        title: '80% de las búsquedas pasan por Google',
        text: 'Si GoogleBot no te lee, no existes en el 80% de las búsquedas actuales. Esta cifra se duplica cada año.',
      },
      {
        icon: 'eye',
        title: 'Invisibilidad = Muerte comercial',
        text: 'Tus competidores son citados por ChatGPT y Gemini. ¿Tú no? Pierdes leads cualificados cada día.',
      },
      {
        icon: 'shield',
        title: 'E-E-A-T determina tu citabilidad',
        text: 'Los LLM analizan Experiencia, Pericia, Autoridad y Fiabilidad. Sin señales fuertes, cero citas.',
      },
      {
        icon: 'zap',
        title: 'robots.txt mal configurado = Bloqueo total',
        text: 'Un test de robots.txt AI revela a menudo un bloqueo involuntario de GPTBot, ClaudeBot o PerplexityBot.',
      },
      {
        icon: 'trend',
        title: 'Google SGE cambia todo',
        text: 'La Optimización Search Generative Experience es el nuevo SEO. Adáptate o desaparece de las SERP.',
      },
      {
        icon: 'award',
        title: 'Auditoría GEO gratis = Ventaja competitiva',
        text: 'Una auditoría GEO gratuita revela tus debilidades en 30 segundos. Tus competidores ya lo han hecho.',
      },
    ],
  },
};

const iconMap = {
  alert: AlertTriangle,
  eye: Eye,
  shield: ShieldCheck,
  zap: Zap,
  trend: TrendingUp,
  award: Award,
};

export function WhyVital2026Section() {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-background to-muted/30" aria-labelledby="vital-2026-heading">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-1.5 text-sm text-destructive mb-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="font-medium">{t.badge}</span>
          </div>
          <h2 id="vital-2026-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {t.title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </motion.div>

        {/* Points Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {t.points.map((point, index) => {
            const IconComponent = iconMap[point.icon as keyof typeof iconMap] || AlertTriangle;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1.5">{point.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{point.text}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
