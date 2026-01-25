import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Smartphone, Monitor, Brain } from 'lucide-react';

const translations = {
  fr: {
    title: "Facteurs GEO essentiels par plateforme",
    subtitle: "Qu'est-ce qui compte pour être cité par les IA génératives ?",
    mobile: "Mobile",
    desktop: "Desktop",
    critical: "Critique",
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
      {
        factor: "Sources et citations d'experts",
        mobile: { status: "optional", note: "Renforce l'autorité perçue" },
        desktop: { status: "critical", note: "Critère E-E-A-T pour crédibilité" },
      },
      {
        factor: "Liens internes contextuels",
        mobile: { status: "important", note: "Navigation et découverte" },
        desktop: { status: "important", note: "Profondeur de l'information" },
      },
    ],
  },
  en: {
    title: "Essential GEO Factors by Platform",
    subtitle: "What matters to get cited by generative AI?",
    mobile: "Mobile",
    desktop: "Desktop",
    critical: "Critical",
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
      {
        factor: "Expert Sources and Citations",
        mobile: { status: "optional", note: "Reinforces perceived authority" },
        desktop: { status: "critical", note: "E-E-A-T criterion for credibility" },
      },
      {
        factor: "Contextual Internal Links",
        mobile: { status: "important", note: "Navigation and discovery" },
        desktop: { status: "important", note: "Information depth" },
      },
    ],
  },
  es: {
    title: "Factores GEO esenciales por plataforma",
    subtitle: "¿Qué importa para ser citado por la IA generativa?",
    mobile: "Móvil",
    desktop: "Escritorio",
    critical: "Crítico",
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
      {
        factor: "Fuentes y citas de expertos",
        mobile: { status: "optional", note: "Refuerza autoridad percibida" },
        desktop: { status: "critical", note: "Criterio E-E-A-T para credibilidad" },
      },
      {
        factor: "Enlaces internos contextuales",
        mobile: { status: "important", note: "Navegación y descubrimiento" },
        desktop: { status: "important", note: "Profundidad de información" },
      },
    ],
  },
};

const StatusBadge = ({ status, labels }: { status: string; labels: any }) => {
  if (status === 'critical') {
    return (
      <Badge variant="destructive" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {labels.critical}
      </Badge>
    );
  }
  if (status === 'important') {
    return (
      <Badge variant="outline" className="border-warning text-warning gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {labels.important}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      {labels.optional}
    </Badge>
  );
};

export function GEOComparisonTable() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  return (
    <section className="py-12 bg-muted/30" aria-label="Tableau comparatif GEO">
      <div className="container mx-auto px-4">
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardTitle className="flex items-center gap-3 text-xl md:text-2xl">
              <Brain className="h-6 w-6 text-primary" />
              {t.title}
            </CardTitle>
            <p className="text-muted-foreground">{t.subtitle}</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-semibold min-w-[250px]">Facteur GEO</th>
                    <th className="text-center p-4 font-semibold min-w-[200px]">
                      <div className="flex items-center justify-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        {t.mobile}
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold min-w-[200px]">
                      <div className="flex items-center justify-center gap-2">
                        <Monitor className="h-4 w-4" />
                        {t.desktop}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {t.factors.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{row.factor}</td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <StatusBadge status={row.mobile.status} labels={t} />
                          <span className="text-xs text-muted-foreground">{row.mobile.note}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <StatusBadge status={row.desktop.status} labels={t} />
                          <span className="text-xs text-muted-foreground">{row.desktop.note}</span>
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
