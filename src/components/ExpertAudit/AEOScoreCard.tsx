import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Mic, BookOpen } from 'lucide-react';
import { ExpertAuditResult } from '@/types/expertAudit';
import { useLanguage } from '@/contexts/LanguageContext';

interface AEOScoreCardProps {
  result: ExpertAuditResult;
}

interface AEOCriterion {
  label: string;
  passed: boolean;
  explanation: string;
}

const translations = {
  fr: {
    title: 'Score AEO (Answer Engine Optimization)',
    subtitle: "L'AEO permet d'optimiser votre contenu pour être directement cité comme source par les Intelligences Artificielles (ChatGPT, Perplexity, Google AI Overviews) et les assistants vocaux.",
    methodology: 'Méthodologie',
    methodologyTitle: 'Méthodologie AEO — Position Zéro & E-E-A-T',
    methodologyDesc: "L'Answer Engine Optimization (AEO) vise à positionner votre contenu comme la réponse de référence dans les moteurs génératifs et les assistants vocaux.",
    methodologyBody: `La **Position Zéro** est le Graal du référencement en 2026. C'est l'encadré que Google affiche au-dessus de tous les résultats organiques, et que les IA génératives utilisent comme source principale.

Pour convaincre les moteurs génératifs de vous citer, vous devez démontrer votre **E-E-A-T** (Expérience, Expertise, Autorité, Fiabilité) :

• **Expérience** — Montrez que vous avez une expérience concrète du sujet (études de cas, résultats chiffrés).
• **Expertise** — Identifiez clairement vos auteurs et leurs qualifications (bio, liens LinkedIn).
• **Autorité** — Construisez un maillage interne sémantique cohérent et obtenez des citations sur des sources tierces.
• **Fiabilité** — Utilisez des données structurées Schema.org, maintenez un site rapide et sécurisé.

Les critères AEO mesurent votre capacité à satisfaire ces exigences à travers 8 indicateurs techniques et éditoriaux vérifiables.`,
    criteria: {
      schema: { label: 'Balisage Schema.org (FAQ, Article)', explanation: "Aide les IA à comprendre instantanément la structure de vos réponses." },
      interrogative: { label: 'Titres Hn interrogatifs', explanation: "Cible les questions exactes posées par les internautes à la voix ou à l'IA." },
      invertedPyramid: { label: 'Pyramide Inversée (Bloc de réponse)', explanation: "Le format idéal pour qu'une IA lise votre réponse à voix haute." },
      extractable: { label: 'Formats extractibles (listes, tableaux)', explanation: "Les listes et tableaux sont les formats préférés des moteurs de réponses." },
      bold: { label: 'Mise en exergue (Gras)', explanation: "Souligne les concepts clés pour faciliter l'extraction par l'algorithme." },
      readability: { label: 'Lisibilité du texte', explanation: "Un texte clair et direct est plus facilement synthétisé par une IA." },
      ttfb: { label: 'Vitesse (TTFB < 200ms)', explanation: "Les IA génératives sourcent en temps réel, un serveur ultra-rapide est indispensable." },
      domAccess: { label: 'Accessibilité du DOM (Main Content)', explanation: "L'IA doit pouvoir lire votre contenu principal sans être bloquée par des scripts." },
      eeat: { label: "Signaux d'autorité (E-E-A-T)", explanation: "L'IA a besoin de savoir qui rédige pour valider la fiabilité de la source." },
      internalLinks: { label: 'Maillage interne sémantique', explanation: "Aide l'IA à naviguer logiquement entre vos différents concepts de référence." },
    },
  },
  en: {
    title: 'AEO Score (Answer Engine Optimization)',
    subtitle: 'AEO optimizes your content to be directly cited as a source by AI engines (ChatGPT, Perplexity, Google AI Overviews) and voice assistants.',
    methodology: 'Methodology',
    methodologyTitle: 'AEO Methodology — Position Zero & E-E-A-T',
    methodologyDesc: 'Answer Engine Optimization (AEO) aims to position your content as the reference answer in generative engines and voice assistants.',
    methodologyBody: `**Position Zero** is the holy grail of SEO in 2026. It's the featured snippet Google displays above all organic results, and the primary source generative AIs use.

To convince generative engines to cite you, you must demonstrate **E-E-A-T** (Experience, Expertise, Authoritativeness, Trustworthiness):

• **Experience** — Show concrete experience with the topic (case studies, measurable results).
• **Expertise** — Clearly identify your authors and their qualifications (bio, LinkedIn links).
• **Authoritativeness** — Build a coherent semantic internal linking structure and earn citations on third-party sources.
• **Trustworthiness** — Use Schema.org structured data, maintain a fast and secure site.

AEO criteria measure your ability to meet these requirements through 8 verifiable technical and editorial indicators.`,
    criteria: {
      schema: { label: 'Schema.org Markup (FAQ, Article)', explanation: 'Helps AI instantly understand the structure of your answers.' },
      interrogative: { label: 'Interrogative Headings', explanation: 'Targets the exact questions users ask via voice or AI.' },
      invertedPyramid: { label: 'Inverted Pyramid (Answer Block)', explanation: 'The ideal format for an AI to read your answer aloud.' },
      extractable: { label: 'Extractable Formats (lists, tables)', explanation: 'Lists and tables are the preferred formats for answer engines.' },
      bold: { label: 'Emphasis (Bold)', explanation: 'Highlights key concepts to facilitate algorithmic extraction.' },
      readability: { label: 'Text Readability', explanation: 'Clear, direct text is more easily synthesized by AI.' },
      ttfb: { label: 'Speed (TTFB < 200ms)', explanation: 'Generative AIs source in real-time — an ultra-fast server is essential.' },
      domAccess: { label: 'DOM Accessibility (Main Content)', explanation: 'AI must be able to read your main content without being blocked by scripts.' },
      eeat: { label: 'Authority Signals (E-E-A-T)', explanation: 'AI needs to know who writes to validate source reliability.' },
      internalLinks: { label: 'Semantic Internal Linking', explanation: 'Helps AI logically navigate between your reference concepts.' },
    },
  },
  es: {
    title: 'Score AEO (Answer Engine Optimization)',
    subtitle: 'El AEO optimiza tu contenido para ser citado directamente como fuente por las IA (ChatGPT, Perplexity, Google AI Overviews) y asistentes de voz.',
    methodology: 'Metodología',
    methodologyTitle: 'Metodología AEO — Posición Cero & E-E-A-T',
    methodologyDesc: 'Answer Engine Optimization (AEO) busca posicionar tu contenido como la respuesta de referencia en motores generativos y asistentes de voz.',
    methodologyBody: `La **Posición Cero** es el santo grial del SEO en 2026. Es el fragmento destacado que Google muestra por encima de todos los resultados orgánicos, y la fuente principal que utilizan las IA generativas.

Para convencer a los motores generativos de citarte, debes demostrar tu **E-E-A-T** (Experiencia, Expertise, Autoridad, Fiabilidad):

• **Experiencia** — Muestra experiencia concreta con el tema (casos de estudio, resultados medibles).
• **Expertise** — Identifica claramente a tus autores y sus cualificaciones (bio, enlaces LinkedIn).
• **Autoridad** — Construye un enlazado interno semántico coherente y obtén citas en fuentes de terceros.
• **Fiabilidad** — Usa datos estructurados Schema.org, mantén un sitio rápido y seguro.

Los criterios AEO miden tu capacidad para cumplir estos requisitos a través de 8 indicadores técnicos y editoriales verificables.`,
    criteria: {
      schema: { label: 'Marcado Schema.org (FAQ, Article)', explanation: 'Ayuda a las IA a comprender instantáneamente la estructura de tus respuestas.' },
      interrogative: { label: 'Encabezados interrogativos', explanation: 'Apunta a las preguntas exactas que los usuarios hacen por voz o IA.' },
      invertedPyramid: { label: 'Pirámide Invertida (Bloque de respuesta)', explanation: 'El formato ideal para que una IA lea tu respuesta en voz alta.' },
      extractable: { label: 'Formatos extraíbles (listas, tablas)', explanation: 'Las listas y tablas son los formatos preferidos de los motores de respuestas.' },
      bold: { label: 'Énfasis (Negrita)', explanation: 'Resalta los conceptos clave para facilitar la extracción algorítmica.' },
      readability: { label: 'Legibilidad del texto', explanation: 'Un texto claro y directo es más fácil de sintetizar por una IA.' },
      ttfb: { label: 'Velocidad (TTFB < 200ms)', explanation: 'Las IA generativas buscan en tiempo real — un servidor ultrarrápido es indispensable.' },
      domAccess: { label: 'Accesibilidad del DOM (Contenido principal)', explanation: 'La IA debe poder leer tu contenido principal sin ser bloqueada por scripts.' },
      eeat: { label: 'Señales de autoridad (E-E-A-T)', explanation: 'La IA necesita saber quién escribe para validar la fiabilidad de la fuente.' },
      internalLinks: { label: 'Enlazado interno semántico', explanation: 'Ayuda a la IA a navegar lógicamente entre tus diferentes conceptos de referencia.' },
    },
  },
};

