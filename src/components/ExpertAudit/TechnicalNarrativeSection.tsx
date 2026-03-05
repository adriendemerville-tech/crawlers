import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DoorOpen, Brain, Sparkles, Shield, Bot, FileCode2,
  CheckCircle2, XCircle, AlertTriangle, Lock,
  FileText, Hash, AlignLeft, Code2, Link2,
  HelpCircle, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExpertAuditResult } from '@/types/expertAudit';
import { useLanguage } from '@/contexts/LanguageContext';

interface TechnicalNarrativeSectionProps {
  result: ExpertAuditResult;
}

// ── Mini gauge component ──
function MiniGauge({ score, label }: { score: number; label: string }) {
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? 'stroke-success' : score >= 45 ? 'stroke-warning' : 'stroke-destructive';
  const textColor = score >= 75 ? 'text-success' : score >= 45 ? 'text-warning' : 'text-destructive';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[72px] w-[72px]">
        <svg className="h-[72px] w-[72px] -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="32" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/20" />
          <circle cx="36" cy="36" r="32" fill="none" strokeWidth="5" strokeLinecap="round"
            className={color}
            style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-lg font-bold', textColor)}>{score}%</span>
        </div>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

// ── Status row ──
function StatusRow({ icon, label, ok, detail }: { icon: React.ReactNode; label: string; ok: boolean | null; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {detail && <span className="text-xs font-mono text-foreground">{detail}</span>}
        {ok === true && <CheckCircle2 className="h-4 w-4 text-success" />}
        {ok === false && <XCircle className="h-4 w-4 text-destructive" />}
        {ok === null && <HelpCircle className="h-4 w-4 text-warning" />}
      </div>
    </div>
  );
}

const translations = {
  fr: {
    sectionTitle: "La Technique au service de l\u2019Acquisition (SEO & IA)",
    bloc1Title: "Porte d\u2019Entrée & Accessibilité des Bots",
    bloc1Desc: "Avant d\u2019être lu, votre site doit autoriser et faciliter l\u2019entrée des robots d\u2019exploration. La sécurité et la simplicité du code sont les clés pour ne pas épuiser leur budget d\u2019exploration.",
    bloc2Title: "Langage Sémantique & Compréhension",
    bloc2Desc: "Une fois sur la page, les algorithmes et les LLMs doivent comprendre de quoi vous parlez. Le contenu humain (Titres) doit être aligné avec le code machine (JSON-LD) pour créer une Entité forte.",
    bloc3Title: "Formatage & Extraction des Connaissances",
    bloc3Desc: "Pour que Google SGE ou ChatGPT vous citent, votre contenu doit être riche et formaté pour être facilement \"aspiré\" par les IA.",
    robotsTxt: 'Robots.txt',
    permissive: 'Permissif',
    restrictive: 'Restrictif',
    aiBots: 'Bots IA autorisés',
    https: 'HTTPS',
    safeBrowsing: 'Safe Browsing',
    title: 'Balise Title',
    metaDesc: 'Meta Description',
    h1: 'H1 unique',
    semanticMatch: 'Cohérence Title/H1',
    schemaOrg: 'Schema.org',
    jsonLd: 'JSON-LD valide',
    wordCount: 'Volume de contenu',
    textRatio: 'Ratio texte/HTML',
    linkProfile: 'Profil de liens',
    words: 'mots',
    chars: 'car.',
    internal: 'int.',
    external: 'ext.',
    present: 'Présent',
    absent: 'Absent',
    valid: 'Valide',
    invalid: 'Invalide',
    jsWarning: 'Le JavaScript complexe est un mur pour les bots IA basiques. Bloquer les crawlers dans le robots.txt rend votre site invisible.',
    jsonLdExplain: "Le JSON-LD est le \"langage maternel\" de l\u2019IA pour valider l\u2019expertise annoncée dans vos titres.",
    formatExplain: "Le ratio texte/HTML et le profil de liens sont des critères essentiels pour atterrir dans les résumés générés par l\u2019IA.",
    health: 'Santé',
  },
  en: {
    sectionTitle: 'How Technical SEO Powers Acquisition (SEO & AI)',
    bloc1Title: 'Bot Gateway & Accessibility',
    bloc1Desc: 'Before being read, your site must authorize and facilitate the entry of crawlers. Security and code simplicity are key to not exhausting their crawl budget.',
    bloc2Title: 'Semantic Language & Comprehension',
    bloc2Desc: 'Once on the page, algorithms and LLMs need to understand what you\'re about. Human content (Titles) must align with machine code (JSON-LD) to build a strong Entity.',
    bloc3Title: 'Formatting & Knowledge Extraction',
    bloc3Desc: 'For Google SGE or ChatGPT to cite you, your content must be rich and formatted for easy AI extraction.',
    robotsTxt: 'Robots.txt',
    permissive: 'Permissive',
    restrictive: 'Restrictive',
    aiBots: 'AI Bots allowed',
    https: 'HTTPS',
    safeBrowsing: 'Safe Browsing',
    title: 'Title Tag',
    metaDesc: 'Meta Description',
    h1: 'Unique H1',
    semanticMatch: 'Title/H1 coherence',
    schemaOrg: 'Schema.org',
    jsonLd: 'Valid JSON-LD',
    wordCount: 'Content volume',
    textRatio: 'Text/HTML ratio',
    linkProfile: 'Link profile',
    words: 'words',
    chars: 'chars',
    internal: 'int.',
    external: 'ext.',
    present: 'Present',
    absent: 'Absent',
    valid: 'Valid',
    invalid: 'Invalid',
    jsWarning: 'Complex JavaScript is a wall for basic AI bots. Blocking crawlers in robots.txt makes your site literally invisible.',
    jsonLdExplain: 'JSON-LD is the "native language" of AI for validating the expertise announced in your titles.',
    formatExplain: 'Text/HTML ratio and link profiles are essential criteria for landing in AI-generated summaries.',
    health: 'Health',
  },
  es: {
    sectionTitle: 'La Técnica al servicio de la Adquisición (SEO & IA)',
    bloc1Title: 'Puerta de Entrada & Accesibilidad de Bots',
    bloc1Desc: 'Antes de ser leído, su sitio debe autorizar y facilitar la entrada de los robots. La seguridad y la simplicidad del código son claves.',
    bloc2Title: 'Lenguaje Semántico & Comprensión',
    bloc2Desc: 'Una vez en la página, los algoritmos y LLMs deben entender de qué habla. El contenido humano (Títulos) debe alinearse con el código máquina (JSON-LD).',
    bloc3Title: 'Formato & Extracción del Conocimiento',
    bloc3Desc: 'Para que Google SGE o ChatGPT lo citen, su contenido debe ser rico y formateado para fácil extracción por IA.',
    robotsTxt: 'Robots.txt',
    permissive: 'Permisivo',
    restrictive: 'Restrictivo',
    aiBots: 'Bots IA permitidos',
    https: 'HTTPS',
    safeBrowsing: 'Safe Browsing',
    title: 'Etiqueta Title',
    metaDesc: 'Meta Description',
    h1: 'H1 único',
    semanticMatch: 'Coherencia Title/H1',
    schemaOrg: 'Schema.org',
    jsonLd: 'JSON-LD válido',
    wordCount: 'Volumen de contenido',
    textRatio: 'Ratio texto/HTML',
    linkProfile: 'Perfil de enlaces',
    words: 'palabras',
    chars: 'car.',
    internal: 'int.',
    external: 'ext.',
    present: 'Presente',
    absent: 'Ausente',
    valid: 'Válido',
    invalid: 'Inválido',
    jsWarning: 'JavaScript complejo es un muro para los bots IA básicos. Bloquear crawlers en robots.txt hace su sitio invisible.',
    jsonLdExplain: 'JSON-LD es el "lenguaje nativo" de la IA para validar la experiencia anunciada en sus títulos.',
    formatExplain: 'El ratio texto/HTML y el perfil de enlaces son criterios esenciales para aparecer en resúmenes generados por IA.',
    health: 'Salud',
  },
};

export function TechnicalNarrativeSection({ result }: TechnicalNarrativeSectionProps) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const { scores, insights, rawData } = result;
  const crawlersData = rawData?.crawlersData;
  const jsonLd = insights?.jsonLdValidation;
  const contentDensity = insights?.contentDensity;
  const linkProfile = insights?.linkProfile;
  const semanticConsistency = insights?.semanticConsistency;

  // ── Compute bloc scores ──
  // Bloc 1: Accessibility (robots.txt + AI bots + HTTPS + Safe Browsing)
  const bloc1Items = [
    scores.aiReady.hasRobotsTxt,
    scores.aiReady.robotsPermissive,
    scores.security.isHttps,
    scores.security.safeBrowsingOk,
  ];
  const aiBotsAllowed = crawlersData ? crawlersData.allowedCount : (scores.aiReady.allowsAIBots ? Object.values(scores.aiReady.allowsAIBots).filter(Boolean).length : 0);
  const aiBotsTotal = crawlersData ? crawlersData.bots.length : 6;
  const bloc1Score = Math.round(
    ((bloc1Items.filter(Boolean).length / bloc1Items.length) * 60 + (aiBotsAllowed / Math.max(aiBotsTotal, 1)) * 40)
  );

  // Bloc 2: Semantic (title + meta + h1 + semantic consistency + schema + jsonld)
  const bloc2Items = [
    scores.semantic.hasTitle && scores.semantic.titleLength <= 70,
    scores.semantic.hasMetaDesc,
    scores.semantic.hasUniqueH1,
    (semanticConsistency?.titleH1Similarity ?? 0) >= 30,
    scores.aiReady.hasSchemaOrg,
    jsonLd?.valid ?? false,
  ];
  const bloc2Score = Math.round((bloc2Items.filter(Boolean).length / bloc2Items.length) * 100);

  // Bloc 3: Content (word count + density + link profile)
  const wordCountOk = scores.semantic.wordCount >= 500;
  const densityOk = (contentDensity?.ratio ?? 0) >= 15;
  const hasLinks = (linkProfile?.total ?? 0) > 0;
  const bloc3Items = [wordCountOk, densityOk, hasLinks];
  const bloc3Score = Math.round((bloc3Items.filter(Boolean).length / bloc3Items.length) * 100);

  return (
    <div className="space-y-4 mt-6">
      {/* Section Title */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
        <h3 className="text-xl font-bold text-foreground">{t.sectionTitle}</h3>
      </div>

      {/* ═══ BLOC 1: Porte d'Entrée ═══ */}
      <Card className="overflow-hidden border-primary/10">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-primary" />
                {t.bloc1Title}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t.bloc1Desc}</p>
            </div>
            <MiniGauge score={bloc1Score} label={t.health} />
          </div>
        </CardHeader>
        <CardContent className="space-y-0 pt-2">
          <StatusRow icon={<FileCode2 className="h-3.5 w-3.5" />} label={t.robotsTxt} ok={scores.aiReady.hasRobotsTxt} detail={scores.aiReady.robotsPermissive ? t.permissive : scores.aiReady.hasRobotsTxt ? t.restrictive : undefined} />
          <StatusRow icon={<Bot className="h-3.5 w-3.5" />} label={t.aiBots} ok={aiBotsAllowed > 0} detail={`${aiBotsAllowed}/${aiBotsTotal}`} />
          <StatusRow icon={<Lock className="h-3.5 w-3.5" />} label={t.https} ok={scores.security.isHttps} />
          <StatusRow icon={<Shield className="h-3.5 w-3.5" />} label={t.safeBrowsing} ok={scores.security.safeBrowsingOk} />
          
          {(!scores.aiReady.robotsPermissive || aiBotsAllowed < aiBotsTotal) && (
            <p className="text-xs text-warning flex items-start gap-1.5 pt-2 leading-relaxed">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {t.jsWarning}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══ BLOC 2: Langage Sémantique ═══ */}
      <Card className="overflow-hidden border-primary/10">
        <CardHeader className="pb-3 bg-gradient-to-r from-warning/5 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-5 w-5 text-warning" />
                {t.bloc2Title}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t.bloc2Desc}</p>
            </div>
            <MiniGauge score={bloc2Score} label={t.health} />
          </div>
        </CardHeader>
        <CardContent className="space-y-0 pt-2">
          <StatusRow icon={<FileText className="h-3.5 w-3.5" />} label={t.title} ok={scores.semantic.hasTitle && scores.semantic.titleLength <= 70} detail={scores.semantic.hasTitle ? `${scores.semantic.titleLength} ${t.chars}` : undefined} />
          <StatusRow icon={<AlignLeft className="h-3.5 w-3.5" />} label={t.metaDesc} ok={scores.semantic.hasMetaDesc} detail={scores.semantic.hasMetaDesc ? `${scores.semantic.metaDescLength} ${t.chars}` : undefined} />
          <StatusRow icon={<Hash className="h-3.5 w-3.5" />} label={t.h1} ok={scores.semantic.hasUniqueH1} detail={!scores.semantic.hasUniqueH1 ? `${scores.semantic.h1Count}` : undefined} />
          <StatusRow icon={<BarChart3 className="h-3.5 w-3.5" />} label={t.semanticMatch} ok={semanticConsistency ? semanticConsistency.titleH1Similarity >= 30 : null} detail={semanticConsistency ? `${semanticConsistency.titleH1Similarity}%` : undefined} />
          <StatusRow icon={<Code2 className="h-3.5 w-3.5" />} label={t.schemaOrg} ok={scores.aiReady.hasSchemaOrg} detail={scores.aiReady.schemaTypes.length > 0 ? scores.aiReady.schemaTypes.slice(0, 2).join(', ') : undefined} />
          <StatusRow icon={<Code2 className="h-3.5 w-3.5" />} label={t.jsonLd} ok={jsonLd?.valid ?? false} detail={jsonLd ? `${jsonLd.count} script${jsonLd.count > 1 ? 's' : ''}` : undefined} />
          
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-2 leading-relaxed">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
            {t.jsonLdExplain}
          </p>
        </CardContent>
      </Card>

      {/* ═══ BLOC 3: Formatage & Extraction ═══ */}
      <Card className="overflow-hidden border-primary/10">
        <CardHeader className="pb-3 bg-gradient-to-r from-success/5 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-success" />
                {t.bloc3Title}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t.bloc3Desc}</p>
            </div>
            <MiniGauge score={bloc3Score} label={t.health} />
          </div>
        </CardHeader>
        <CardContent className="space-y-0 pt-2">
          <StatusRow icon={<FileText className="h-3.5 w-3.5" />} label={t.wordCount} ok={wordCountOk} detail={`~${scores.semantic.wordCount} ${t.words}`} />
          <StatusRow icon={<BarChart3 className="h-3.5 w-3.5" />} label={t.textRatio} ok={densityOk} detail={contentDensity ? `${contentDensity.ratio}%` : undefined} />
          <StatusRow icon={<Link2 className="h-3.5 w-3.5" />} label={t.linkProfile} ok={hasLinks} detail={linkProfile ? `${linkProfile.internal} ${t.internal} / ${linkProfile.external} ${t.external}` : undefined} />
          
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-2 leading-relaxed">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success" />
            {t.formatExplain}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
