import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Smartphone, Monitor, Brain } from 'lucide-react';

const translations = {
  fr: {
    title: "Facteurs GEO essentiels",
    subtitle: "Qu'est-ce qui compte pour être cité par les IA génératives ?",
    mobile: "Mobile",
    desktop: "Desktop",
    critical: "Essentiel",
    important: "Important",
    optional: "Recommandé",
    factors: [
      {
        factor: "Données structurées Schema.org (JSON-LD)",
        mobile: { status: "critical", note: "Essentiel pour l'extraction contextuelle" },
        desktop: { status: "critical", note: "Base de la compréhension sémantique" },
      },
      {
        factor: "Temps de chargement (LCP < 2.5s)",
        mobile: { status: "critical", note: "Les crawlers IA abandonnent après 3s" },
        desktop: { status: "important", note: "Plus de tolérance mais reste important" },
      },
      {
        factor: "Contenu textuel riche (+800 mots)",
        mobile: { status: "important", note: "Contexte pour les réponses génératives" },
        desktop: { status: "critical", note: "Source principale d'information" },
      },
      {
        factor: "Hiérarchie H1-H6 sémantique",
        mobile: { status: "critical", note: "Structure le contenu pour extraction" },
        desktop: { status: "critical", note: "Indispensable pour la compréhension" },
      },
      {
        factor: "Tableaux de données factuelles",
        mobile: { status: "important", note: "Citabilité élevée sur ChatGPT/Perplexity" },
        desktop: { status: "critical", note: "Format idéal pour les citations" },
      },
      {
        factor: "FAQ avec réponses concises",
        mobile: { status: "critical", note: "Format parfait pour les snippets IA" },
        desktop: { status: "critical", note: "Directement exploitable par les LLM" },
      },
      {
        factor: "Robots.txt permissif (pas de Disallow: /)",
        mobile: { status: "critical", note: "Autorise GPTBot, ClaudeBot, etc." },
        desktop: { status: "critical", note: "Condition sine qua non" },
      },
      {
        factor: "Métadonnées Open Graph complètes",
        mobile: { status: "important", note: "Contexte social et partage" },
        desktop: { status: "important", note: "Enrichit les réponses génératives" },
      },
    ],
  },
  en: {
    title: "Essential GEO Factors",
    subtitle: "What matters to get cited by generative AI?",
    mobile: "Mobile",
    desktop: "Desktop",
    critical: "Essential",
    important: "Important",
    optional: "Recommended",
    factors: [
      {
        factor: "Schema.org Structured Data (JSON-LD)",
        mobile: { status: "critical", note: "Essential for contextual extraction" },
        desktop: { status: "critical", note: "Foundation of semantic understanding" },
      },
      {
        factor: "Loading Time (LCP < 2.5s)",
        mobile: { status: "critical", note: "AI crawlers abandon after 3s" },
        desktop: { status: "important", note: "More tolerance but still important" },
      },
      {
        factor: "Rich Text Content (+800 words)",
        mobile: { status: "important", note: "Context for generative responses" },
        desktop: { status: "critical", note: "Primary information source" },
      },
      {
        factor: "Semantic H1-H6 Hierarchy",
        mobile: { status: "critical", note: "Structures content for extraction" },
        desktop: { status: "critical", note: "Essential for comprehension" },
      },
      {
        factor: "Factual Data Tables",
        mobile: { status: "important", note: "High citability on ChatGPT/Perplexity" },
        desktop: { status: "critical", note: "Ideal format for citations" },
      },
      {
        factor: "FAQ with Concise Answers",
        mobile: { status: "critical", note: "Perfect format for AI snippets" },
        desktop: { status: "critical", note: "Directly usable by LLMs" },
      },
      {
        factor: "Permissive Robots.txt (no Disallow: /)",
        mobile: { status: "critical", note: "Allows GPTBot, ClaudeBot, etc." },
        desktop: { status: "critical", note: "Absolute requirement" },
      },
      {
        factor: "Complete Open Graph Metadata",
        mobile: { status: "important", note: "Social context and sharing" },
        desktop: { status: "important", note: "Enriches generative responses" },
      },
    ],
  },
  es: {
    title: "Factores GEO esenciales",
    subtitle: "¿Qué importa para ser citado por la IA generativa?",
    mobile: "Móvil",
    desktop: "Escritorio",
    critical: "Esencial",
    important: "Importante",
    optional: "Recomendado",
    factors: [
      {
        factor: "Datos estructurados Schema.org (JSON-LD)",
        mobile: { status: "critical", note: "Esencial para extracción contextual" },
        desktop: { status: "critical", note: "Base de comprensión semántica" },
      },
      {
        factor: "Tiempo de carga (LCP < 2.5s)",
        mobile: { status: "critical", note: "Los crawlers IA abandonan después de 3s" },
        desktop: { status: "important", note: "Más tolerancia pero sigue siendo importante" },
      },
      {
        factor: "Contenido textual rico (+800 palabras)",
        mobile: { status: "important", note: "Contexto para respuestas generativas" },
        desktop: { status: "critical", note: "Fuente principal de información" },
      },
      {
        factor: "Jerarquía semántica H1-H6",
        mobile: { status: "critical", note: "Estructura contenido para extracción" },
        desktop: { status: "critical", note: "Indispensable para comprensión" },
      },
      {
        factor: "Tablas de datos factuales",
        mobile: { status: "important", note: "Alta citabilidad en ChatGPT/Perplexity" },
        desktop: { status: "critical", note: "Formato ideal para citas" },
      },
      {
        factor: "FAQ con respuestas concisas",
        mobile: { status: "critical", note: "Formato perfecto para snippets IA" },
        desktop: { status: "critical", note: "Directamente utilizable por LLMs" },
      },
      {
        factor: "Robots.txt permisivo (sin Disallow: /)",
        mobile: { status: "critical", note: "Permite GPTBot, ClaudeBot, etc." },
        desktop: { status: "critical", note: "Requisito absoluto" },
      },
      {
        factor: "Metadatos Open Graph completos",
        mobile: { status: "important", note: "Contexto social y compartir" },
        desktop: { status: "important", note: "Enriquece respuestas generativas" },
      },
    ],
  },
};

