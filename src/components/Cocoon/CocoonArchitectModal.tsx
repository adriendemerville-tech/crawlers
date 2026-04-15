import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, Rocket, FileText, Brain, Zap, Wrench, Shield, Target, 
  AlertTriangle, CheckCircle2, Loader2, Copy, Check, Code2, Sparkles, Syringe
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';

// ─── Pedagogical fix descriptions ───
interface FixPedagogy {
  goal: string;
  techno: string;
  advantages: string;
  risks: string;
}

const FIX_PEDAGOGY: Record<string, FixPedagogy> = {
  fix_missing_blog: {
    goal: 'Ajouter une section blog/actualités pour capter du trafic longue traîne',
    techno: 'HTML sémantique <article>, Schema.org Article en JSON-LD, balises <time> et <h2>',
    advantages: 'Rich snippets Google, boost du maillage interne, contenu indexable',
    risks: 'Aucun — section ajoutée avant le footer sans toucher au contenu existant',
  },
  fix_semantic_injection: {
    goal: 'Renforcer l\'autorité sémantique avec un bloc expert riche en entités',
    techno: 'Paragraphe HTML avec <strong>, <em>, entités Schema.org, attributs itemprop',
    advantages: 'Meilleure citabilité LLM, densité sémantique accrue, E-E-A-T renforcé',
    risks: 'Vérifier la cohérence avec le contenu existant de la page',
  },
  fix_robot_context: {
    goal: 'Clarifier l\'identité de l\'entité pour les LLMs (anti-hallucination)',
    techno: 'Calque CSS clip-path invisible, meta name="robots-context", JSON-LD Organization',
    advantages: 'Réduit les confusions LLM, améliore le GEO score, zéro impact visuel',
    risks: 'Aucun — contenu invisible pour les utilisateurs, visible uniquement par les crawlers',
  },
  fix_pagespeed_suite: {
    goal: 'Corriger les métriques Core Web Vitals (CLS, LCP, FCP)',
    techno: 'Attributs width/height sur <img>, fetchpriority="high" sur le LCP, font-display: swap',
    advantages: 'Meilleur PageSpeed Score, réduction du CLS, chargement perçu plus rapide',
    risks: 'Aucun si les dimensions d\'images sont correctes',
  },
  fix_title: {
    goal: 'Optimiser la balise <title> pour le SEO et le CTR',
    techno: 'Balise <title> dans le <head>, 50-60 caractères, mot-clé principal en début',
    advantages: 'Meilleur CTR dans les SERP, signal SEO fondamental',
    risks: 'Aucun — remplacement non destructif',
  },
  fix_meta_desc: {
    goal: 'Ajouter une meta description optimisée pour le snippet Google',
    techno: 'Balise <meta name="description">, 150-160 caractères avec CTA',
    advantages: 'Contrôle du snippet affiché, meilleur CTR organique',
    risks: 'Aucun — Google peut choisir un autre extrait',
  },
  fix_h1: {
    goal: 'Corriger la balise H1 pour assurer un titre unique et pertinent',
    techno: 'Balise <h1> unique dans le <body>, hiérarchie H1>H2>H3',
    advantages: 'Signal SEO on-page fort, meilleure compréhension du contenu',
    risks: 'Vérifier qu\'il n\'y a pas de double H1 dans le template',
  },
  fix_jsonld: {
    goal: 'Ajouter des données structurées Schema.org pour les rich snippets',
    techno: 'Script <script type="application/ld+json">, Schema.org WebSite/Organization',
    advantages: 'Rich snippets Google, Knowledge Panel, meilleure citabilité IA',
    risks: 'Aucun — données additionnelles dans le <head>',
  },
  fix_lazy_images: {
    goal: 'Activer le lazy loading pour accélérer le chargement initial',
    techno: 'Attribut loading="lazy" sur les <img> hors viewport',
    advantages: 'Réduction du LCP, économie de bande passante, meilleur PageSpeed',
    risks: 'Ne pas appliquer sur l\'image LCP (above the fold)',
  },
  fix_alt_images: {
    goal: 'Ajouter les attributs alt manquants sur les images',
    techno: 'Attribut alt="" sur chaque <img>, texte descriptif contextuel',
    advantages: 'Accessibilité WCAG, SEO images, indexation Google Images',
    risks: 'Aucun — amélioration pure',
  },
  fix_hallucination: {
    goal: 'Injecter des métadonnées pour corriger les hallucinations IA',
    techno: 'JSON-LD Organization corrigé, meta robots-context, calque anti-confusion',
    advantages: 'Les LLMs citent correctement votre marque, réduit les erreurs factuelles',
    risks: 'Aucun — corrections invisibles pour l\'utilisateur',
  },
  inject_faq: {
    goal: 'Ajouter une section FAQ avec données structurées',
    techno: 'HTML <details>/<summary>, Schema.org FAQPage en JSON-LD',
    advantages: 'Rich snippets FAQ Google, position zéro, réponses IA directes',
    risks: 'Aucun — contenu additionnel en bas de page',
  },
  inject_blog_section: {
    goal: 'Injecter une section éditoriale pour le maillage interne',
    techno: 'HTML <section> avec <article>, Schema.org Article en JSON-LD',
    advantages: 'Maillage vers les pages profondes, boost du crawl budget',
    risks: 'Aucun — injection avant le footer',
  },
  enhance_semantic_meta: {
    goal: 'Enrichir les balises meta Open Graph et Twitter Cards',
    techno: 'Balises <meta property="og:*">, <meta name="twitter:*">, Dublin Core',
    advantages: 'Meilleur affichage sur les réseaux sociaux, partage optimisé',
    risks: 'Aucun — balises additionnelles dans le <head>',
  },
  inject_breadcrumbs: {
    goal: 'Ajouter un fil d\'Ariane avec données structurées',
    techno: 'HTML <nav> avec <ol>, Schema.org BreadcrumbList en JSON-LD',
    advantages: 'Navigation améliorée, rich snippets breadcrumb dans Google',
    risks: 'Vérifier la compatibilité avec le thème CSS existant',
  },
  inject_local_business: {
    goal: 'Ajouter les données LocalBusiness pour le SEO local',
    techno: 'JSON-LD Schema.org LocalBusiness avec adresse, horaires, téléphone',
    advantages: 'Knowledge Panel local, Google Maps, SEO local renforcé',
    risks: 'S\'assurer que les informations sont exactes et à jour',
  },
};

