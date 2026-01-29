import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Euro, TrendingUp, Users, Building2, 
  CheckCircle2, AlertTriangle, PiggyBank,
  BarChart3, Target, Wrench
} from 'lucide-react';

const translations = {
  fr: {
    title: "Budget marketing digital : la réalité des TPE et PME en 2026",
    subtitle: "Comprendre les investissements moyens pour optimiser votre stratégie digitale",
    intro: `En 2026, le marketing digital représente un poste de dépense stratégique pour les très petites entreprises (TPE) et les petites et moyennes entreprises (PME). Selon les dernières études sectorielles, les TPE consacrent en moyenne entre 2 000 € et 8 000 € par an à leur présence en ligne, tandis que les PME investissent généralement entre 15 000 € et 50 000 € annuellement. Ces budgets couvrent le référencement naturel (SEO), la publicité payante (SEA), la gestion des réseaux sociaux et la création de contenu. Cependant, une part significative de ces investissements est souvent mal allouée faute d'outils d'analyse adaptés.`,
    satisfactionTitle: "Satisfaction et retour sur investissement",
    satisfactionText: `Les enquêtes menées auprès des dirigeants de TPE-PME révèlent un taux de satisfaction mitigé concernant leurs dépenses marketing digitales. Seulement 34% des entrepreneurs se déclarent satisfaits de leur visibilité en ligne, tandis que 58% estiment ne pas maîtriser suffisamment les indicateurs de performance (KPI) de leur site web. Le principal frein identifié reste le manque de temps et d'expertise technique pour analyser correctement les données et ajuster les stratégies. C'est précisément là que des outils comme Crawlers AI apportent une valeur ajoutée considérable en automatisant l'analyse et en fournissant des recommandations actionnables.`,
    auditCostTitle: "Coût moyen d'un audit SEO professionnel",
    auditCostText: `Un audit SEO réalisé par une agence spécialisée coûte en moyenne entre 1 500 € et 5 000 € pour une TPE, et peut atteindre 10 000 € à 25 000 € pour une PME avec un site e-commerce complexe. Ces tarifs incluent généralement l'analyse technique, l'audit de contenu, l'étude des backlinks et un rapport de recommandations. Cependant, ces audits ponctuels deviennent rapidement obsolètes car le web évolue constamment. Avec l'émergence de l'intelligence artificielle générative et du GEO (Generative Engine Optimization), les critères d'optimisation changent plus vite que jamais.`,
    maintenanceTitle: "Maintenance et suivi continu",
    maintenanceText: `La maintenance d'un site web professionnel représente un coût récurrent de 100 € à 500 € par mois pour les TPE, et de 500 € à 2 000 € mensuels pour les PME. Ce budget couvre les mises à jour de sécurité, l'hébergement, les sauvegardes et les corrections de bugs. Mais attention : la maintenance technique ne suffit plus en 2026. Il faut également surveiller en permanence la compatibilité avec les crawlers IA (GPTBot, ClaudeBot, PerplexityBot) et adapter le contenu aux exigences des moteurs de réponse génératifs. Sans cette veille active, un site peut perdre sa visibilité du jour au lendemain.`,
    tableTitle: "Comparatif des investissements marketing digital",
    tableTpe: "TPE (1-10 salariés)",
    tablePme: "PME (11-250 salariés)",
    tableRows: [
      { label: "Budget marketing annuel", tpe: "2 000 € - 8 000 €", pme: "15 000 € - 50 000 €" },
      { label: "Coût audit SEO ponctuel", tpe: "1 500 € - 5 000 €", pme: "5 000 € - 25 000 €" },
      { label: "Maintenance mensuelle", tpe: "100 € - 500 €", pme: "500 € - 2 000 €" },
      { label: "Taux de satisfaction ROI", tpe: "32%", pme: "38%" },
      { label: "Maîtrise des KPI", tpe: "28%", pme: "42%" },
    ],
    conclusion: `Face à ces réalités budgétaires, Crawlers AI propose une alternative intelligente : un audit instantané, gratuit et illimité qui permet aux TPE et PME de surveiller leur visibilité IA sans mobiliser de budget conséquent. Notre outil analyse en temps réel les facteurs GEO et SEO critiques, génère automatiquement le code correctif nécessaire et permet une vérification immédiate des optimisations. C'est la démocratisation de l'expertise technique, accessible à toutes les entreprises quelle que soit leur taille.`,
  },
  en: {
    title: "Digital Marketing Budget: The Reality for SMEs in 2026",
    subtitle: "Understanding average investments to optimize your digital strategy",
    intro: `In 2026, digital marketing represents a strategic expense for very small businesses (VSBs) and small and medium enterprises (SMEs). According to the latest industry studies, VSBs spend an average of €2,000 to €8,000 per year on their online presence, while SMEs typically invest between €15,000 and €50,000 annually. These budgets cover organic search (SEO), paid advertising (SEA), social media management and content creation. However, a significant portion of these investments is often poorly allocated due to lack of suitable analysis tools.`,
    satisfactionTitle: "Satisfaction and Return on Investment",
    satisfactionText: `Surveys conducted among VSB-SME managers reveal a mixed satisfaction rate regarding their digital marketing expenses. Only 34% of entrepreneurs say they are satisfied with their online visibility, while 58% feel they do not sufficiently master their website's key performance indicators (KPIs). The main barrier identified remains the lack of time and technical expertise to properly analyze data and adjust strategies. This is precisely where tools like Crawlers AI provide considerable added value by automating analysis and providing actionable recommendations.`,
    auditCostTitle: "Average Cost of a Professional SEO Audit",
    auditCostText: `An SEO audit performed by a specialized agency costs on average between €1,500 and €5,000 for a VSB, and can reach €10,000 to €25,000 for an SME with a complex e-commerce site. These rates generally include technical analysis, content audit, backlink study and a recommendations report. However, these one-time audits quickly become outdated because the web is constantly evolving. With the emergence of generative artificial intelligence and GEO (Generative Engine Optimization), optimization criteria are changing faster than ever.`,
    maintenanceTitle: "Maintenance and Continuous Monitoring",
    maintenanceText: `Professional website maintenance represents a recurring cost of €100 to €500 per month for VSBs, and €500 to €2,000 monthly for SMEs. This budget covers security updates, hosting, backups and bug fixes. But beware: technical maintenance is no longer enough in 2026. You also need to constantly monitor compatibility with AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and adapt content to the requirements of generative answer engines. Without this active monitoring, a site can lose its visibility overnight.`,
    tableTitle: "Digital Marketing Investment Comparison",
    tableTpe: "VSB (1-10 employees)",
    tablePme: "SME (11-250 employees)",
    tableRows: [
      { label: "Annual marketing budget", tpe: "€2,000 - €8,000", pme: "€15,000 - €50,000" },
      { label: "One-time SEO audit cost", tpe: "€1,500 - €5,000", pme: "€5,000 - €25,000" },
      { label: "Monthly maintenance", tpe: "€100 - €500", pme: "€500 - €2,000" },
      { label: "ROI satisfaction rate", tpe: "32%", pme: "38%" },
      { label: "KPI mastery", tpe: "28%", pme: "42%" },
    ],
    conclusion: `Faced with these budget realities, Crawlers AI offers an intelligent alternative: an instant, free and unlimited audit that allows VSBs and SMEs to monitor their AI visibility without mobilizing a significant budget. Our tool analyzes critical GEO and SEO factors in real time, automatically generates the necessary corrective code and allows immediate verification of optimizations. It's the democratization of technical expertise, accessible to all businesses regardless of their size.`,
  },
  es: {
    title: "Presupuesto de Marketing Digital: La Realidad de las PYMES en 2026",
    subtitle: "Comprender las inversiones promedio para optimizar su estrategia digital",
    intro: `En 2026, el marketing digital representa un gasto estratégico para las muy pequeñas empresas (MYPES) y las pequeñas y medianas empresas (PYMES). Según los últimos estudios sectoriales, las MYPES destinan en promedio entre 2.000 € y 8.000 € al año a su presencia en línea, mientras que las PYMES suelen invertir entre 15.000 € y 50.000 € anuales. Estos presupuestos cubren el posicionamiento orgánico (SEO), la publicidad de pago (SEA), la gestión de redes sociales y la creación de contenido. Sin embargo, una parte significativa de estas inversiones a menudo está mal asignada por falta de herramientas de análisis adecuadas.`,
    satisfactionTitle: "Satisfacción y Retorno de la Inversión",
    satisfactionText: `Las encuestas realizadas entre los directivos de MYPES-PYMES revelan una tasa de satisfacción mixta respecto a sus gastos de marketing digital. Solo el 34% de los empresarios se declaran satisfechos con su visibilidad en línea, mientras que el 58% considera que no domina suficientemente los indicadores clave de rendimiento (KPI) de su sitio web. El principal obstáculo identificado sigue siendo la falta de tiempo y experiencia técnica para analizar correctamente los datos y ajustar las estrategias. Es precisamente aquí donde herramientas como Crawlers AI aportan un valor añadido considerable al automatizar el análisis y proporcionar recomendaciones accionables.`,
    auditCostTitle: "Costo Promedio de una Auditoría SEO Profesional",
    auditCostText: `Una auditoría SEO realizada por una agencia especializada cuesta en promedio entre 1.500 € y 5.000 € para una MYPE, y puede alcanzar de 10.000 € a 25.000 € para una PYME con un sitio e-commerce complejo. Estas tarifas generalmente incluyen análisis técnico, auditoría de contenido, estudio de backlinks e informe de recomendaciones. Sin embargo, estas auditorías puntuales quedan rápidamente obsoletas porque la web está en constante evolución. Con la aparición de la inteligencia artificial generativa y el GEO (Generative Engine Optimization), los criterios de optimización cambian más rápido que nunca.`,
    maintenanceTitle: "Mantenimiento y Seguimiento Continuo",
    maintenanceText: `El mantenimiento de un sitio web profesional representa un costo recurrente de 100 € a 500 € por mes para las MYPES, y de 500 € a 2.000 € mensuales para las PYMES. Este presupuesto cubre actualizaciones de seguridad, alojamiento, copias de seguridad y corrección de errores. Pero atención: el mantenimiento técnico ya no es suficiente en 2026. También hay que vigilar constantemente la compatibilidad con los crawlers de IA (GPTBot, ClaudeBot, PerplexityBot) y adaptar el contenido a las exigencias de los motores de respuesta generativos. Sin esta vigilancia activa, un sitio puede perder su visibilidad de la noche a la mañana.`,
    tableTitle: "Comparativa de Inversiones en Marketing Digital",
    tableTpe: "MYPE (1-10 empleados)",
    tablePme: "PYME (11-250 empleados)",
    tableRows: [
      { label: "Presupuesto marketing anual", tpe: "2.000 € - 8.000 €", pme: "15.000 € - 50.000 €" },
      { label: "Costo auditoría SEO puntual", tpe: "1.500 € - 5.000 €", pme: "5.000 € - 25.000 €" },
      { label: "Mantenimiento mensual", tpe: "100 € - 500 €", pme: "500 € - 2.000 €" },
      { label: "Tasa de satisfacción ROI", tpe: "32%", pme: "38%" },
      { label: "Dominio de KPIs", tpe: "28%", pme: "42%" },
    ],
    conclusion: `Ante estas realidades presupuestarias, Crawlers AI ofrece una alternativa inteligente: una auditoría instantánea, gratuita e ilimitada que permite a las MYPES y PYMES monitorear su visibilidad IA sin movilizar un presupuesto significativo. Nuestra herramienta analiza en tiempo real los factores GEO y SEO críticos, genera automáticamente el código correctivo necesario y permite una verificación inmediata de las optimizaciones. Es la democratización de la experiencia técnica, accesible a todas las empresas independientemente de su tamaño.`,
  },
};