const getStatusStyles = (status: string) => {
  if (status === 'critical') {
    return 'bg-orange-100 dark:bg-orange-950/40'; // Orange background for essential
  }
  if (status === 'important') {
    return 'bg-fuchsia-100 dark:bg-fuchsia-950/40'; // Fuchsia background for important
  }
  return 'bg-muted/50';
};

const StatusLabel = ({ status, labels }: { status: string; labels: any }) => {
  if (status === 'critical') {
    return (
      <span className="font-bold text-orange-600 dark:text-orange-400">{labels.critical}</span>
    );
  }
  if (status === 'important') {
    return (
      <span className="font-bold text-fuchsia-600 dark:text-fuchsia-400">{labels.important}</span>
    );
  }
  return (
    <span className="font-medium text-muted-foreground">{labels.optional}</span>
  );
};

export function GEOComparisonTable() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  return (
    <section className="py-8 bg-muted/30" aria-label="Tableau comparatif GEO">
      <div className="container mx-auto px-4">
        <Card className="overflow-hidden border max-w-5xl mx-auto">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 py-4">
            <h2 className="flex items-center gap-3 text-lg md:text-xl font-semibold text-foreground">
              <Brain className="h-5 w-5 text-primary" />
              {language === 'fr' ? 'Facteurs GEO essentiels pour être cité par ChatGPT, Gemini et Perplexity' : language === 'es' ? 'Factores GEO esenciales para ser citado por ChatGPT, Gemini y Perplexity' : 'Essential GEO factors to be cited by ChatGPT, Gemini & Perplexity'}
            </h2>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" role="table">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-2.5 font-semibold min-w-[180px] border-r border-border">Facteur GEO</th>
                    <th className="text-center p-2.5 font-semibold min-w-[130px] border-r border-border">
                      <div className="flex items-center justify-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5" />
                        {t.mobile}
                      </div>
                    </th>
                    <th className="text-center p-2.5 font-semibold min-w-[130px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <Monitor className="h-3.5 w-3.5" />
                        {t.desktop}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {t.factors.map((row, idx) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="p-2.5 font-medium border-r border-border bg-card text-xs">{row.factor}</td>
                      <td className={`p-2.5 text-center border-r border-border ${getStatusStyles(row.mobile.status)}`}>
                        <div className="flex flex-col items-center gap-0.5">
                          <StatusLabel status={row.mobile.status} labels={t} />
                          <span className="text-[10px] text-muted-foreground leading-tight">{row.mobile.note}</span>
                        </div>
                      </td>
                      <td className={`p-2.5 text-center ${getStatusStyles(row.desktop.status)}`}>
                        <div className="flex flex-col items-center gap-0.5">
                          <StatusLabel status={row.desktop.status} labels={t} />
                          <span className="text-[10px] text-muted-foreground leading-tight">{row.desktop.note}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