// Fallback pedagogy for dynamic/action-plan fixes
const DEFAULT_PEDAGOGY: FixPedagogy = {
  goal: 'Correction identifiée par l\'audit',
  techno: 'Injection HTML/CSS/JS contextuelle',
  advantages: 'Amélioration SEO ciblée',
  risks: 'Vérifier la compatibilité avec le site',
};

interface FixOption {
  id: string;
  label: string;
  description: string;
  category: string;
  enabled: boolean;
  priority: string;
}

interface CocoonArchitectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  trackedSiteId: string;
  /** Recommendation text used to auto-detect the best fix */
  recommendationText?: string;
  trackedSiteDomainId?: string;
}

// Map recommendation text keywords to fix IDs for pre-selection
function detectFixFromRecommendation(text: string): string | null {
  const lower = text.toLowerCase();
  const KEYWORD_MAP: [string[], string][] = [
    [['hallucination', 'confusion', 'entité', 'llm confond', 'anti-hallucination'], 'fix_robot_context'],
    [['blog', 'actualités', 'éditorial', 'articles'], 'fix_missing_blog'],
    [['sémantique', 'autorité', 'expert', 'info box', 'contenu expert'], 'fix_semantic_injection'],
    [['pagespeed', 'cls', 'lcp', 'core web vitals', 'performance', 'vitesse'], 'fix_pagespeed_suite'],
    [['title', 'titre', '<title>'], 'fix_title'],
    [['meta description', 'meta desc'], 'fix_meta_desc'],
    [['h1', 'heading'], 'fix_h1'],
    [['json-ld', 'schema.org', 'données structurées', 'structured data'], 'fix_jsonld'],
    [['lazy', 'images lentes', 'chargement images'], 'fix_lazy_images'],
    [['alt', 'attribut alt', 'images sans alt'], 'fix_alt_images'],
    [['faq', 'questions fréquentes'], 'inject_faq'],
    [['breadcrumb', 'fil d\'ariane'], 'inject_breadcrumbs'],
    [['local', 'localbusiness', 'seo local'], 'inject_local_business'],
    [['open graph', 'og:', 'twitter card', 'réseaux sociaux'], 'enhance_semantic_meta'],
  ];

  for (const [keywords, fixId] of KEYWORD_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return fixId;
  }
  return null;
}

