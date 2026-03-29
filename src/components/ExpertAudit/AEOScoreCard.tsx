import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Mic, Info } from 'lucide-react';
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
    subtitle: "L'AEO vise la 'Position Zéro' de Google : l'encart ultime affichant votre résumé avant les liens classiques.",
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
    subtitle: "AEO targets Google's 'Position Zero': the ultimate snippet displaying your summary above traditional links.",
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
    subtitle: "El AEO apunta a la 'Posición Cero' de Google: el fragmento definitivo que muestra tu resumen antes de los enlaces clásicos.",
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
  const wordCount = scores.semantic.wordCount || 0;

  // 1. Schema.org — accept Organization/WebSite in addition to FAQ/Article
  const relevantSchemaTypes = ['FAQPage', 'FAQ', 'Article', 'NewsArticle', 'BlogPosting', 'HowTo', 'QAPage', 'Organization', 'WebSite', 'WebPage', 'LocalBusiness'];
  const schemaTypes = (scores.aiReady.schemaTypes || []).filter(Boolean) as string[];
  const hasRelevantSchema = scores.aiReady.hasSchemaOrg && 
    schemaTypes.some(t => relevantSchemaTypes.some(r => t.toLowerCase().includes(r.toLowerCase())));

  // 2. Interrogative headings
  const interrogativePatterns = /(\?|comment|quel|quelle|pourquoi|how|what|why|when|where|which|who|cómo|qué|por qué|cuándo|dónde)/i;
  const h1Contents: string[] = html.h1Contents || [];
  const hasInterrogativeHn = h1Contents.some((h: string) => interrogativePatterns.test(h));

  // 3. Inverted Pyramid — relaxed upper bound for rich pages
  const hasInvertedPyramid = wordCount >= 100;

  // 4. Extractable formats — lowered threshold to >= 1
  const tableCount = html.tableCount || 0;
  const listCount = html.listCount || 0;
  const hasExtractableFormats = (tableCount + listCount) >= 1;

  // 5. TTFB — use FCP as proxy, threshold < 1200ms (more realistic for SPAs with JS hydration)
  const fcpMs = scores.performance.fcp || 0;
  const hasFastTTFB = fcpMs > 0 && fcpMs < 1200;

  // 6. DOM Accessibility — if content was successfully extracted (wordCount > 50), DOM is accessible
  // regardless of SPA markers. Only fail if JS-dependent AND no content extracted.
  const isJSDependent = html.isContentJSDependent || false;
  const hasSPAMarkers = html.hasSPAMarkers || false;
  const contentWasExtracted = wordCount > 50;
  const hasDOMAccessibility = contentWasExtracted || (!isJSDependent && !hasSPAMarkers);

  // 7. E-E-A-T signals — also accept Schema.org Organization or sameAs links as authority signals
  const hasAuthorBio = html.hasAuthorBio || false;
  const hasExpertCitations = html.hasExpertCitations || false;
  const hasSameAsLinks = html.hasSameAsLinks || false;
  const hasOrgSchema = scores.aiReady.hasSchemaOrg && 
    schemaTypes.some(t => ['Organization', 'LocalBusiness', 'Person'].some(r => t.toLowerCase().includes(r.toLowerCase())));
  const hasEEAT = hasAuthorBio || hasExpertCitations || hasSameAsLinks || hasOrgSchema;

  // 8. Semantic internal linking — relaxed threshold (>= 2 internal links)
  const linkProfile = insights?.linkProfile;
  const toxicAnchorsCount = linkProfile?.toxicAnchorsCount || 0;
  const internalLinks = linkProfile?.internal || 0;
  const hasSemanticLinks = internalLinks >= 2 && toxicAnchorsCount <= 3;

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
  const score = Math.round((passedCount / 8) * 100); // 8 criteria = 100 max

  const strokeWidth = 8;
  const size = 90;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  return (
    <>
      <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
         <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Mic className="h-4.5 w-4.5 text-primary" />
            </div>
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 -mt-2">
          {/* Subtitle + Score side by side */}
          <div className="flex items-center gap-5">
            <p className="flex-1 text-sm text-muted-foreground leading-relaxed">
              {t.subtitle}
            </p>
            <div className="relative shrink-0" style={{ width: size, height: size }}>
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
                  className="text-2xl font-bold"
                  style={{ color: getScoreColor(score) }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  {score}
                </motion.span>
                <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
              </div>
            </div>
          </div>

          {/* Criteria List */}
          <div className="grid gap-1.5">
            {criteria.map((criterion, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.3 }}
                className={`flex items-start gap-2.5 rounded-md px-3 py-2 ${criterion.passed ? 'bg-success/5' : 'bg-destructive/5'}`}
              >
                {criterion.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{criterion.label}</p>
                  <p className={`text-[11px] leading-snug mt-0.5 ${criterion.passed ? 'text-muted-foreground/60' : 'text-destructive/70'}`}>
                    {criterion.explanation}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Methodology button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={() => setIsMethodologyOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <Info className="h-3 w-3" />
              {t.methodology}
            </button>
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