function computeAEOCriteria(result: ExpertAuditResult, lang: string): AEOCriterion[] {
  const t = translations[lang as keyof typeof translations] || translations.fr;
  const html = result.rawData?.htmlAnalysis || {};
  const scores = result.scores;
  const insights = result.insights;

  // 1. Schema.org with FAQ or Article types
  const relevantSchemaTypes = ['FAQPage', 'FAQ', 'Article', 'NewsArticle', 'BlogPosting', 'HowTo', 'QAPage'];
  const hasRelevantSchema = scores.aiReady.hasSchemaOrg && 
    scores.aiReady.schemaTypes.some(t => relevantSchemaTypes.some(r => t.toLowerCase().includes(r.toLowerCase())));

  // 2. Interrogative headings (H1 containing ?, Comment, Quel, Pourquoi, How, What, Why, etc.)
  const interrogativePatterns = /(\?|comment|quel|quelle|pourquoi|how|what|why|when|where|which|who|cómo|qué|por qué|cuándo|dónde)/i;
  const h1Contents: string[] = html.h1Contents || [];
  const hasInterrogativeHn = h1Contents.some((h: string) => interrogativePatterns.test(h));

  // 3. Inverted Pyramid — approximate: good word count means structured content
  // We check if the page has a reasonable content length (proxy for having answer blocks)
  const wordCount = scores.semantic.wordCount || 0;
  const hasInvertedPyramid = wordCount >= 100 && wordCount <= 3000;

  // 4. Extractable formats (lists, tables)
  const tableCount = html.tableCount || 0;
  const listCount = html.listCount || 0;
  const hasExtractableFormats = (tableCount + listCount) >= 2;

  // 5. Bold emphasis — check dataDensityScore as proxy (sites with strong formatting tend to have higher density)
  const dataDensity = html.dataDensityScore || 0;
  const hasBoldEmphasis = dataDensity >= 3; // statisticCount + percentageCount proxy

  // 6. Readability — use word count and content density ratio
  const contentDensityRatio = insights?.contentDensity?.ratio || 0;
  const hasGoodReadability = wordCount >= 300 && contentDensityRatio >= 0.15;

  // 7. TTFB — use FCP as proxy (FCP = TTFB + render time), threshold < 800ms for FCP implies good TTFB
  const fcpMs = scores.performance.fcp || 0;
  const hasFastTTFB = fcpMs > 0 && fcpMs < 800;

  // 8. DOM Accessibility — no SPA markers, not JS dependent
  const isJSDependent = html.isContentJSDependent || false;
  const hasSPAMarkers = html.hasSPAMarkers || false;
  const hasDOMAccessibility = !isJSDependent && !hasSPAMarkers;

  // 9. E-E-A-T signals — author bio detected
  const hasAuthorBio = html.hasAuthorBio || false;
  const hasExpertCitations = html.hasExpertCitations || false;
  const hasEEAT = hasAuthorBio || hasExpertCitations;

  // 10. Semantic internal linking — check link profile for descriptive anchors
  const linkProfile = insights?.linkProfile;
  const toxicAnchorsCount = linkProfile?.toxicAnchorsCount || 0;
  const internalLinks = linkProfile?.internal || 0;
  const hasSemanticLinks = internalLinks >= 3 && toxicAnchorsCount <= 2;

  return [
    { label: t.criteria.schema.label, passed: hasRelevantSchema, explanation: t.criteria.schema.explanation },
    { label: t.criteria.interrogative.label, passed: hasInterrogativeHn, explanation: t.criteria.interrogative.explanation },
    { label: t.criteria.invertedPyramid.label, passed: hasInvertedPyramid, explanation: t.criteria.invertedPyramid.explanation },
    { label: t.criteria.extractable.label, passed: hasExtractableFormats, explanation: t.criteria.extractable.explanation },
    { label: t.criteria.ttfb.label, passed: hasFastTTFB, explanation: t.criteria.ttfb.explanation },
    { label: t.criteria.domAccess.label, passed: hasDOMAccessibility, explanation: t.criteria.domAccess.explanation },
    { label: t.criteria.eeat.label, passed: hasEEAT, explanation: t.criteria.eeat.explanation },
    { label: t.criteria.internalLinks.label, passed: hasSemanticLinks, explanation: t.criteria.internalLinks.explanation },
  ];
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'hsl(var(--success))';
  if (score >= 40) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

export function AEOScoreCard({ result }: AEOScoreCardProps) {
  const { language } = useLanguage();
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const t = translations[language as keyof typeof translations] || translations.fr;

  const criteria = computeAEOCriteria(result, language);
  const passedCount = criteria.filter(c => c.passed).length;
  const score = passedCount * 10; // 10 criteria = 100 max

  const strokeWidth = 10;
  const size = 140;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  return (
    <>
      <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Mic className="h-4.5 w-4.5 text-primary" />
            </div>
            {t.title}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground leading-relaxed">
            {t.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Gauge */}
          <div className="flex justify-center">
            <div className="relative" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90">
                <circle
                  cx={size / 2} cy={size / 2} r={radius}
                  fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth}
                  className="opacity-30"
                />
                <motion.circle
                  cx={size / 2} cy={size / 2} r={radius}
                  fill="none" stroke={getScoreColor(score)} strokeWidth={strokeWidth}
                  strokeDasharray={circumference} strokeLinecap="round"
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className="text-4xl font-bold"
                  style={{ color: getScoreColor(score) }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  {score}
                </motion.span>
                <span className="text-sm text-muted-foreground font-medium">/ 100</span>
              </div>
            </div>
          </div>

          {/* Criteria List */}
          <div className="space-y-2">
            {criteria.map((criterion, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.3 }}
                className="flex items-start gap-3 rounded-lg bg-muted/40 p-3"
              >
                {criterion.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{criterion.label}</p>
                  <p className="text-xs text-muted-foreground">{criterion.explanation}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Badge summary */}
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={
                score >= 70 ? 'text-success border-success/30' :
                score >= 40 ? 'text-warning border-warning/30' :
                'text-destructive border-destructive/30'
              }
            >
              {passedCount}/10
            </Badge>
          </div>

          {/* Methodology button */}
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMethodologyOpen(true)}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              {t.methodology}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Methodology Dialog */}
      <Dialog open={isMethodologyOpen} onOpenChange={setIsMethodologyOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              {t.methodologyTitle}
            </DialogTitle>
            <DialogDescription>{t.methodologyDesc}</DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {t.methodologyBody.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {paragraph.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} className="text-foreground">{part.slice(2, -2)}</strong>;
                  }
                  return part;
                })}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