// Icons per fix
const FIX_ICONS: Record<string, React.ReactNode> = {
  fix_missing_blog: <FileText className="w-4 h-4" />,
  fix_semantic_injection: <Brain className="w-4 h-4" />,
  fix_robot_context: <Shield className="w-4 h-4" />,
  fix_pagespeed_suite: <Zap className="w-4 h-4" />,
  fix_title: <Wrench className="w-4 h-4" />,
  fix_meta_desc: <Wrench className="w-4 h-4" />,
  fix_h1: <Wrench className="w-4 h-4" />,
  fix_jsonld: <Code2 className="w-4 h-4" />,
  fix_lazy_images: <Zap className="w-4 h-4" />,
  fix_alt_images: <Wrench className="w-4 h-4" />,
  fix_hallucination: <Shield className="w-4 h-4" />,
  inject_faq: <Sparkles className="w-4 h-4" />,
  inject_blog_section: <FileText className="w-4 h-4" />,
  enhance_semantic_meta: <Sparkles className="w-4 h-4" />,
  inject_breadcrumbs: <Sparkles className="w-4 h-4" />,
  inject_local_business: <Sparkles className="w-4 h-4" />,
};

// All available fixes for the Cocoon context (no audit data needed)
const COCOON_FIXES: FixOption[] = [
  { id: 'fix_robot_context', label: 'Calque Anti-Hallucination', description: 'Clarifie l\'entité auprès des LLMs', category: 'generative', enabled: false, priority: 'critical' },
  { id: 'fix_missing_blog', label: 'Section Blog Complète', description: 'Injecte une section blog/actualités', category: 'generative', enabled: false, priority: 'important' },
  { id: 'fix_semantic_injection', label: 'Info Box Expert', description: 'Bloc de contenu expert sémantique', category: 'generative', enabled: false, priority: 'important' },
  { id: 'fix_pagespeed_suite', label: 'Suite PageSpeed', description: 'CLS, LCP et Font-Display', category: 'generative', enabled: false, priority: 'critical' },
  { id: 'fix_title', label: 'Balise Title', description: 'Optimise la balise <title>', category: 'seo', enabled: false, priority: 'critical' },
  { id: 'fix_meta_desc', label: 'Meta Description', description: 'Injecte une meta description', category: 'seo', enabled: false, priority: 'critical' },
  { id: 'fix_h1', label: 'Balise H1', description: 'Corrige le H1', category: 'seo', enabled: false, priority: 'critical' },
  { id: 'fix_jsonld', label: 'JSON-LD Schema.org', description: 'Données structurées', category: 'seo', enabled: false, priority: 'important' },
  { id: 'fix_lazy_images', label: 'Lazy Loading', description: 'Lazy loading des images', category: 'performance', enabled: false, priority: 'important' },
  { id: 'fix_alt_images', label: 'Alt Images', description: 'Alt text manquants', category: 'accessibility', enabled: false, priority: 'important' },
  { id: 'inject_faq', label: 'Section FAQ', description: 'FAQ + Schema.org FAQPage', category: 'strategic', enabled: false, priority: 'important' },
  { id: 'inject_blog_section', label: 'Contenu Éditorial', description: 'Blog + Article Schema.org', category: 'strategic', enabled: false, priority: 'important' },
  { id: 'enhance_semantic_meta', label: 'Open Graph & Twitter', description: 'Meta OG + Twitter Cards', category: 'strategic', enabled: false, priority: 'optional' },
  { id: 'inject_breadcrumbs', label: 'Fil d\'Ariane', description: 'Breadcrumb + Schema.org', category: 'strategic', enabled: false, priority: 'optional' },
  { id: 'inject_local_business', label: 'Schema LocalBusiness', description: 'SEO local', category: 'strategic', enabled: false, priority: 'optional' },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  important: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  optional: 'bg-white/5 text-white/40 border-white/10',
};