export function MarketingBudgetSection() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <section className="py-16 bg-gradient-to-b from-muted/30 to-background" aria-label="Budget marketing TPE PME">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4 gap-2">
            <Euro className="h-3.5 w-3.5" />
            TPE / PME 2026
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            {t.title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {t.subtitle}
          </p>
        </motion.div>

        {/* Introduction */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  {t.intro}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Content Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-6 mb-10"
        >
          {/* Satisfaction Card */}
          <motion.div variants={itemVariants}>
            <Card className="h-full hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-warning" />
                  {t.satisfactionTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.satisfactionText}
                </p>
                <div className="mt-4 flex gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    34% satisfaits
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3 text-warning" />
                    58% sans KPI
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Audit Cost Card */}
          <motion.div variants={itemVariants}>
            <Card className="h-full hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  {t.auditCostTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.auditCostText}
                </p>
                <div className="mt-4 flex gap-2">
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Building2 className="h-3 w-3" />
                    TPE: 1.5K-5K €
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    PME: 5K-25K €
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Maintenance Card */}
          <motion.div variants={itemVariants} className="md:col-span-2">
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wrench className="h-5 w-5 text-orange-500" />
                  {t.maintenanceTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.maintenanceText}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-10"
        >
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 py-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <PiggyBank className="h-5 w-5 text-primary" />
                {t.tableTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" itemScope itemType="https://schema.org/Table">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-semibold">Indicateur</th>
                      <th className="text-center p-3 font-semibold">
                        <div className="flex items-center justify-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          {t.tableTpe}
                        </div>
                      </th>
                      <th className="text-center p-3 font-semibold">
                        <div className="flex items-center justify-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          {t.tablePme}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.tableRows.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium">{row.label}</td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {row.tpe}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {row.pme}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Conclusion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-success/30 bg-gradient-to-br from-success/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  {t.conclusion}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
