import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TargetQuery {
  query: string;
  intent: string;
  priority: 'high' | 'medium';
}

interface LLMTargetQueriesCardProps {
  domain: string;
  compact?: boolean;
}

const translations = {
  fr: {
    title: 'Requêtes à cibler',
    subtitle: 'Les 5 requêtes les plus susceptibles de déclencher une citation LLM de votre marque',
    copied: 'Copié !',
    high: 'Prioritaire',
    medium: 'Important',
  },
  en: {
    title: 'Target Queries',
    subtitle: 'Top 5 queries most likely to trigger an LLM citation of your brand',
    copied: 'Copied!',
    high: 'Priority',
    medium: 'Important',
  },
  es: {
    title: 'Consultas objetivo',
    subtitle: 'Las 5 consultas más propensas a generar una citación LLM de tu marca',
    copied: '¡Copiado!',
    high: 'Prioritario',
    medium: 'Importante',
  },
};

function generateTargetQueries(domain: string, lang: string): TargetQuery[] {
  const brand = domain.replace(/\.(com|fr|net|org|io|co|app|dev).*$/i, '').replace(/^www\./, '');
  
  const querySets: Record<string, TargetQuery[]> = {
    fr: [
      { query: `Quel est le meilleur outil pour ${brand} ?`, intent: 'Requête de recommandation directe – déclenche la citation dans les réponses IA', priority: 'high' },
      { query: `${brand} avis et alternatives`, intent: 'Requête comparative – les LLMs citent les marques connues en contexte de comparaison', priority: 'high' },
      { query: `À quoi sert ${brand} ?`, intent: 'Requête de découverte – teste si les LLMs connaissent votre proposition de valeur', priority: 'high' },
      { query: `${brand} vs concurrents : lequel choisir ?`, intent: 'Requête décisionnelle – les LLMs synthétisent les avantages/inconvénients', priority: 'medium' },
      { query: `Est-ce que ${brand} est fiable ?`, intent: 'Requête de confiance – les LLMs évaluent la réputation et l\'autorité', priority: 'medium' },
    ],
    en: [
      { query: `What is the best tool for ${brand}?`, intent: 'Direct recommendation query – triggers citation in AI responses', priority: 'high' },
      { query: `${brand} reviews and alternatives`, intent: 'Comparative query – LLMs cite known brands in comparison context', priority: 'high' },
      { query: `What does ${brand} do?`, intent: 'Discovery query – tests if LLMs know your value proposition', priority: 'high' },
      { query: `${brand} vs competitors: which one to choose?`, intent: 'Decision query – LLMs synthesize pros/cons', priority: 'medium' },
      { query: `Is ${brand} reliable?`, intent: 'Trust query – LLMs evaluate reputation and authority', priority: 'medium' },
    ],
    es: [
      { query: `¿Cuál es la mejor herramienta para ${brand}?`, intent: 'Consulta de recomendación directa – activa la citación en respuestas IA', priority: 'high' },
      { query: `${brand} opiniones y alternativas`, intent: 'Consulta comparativa – los LLMs citan marcas conocidas en contexto de comparación', priority: 'high' },
      { query: `¿Para qué sirve ${brand}?`, intent: 'Consulta de descubrimiento – verifica si los LLMs conocen tu propuesta de valor', priority: 'high' },
      { query: `${brand} vs competidores: ¿cuál elegir?`, intent: 'Consulta de decisión – los LLMs sintetizan ventajas/desventajas', priority: 'medium' },
      { query: `¿Es ${brand} confiable?`, intent: 'Consulta de confianza – los LLMs evalúan la reputación y autoridad', priority: 'medium' },
    ],
  };

  return querySets[lang] || querySets.fr;
}

export function LLMTargetQueriesCard({ domain, compact = false }: LLMTargetQueriesCardProps) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const queries = generateTargetQueries(domain, language);

  const handleCopy = (query: string, index: number) => {
    navigator.clipboard.writeText(query);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className={compact ? 'pb-2' : 'pb-3'}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-5 w-5 text-primary" />
          {t.title}
        </CardTitle>
        {!compact && (
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {queries.map((q, i) => (
          <div
            key={i}
            className="group flex items-start gap-3 rounded-lg bg-muted/50 p-3 hover:bg-muted/80 transition-colors cursor-pointer"
            onClick={() => handleCopy(q.query, i)}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">"{q.query}"</p>
              <p className="text-xs text-muted-foreground mt-1">{q.intent}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={q.priority === 'high'
                  ? 'text-primary border-primary/30 text-[10px]'
                  : 'text-muted-foreground border-muted-foreground/30 text-[10px]'
                }
              >
                {t[q.priority]}
              </Badge>
              {copiedIndex === i ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