export function CocoonArchitectModal({ open, onOpenChange, domain, trackedSiteId, recommendationText, trackedSiteDomainId }: CocoonArchitectModalProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [expandedFix, setExpandedFix] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [injected, setInjected] = useState(false);

  // Pre-select fix from recommendation
  const preSelectedFixId = useMemo(() => {
    if (!recommendationText) return null;
    return detectFixFromRecommendation(recommendationText);
  }, [recommendationText]);

  // Initialize fixes with pre-selection
  const [fixes, setFixes] = useState<FixOption[]>(() => {
    return COCOON_FIXES.map(f => ({
      ...f,
      enabled: f.id === preSelectedFixId,
    }));
  });

  // Re-initialize when recommendationText changes (modal reopens with new reco)
  useEffect(() => {
    setGeneratedCode('');
    setCopied(false);
    setInjected(false);
    const detected = recommendationText ? detectFixFromRecommendation(recommendationText) : null;
    setFixes(COCOON_FIXES.map(f => ({
      ...f,
      enabled: f.id === detected,
    })));
    setExpandedFix(detected);
  }, [recommendationText]);

  const toggleFix = (fixId: string) => {
    setFixes(prev => prev.map(f => f.id === fixId ? { ...f, enabled: !f.enabled } : f));
  };

  const enabledCount = fixes.filter(f => f.enabled).length;

  const handleGenerate = async () => {
    if (enabledCount === 0) return;
    setIsGenerating(true);
    setGeneratedCode('');
    try {
      const siteUrl = `https://${domain}`;
      const { data, error } = await supabase.functions.invoke('generate-corrective-code', {
        body: {
          fixes: fixes.filter(f => f.enabled).map(f => ({
            ...f,
            data: { siteName: domain, siteUrl },
          })),
          siteName: domain,
          siteUrl,
          language,
        },
      });
      if (error) throw error;
      if (data?.success && data?.code) {
        setGeneratedCode(data.code);
      } else {
        throw new Error(data?.error || 'Erreur de génération');
      }
    } catch (err) {
      console.error('Architect generation error:', err);
      sonnerToast.error('Erreur lors de la génération du script');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInject = async () => {
    if (!generatedCode || !user || !trackedSiteId) return;
    setIsInjecting(true);
    try {
      const siteId = trackedSiteDomainId || trackedSiteId;
      const { data: existingRule } = await supabase
        .from('site_script_rules')
        .select('id')
        .eq('domain_id', siteId)
        .eq('user_id', user.id)
        .eq('payload_type', 'GLOBAL_FIXES')
        .maybeSingle();

      if (existingRule) {
        await supabase
          .from('site_script_rules')
          .update({ payload_data: { script: generatedCode }, is_active: true } as any)
          .eq('id', existingRule.id);
      } else {
        await supabase
          .from('site_script_rules')
          .insert({
            domain_id: siteId,
            user_id: user.id,
            url_pattern: '*',
            payload_type: 'GLOBAL_FIXES',
            payload_data: { script: generatedCode },
            is_active: true,
            source: 'cocoon_architect',
          } as any);
      }

      setInjected(true);
      sonnerToast.success(
        language === 'en' ? 'Code injected successfully' :
        language === 'es' ? 'Código inyectado con éxito' :
        'Code injecté avec succès'
      );
      setTimeout(() => setInjected(false), 3000);
    } catch (err) {
      console.error('Injection error:', err);
      sonnerToast.error(
        language === 'en' ? 'Injection error' :
        language === 'es' ? 'Error de inyección' :
        'Erreur lors de l\'injection'
      );
    } finally {
      setIsInjecting(false);
    }
  };
  const getPedagogy = (fixId: string): FixPedagogy => FIX_PEDAGOGY[fixId] || DEFAULT_PEDAGOGY;

  const t = {
    title: language === 'en' ? 'Code Architect' : language === 'es' ? 'Code Architect' : 'Code Architect',
    generate: language === 'en' ? 'Generate Script' : language === 'es' ? 'Generar Script' : 'Générer le Script',
    generating: language === 'en' ? 'Generating…' : language === 'es' ? 'Generando…' : 'Génération…',
    copy: language === 'en' ? 'Copy' : language === 'es' ? 'Copiar' : 'Copier',
    copied: language === 'en' ? 'Copied!' : language === 'es' ? '¡Copiado!' : 'Copié !',
    goal: language === 'en' ? 'Goal' : language === 'es' ? 'Objetivo' : 'But visé',
    techno: language === 'en' ? 'Technology' : language === 'es' ? 'Tecnología' : 'Techno',
    advantages: language === 'en' ? 'Advantages' : language === 'es' ? 'Ventajas' : 'Avantages',
    risks: language === 'en' ? 'Risks' : language === 'es' ? 'Riesgos' : 'Risques',
    noFix: language === 'en' ? 'Select at least one fix' : language === 'es' ? 'Selecciona al menos un fix' : 'Sélectionnez au moins un correctif',
    codeReady: language === 'en' ? 'Script ready' : language === 'es' ? 'Script listo' : 'Script prêt',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1035px] h-[80vh] overflow-hidden flex flex-col p-0 gap-0 bg-[#0f0a1e] border-[#a78bfa]/20 text-white">
        {/* Header */}
        <DialogHeader className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-[#a78bfa]" />
            <span className="text-sm font-semibold bg-gradient-to-r from-[#a78bfa] to-[#60a5fa] bg-clip-text text-transparent">
              {t.title}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-white/40 font-mono">{domain}</DialogDescription>
        </DialogHeader>

        {/* Content: 2 columns */}
        <div className="flex-1 overflow-hidden grid grid-cols-2 min-h-0">
          {/* Left: Fix list */}
          <div className="border-r border-white/5 flex flex-col min-h-0">
            <div className="px-4 py-2.5 border-b border-white/5 bg-white/[0.01]">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
                {language === 'en' ? 'Available scripts' : language === 'es' ? 'Scripts disponibles' : 'Scripts disponibles'}
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1.5">
                {fixes.map(fix => {
                  const isExpanded = expandedFix === fix.id;
                  const pedagogy = getPedagogy(fix.id);
                  const isPreSelected = fix.id === preSelectedFixId;

                  return (
                    <div key={fix.id} className={`rounded-xl border overflow-hidden transition-all ${
                      fix.enabled
                        ? 'border-[#a78bfa]/30 bg-[#a78bfa]/[0.06]'
                        : isPreSelected
                          ? 'border-[#60a5fa]/20 bg-[#60a5fa]/[0.03]'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                    }`}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <div className={`shrink-0 p-1 rounded-md ${fix.enabled ? 'bg-[#a78bfa]/20 text-[#a78bfa]' : 'text-white/30'}`}>
                          {FIX_ICONS[fix.id] || <Wrench className="w-4 h-4" />}
                        </div>
                        <button
                          onClick={() => setExpandedFix(isExpanded ? null : fix.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-medium ${fix.enabled ? 'text-white/90' : 'text-white/60'}`}>
                              {fix.label}
                            </span>
                            <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 border ${PRIORITY_COLORS[fix.priority]}`}>
                              {fix.priority === 'critical' ? '!' : fix.priority === 'important' ? '•' : '○'}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-white/30 mt-0.5 truncate">{fix.description}</p>
                        </button>
                        <ChevronDown className={`w-3 h-3 text-white/20 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                        <Switch
                          checked={fix.enabled}
                          onCheckedChange={() => toggleFix(fix.id)}
                          className="data-[state=checked]:bg-[#a78bfa] scale-[0.65] shrink-0"
                        />
                      </div>

                      {/* Pedagogical expandable */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
                              <PedagogyRow icon={<Target className="w-3 h-3 text-emerald-400" />} label={t.goal} value={pedagogy.goal} />
                              <PedagogyRow icon={<Code2 className="w-3 h-3 text-[#60a5fa]" />} label={t.techno} value={pedagogy.techno} />
                              <PedagogyRow icon={<CheckCircle2 className="w-3 h-3 text-[#a78bfa]" />} label={t.advantages} value={pedagogy.advantages} />
                              <PedagogyRow icon={<AlertTriangle className="w-3 h-3 text-amber-400" />} label={t.risks} value={pedagogy.risks} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Generate + Code preview */}
          <div className="flex flex-col min-h-0">
            <div className="p-4 flex flex-col items-center justify-center gap-3 border-b border-white/5">
              <Button
                onClick={handleGenerate}
                disabled={enabledCount === 0 || isGenerating}
                className="w-full bg-gradient-to-r from-[#a78bfa] to-[#60a5fa] hover:from-[#a78bfa]/90 hover:to-[#60a5fa]/90 text-white border-0 gap-2"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t.generating}</>
                ) : (
                  <><Rocket className="w-4 h-4" /> {t.generate} ({enabledCount})</>
                )}
              </Button>
              {enabledCount === 0 && (
                <p className="text-[10px] text-white/30">{t.noFix}</p>
              )}
            </div>

            {/* Code output */}
            <ScrollArea className="flex-1">
              {generatedCode ? (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">{t.codeReady}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        className="h-7 px-2 text-white/50 hover:text-white hover:bg-white/5 gap-1.5"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span className="text-[10px]">{copied ? t.copied : t.copy}</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleInject}
                        disabled={isInjecting || injected}
                        className="h-7 px-3 bg-[#a78bfa] hover:bg-[#a78bfa]/80 text-white gap-1.5"
                      >
                        {isInjecting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : injected ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Syringe className="w-3 h-3" />
                        )}
                        <span className="text-[10px]">
                          {isInjecting
                            ? (language === 'en' ? 'Injecting…' : language === 'es' ? 'Inyectando…' : 'Injection…')
                            : injected
                              ? (language === 'en' ? 'Injected!' : language === 'es' ? '¡Inyectado!' : 'Injecté !')
                              : (language === 'en' ? 'Inject code' : language === 'es' ? 'Inyectar código' : 'Injecter le code')}
                        </span>
                      </Button>
                    </div>
                  </div>
                  <pre
                    tabIndex={0}
                    onKeyDown={e => {
                      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
                        e.stopPropagation();
                      }
                    }}
                    className="text-[10px] leading-relaxed font-mono text-emerald-300/80 bg-black/40 rounded-lg p-3 overflow-x-auto overflow-y-auto whitespace-pre border border-white/5 max-h-[50vh] focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    {generatedCode}
                  </pre>
                </div>
              ) : !isGenerating ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center px-8">
                  <Rocket className="w-10 h-10 text-white/10 mb-3" />
                  <p className="text-xs text-white/20">
                    {language === 'en' 
                      ? 'Select scripts and generate your corrective code'
                      : language === 'es'
                        ? 'Selecciona scripts y genera tu código correctivo'
                        : 'Sélectionnez des scripts et générez votre code correctif'}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center py-16 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#a78bfa]" />
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Small pedagogical row component
function PedagogyRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <span className="text-[9px] uppercase tracking-wider text-white/30 font-medium">{label}</span>
        <p className="text-[10px] text-white/60 leading-snug">{value}</p>
      </div>
    </div>
  );
}
