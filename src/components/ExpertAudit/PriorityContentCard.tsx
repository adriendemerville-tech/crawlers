import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ContentSuggestion {
  title: string;
  type: string;
  geoRationale: string;
}

interface PriorityContentCardProps {
  domain: string;
}

const translations = {
  fr: {
    title: 'Contenus à produire en priorité',
    subtitle: '5 pages/articles structurés pour maximiser votre citabilité GEO',
    article: 'Article',
    page: 'Page',
    guide: 'Guide',
    comparatif: 'Comparatif',
    etude: 'Étude',
  },
  en: {
    title: 'Priority Content to Produce',
    subtitle: '5 structured pages/articles to maximize your GEO citability',
    article: 'Article',
    page: 'Page',
    guide: 'Guide',
    comparatif: 'Comparison',
    etude: 'Study',
  },
  es: {
    title: 'Contenidos prioritarios a producir',
    subtitle: '5 páginas/artículos estructurados para maximizar tu citabilidad GEO',
    article: 'Artículo',
    page: 'Página',
    guide: 'Guía',
    comparatif: 'Comparativo',
    etude: 'Estudio',
  },
};

function generateContentSuggestions(domain: string, lang: string): ContentSuggestion[] {
  const brand = domain.replace(/\.(com|fr|net|org|io|co|app|dev).*$/i, '').replace(/^www\./, '');
  const brandCap = brand.charAt(0).toUpperCase() + brand.slice(1);

  const sets: Record<string, ContentSuggestion[]> = {
    fr: [
      {
        title: `Guide complet : Qu'est-ce que ${brandCap} et comment ça fonctionne ?`,
        type: 'Guide',
        geoRationale: 'Page pilier FAQ structurée avec Schema.org FAQPage – répond aux requêtes "qu\'est-ce que" qui déclenchent les citations IA',
      },
      {
        title: `${brandCap} vs Alternatives : Comparatif ${new Date().getFullYear()}`,
        type: 'Comparatif',
        geoRationale: 'Tableau comparatif dense en données factuelles – format privilégié par les LLMs pour les requêtes décisionnelles',
      },
      {
        title: `Étude de cas : Résultats obtenus avec ${brandCap}`,
        type: 'Étude',
        geoRationale: 'Contenu factuel avec statistiques chiffrées et témoignages – renforce l\'autorité E-E-A-T et la citabilité',
      },
      {
        title: `Les ${5} questions les plus posées sur ${brandCap}`,
        type: 'Article',
        geoRationale: 'Format "People Also Ask" optimisé avec données structurées – capte les requêtes conversationnelles des LLMs',
      },
      {
        title: `Glossaire ${brandCap} : Définitions clés de votre secteur`,
        type: 'Page',
        geoRationale: 'Page de référence sémantique avec JSON-LD DefinedTermSet – établit l\'autorité thématique pour les moteurs IA',
      },
    ],
    en: [
      {
        title: `Complete Guide: What is ${brandCap} and How Does It Work?`,
        type: 'Guide',
        geoRationale: 'Pillar FAQ page with Schema.org FAQPage – answers "what is" queries that trigger AI citations',
      },
      {
        title: `${brandCap} vs Alternatives: ${new Date().getFullYear()} Comparison`,
        type: 'Comparison',
        geoRationale: 'Data-dense comparison table – format preferred by LLMs for decision queries',
      },
      {
        title: `Case Study: Results Achieved with ${brandCap}`,
        type: 'Study',
        geoRationale: 'Factual content with statistics and testimonials – strengthens E-E-A-T authority and citability',
      },
      {
        title: `Top 5 Questions Asked About ${brandCap}`,
        type: 'Article',
        geoRationale: '"People Also Ask" format with structured data – captures LLM conversational queries',
      },
      {
        title: `${brandCap} Glossary: Key Definitions in Your Industry`,
        type: 'Page',
        geoRationale: 'Semantic reference page with JSON-LD DefinedTermSet – builds topical authority for AI engines',
      },
    ],
    es: [
      {
        title: `Guía completa: ¿Qué es ${brandCap} y cómo funciona?`,
        type: 'Guía',
        geoRationale: 'Página pilar FAQ con Schema.org FAQPage – responde a consultas "qué es" que activan citaciones IA',
      },
      {
        title: `${brandCap} vs Alternativas: Comparativa ${new Date().getFullYear()}`,
        type: 'Comparativo',
        geoRationale: 'Tabla comparativa densa en datos factuales – formato preferido por los LLMs para consultas de decisión',
      },
      {
        title: `Caso de estudio: Resultados obtenidos con ${brandCap}`,
        type: 'Estudio',
        geoRationale: 'Contenido factual con estadísticas y testimonios – refuerza la autoridad E-E-A-T y la citabilidad',
      },
      {
        title: `Las 5 preguntas más frecuentes sobre ${brandCap}`,
        type: 'Artículo',
        geoRationale: 'Formato "People Also Ask" con datos estructurados – captura consultas conversacionales de LLMs',
      },
      {
        title: `Glosario ${brandCap}: Definiciones clave de tu sector`,
        type: 'Página',
        geoRationale: 'Página de referencia semántica con JSON-LD DefinedTermSet – establece autoridad temática para motores IA',
      },
    ],
  };

  return sets[lang] || sets.fr;
}

const typeColors: Record<string, string> = {
  Guide: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  Guía: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  Comparatif: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  Comparativo: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  Comparison: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  Étude: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  Estudio: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  Study: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  Article: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  Artículo: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  Page: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800',
  Página: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800',
};

export function PriorityContentCard({ domain }: PriorityContentCardProps) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const suggestions = generateContentSuggestions(domain, language);

  return (
    <Card className="border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <FileText className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          {t.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{s.title}</p>
                </div>
              </div>
              <Badge variant="outline" className={`shrink-0 text-[10px] ${typeColors[s.type] || ''}`}>
                {s.type}
              </Badge>
            </div>
            <div className="flex items-start gap-2 ml-9">
              <ArrowRight className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{s.geoRationale}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
