import { useState } from 'react';
import { Wand2, Loader2, Link2, ExternalLink, CheckCircle2, ChevronDown, ChevronUp, Zap, Target, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface LinkSuggestion {
  source_url: string;
  target_url: string;
  target_title: string;
  anchor_text: string;
  context_sentence: string;
  confidence: number;
  pre_scan_match: boolean;
}

interface GroupedResult {
  source_url: string;
  links_found: number;
  suggestions: LinkSuggestion[];
}

interface BulkStats {
  pages_analyzed: number;
  total_suggestions: number;
  pre_scan_matches: number;
  ai_generated: number;
  avg_confidence: number;
}

const i18n = {
  fr: {
    title: 'Auto-Maillage Rétroactif',
    subtitle: 'Scanne toutes vos pages existantes et injecte des liens internes manquants',
    launch: 'Lancer l\'analyse',
    running: 'Analyse en cours…',
    maxPages: 'Pages à analyser',
    maxLinksPerPage: 'Liens max par page',
    minConfidence: 'Confiance minimale',
    stats: 'Résultats',
    pagesAnalyzed: 'Pages analysées',
    totalSuggestions: 'Liens trouvés',
    preScan: 'Pré-scan (titre)',
    aiGenerated: 'IA (sémantique)',
    avgConfidence: 'Confiance moy.',
    source: 'Page source',
    anchor: 'Ancre',
    target: 'Cible',
    confidence: 'Confiance',
    preScanBadge: 'Titre',
    aiBadge: 'IA',
    noResults: 'Aucune opportunité trouvée. Votre maillage est déjà bien construit !',
    deploy: 'Déployer via CMS',
    saved: 'Suggestions sauvegardées dans Cocoon pour validation.',
    error: 'Erreur lors de l\'analyse',
  },
  en: {
    title: 'Retroactive Auto-Linking',
    subtitle: 'Scans all existing pages and finds missing internal link opportunities',
    launch: 'Launch analysis',
    running: 'Analyzing…',
    maxPages: 'Pages to analyze',
    maxLinksPerPage: 'Max links per page',
    minConfidence: 'Minimum confidence',
    stats: 'Results',
    pagesAnalyzed: 'Pages analyzed',
    totalSuggestions: 'Links found',
    preScan: 'Pre-scan (title)',
    aiGenerated: 'AI (semantic)',
    avgConfidence: 'Avg confidence',
    source: 'Source page',
    anchor: 'Anchor',
    target: 'Target',
    confidence: 'Confidence',
    preScanBadge: 'Title',
    aiBadge: 'AI',
    noResults: 'No opportunities found. Your internal linking is already well built!',
    deploy: 'Deploy via CMS',
    saved: 'Suggestions saved in Cocoon for review.',
    error: 'Error during analysis',
  },
  es: {
    title: 'Auto-Enlace Retroactivo',
    subtitle: 'Escanea todas las páginas existentes y encuentra oportunidades de enlace interno',
    launch: 'Iniciar análisis',
    running: 'Analizando…',
    maxPages: 'Páginas a analizar',
    maxLinksPerPage: 'Enlaces máx por página',
    minConfidence: 'Confianza mínima',
    stats: 'Resultados',
    pagesAnalyzed: 'Páginas analizadas',
    totalSuggestions: 'Enlaces encontrados',
    preScan: 'Pre-scan (título)',
    aiGenerated: 'IA (semántico)',
    avgConfidence: 'Confianza prom.',
    source: 'Página fuente',
    anchor: 'Ancla',
    target: 'Destino',
    confidence: 'Confianza',
    preScanBadge: 'Título',
    aiBadge: 'IA',
    noResults: '¡No se encontraron oportunidades. Su enlazado interno ya está bien construido!',
    deploy: 'Desplegar vía CMS',
    saved: 'Sugerencias guardadas en Cocoon para revisión.',
    error: 'Error durante el análisis',
  },
};

interface CocoonBulkAutoLinkingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedSiteId: string;
}

export function CocoonBulkAutoLinking({ open, onOpenChange, trackedSiteId }: CocoonBulkAutoLinkingProps) {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;

  const [isRunning, setIsRunning] = useState(false);
  const [maxPages, setMaxPages] = useState(30);
  const [maxLinksPerPage, setMaxLinksPerPage] = useState(3);
  const [minConfidence, setMinConfidence] = useState(0.6);
  const [stats, setStats] = useState<BulkStats | null>(null);
  const [results, setResults] = useState<GroupedResult[]>([]);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const handleLaunch = async () => {
    setIsRunning(true);
    setStats(null);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('cocoon-bulk-auto-linking', {
        body: {
          tracked_site_id: trackedSiteId,
          max_pages: maxPages,
          max_links_per_page: maxLinksPerPage,
          min_confidence: minConfidence,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setStats(data.stats);
      setResults(data.results || []);

      if (data.stats.total_suggestions > 0) {
        toast.success(`${data.stats.total_suggestions} liens trouvés sur ${data.stats.pages_analyzed} pages`);
      } else {
        toast.info(t.noResults);
      }
    } catch (err: any) {
      console.error('Bulk auto-linking error:', err);
      toast.error(t.error);
    } finally {
      setIsRunning(false);
    }
  };

  const shortenUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.pathname.length > 40 ? u.pathname.slice(0, 37) + '…' : u.pathname;
    } catch { return url.slice(0, 40); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0d0d14] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="w-5 h-5 text-amber-400" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {t.subtitle}
          </DialogDescription>
        </DialogHeader>

        {/* Configuration */}
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">{t.maxPages}</label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[maxPages]}
                  onValueChange={([v]) => setMaxPages(v)}
                  min={5} max={100} step={5}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-8 text-right">{maxPages}</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">{t.maxLinksPerPage}</label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[maxLinksPerPage]}
                  onValueChange={([v]) => setMaxLinksPerPage(v)}
                  min={1} max={5} step={1}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-8 text-right">{maxLinksPerPage}</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">{t.minConfidence}</label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[minConfidence * 100]}
                  onValueChange={([v]) => setMinConfidence(v / 100)}
                  min={40} max={95} step={5}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-8 text-right">{Math.round(minConfidence * 100)}%</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleLaunch}
            disabled={isRunning}
            className="w-full gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.running}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {t.launch}
              </>
            )}
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-5 gap-2 mt-4">
            {[
              { label: t.pagesAnalyzed, value: stats.pages_analyzed, icon: Target },
              { label: t.totalSuggestions, value: stats.total_suggestions, icon: Link2 },
              { label: t.preScan, value: stats.pre_scan_matches, icon: CheckCircle2 },
              { label: t.aiGenerated, value: stats.ai_generated, icon: Wand2 },
              { label: t.avgConfidence, value: `${Math.round(stats.avg_confidence * 100)}%`, icon: BarChart3 },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
                <Icon className="w-4 h-4 mx-auto mb-1 text-amber-400/70" />
                <div className="text-lg font-bold">{value}</div>
                <div className="text-[10px] text-white/40">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map((group) => (
              <div key={group.source_url} className="bg-white/5 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedSource(expandedSource === group.source_url ? null : group.source_url)}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Link2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-sm truncate font-mono">{shortenUrl(group.source_url)}</span>
                    <Badge variant="outline" className="text-[10px] border-amber-400/30 text-amber-400 shrink-0">
                      {group.links_found} liens
                    </Badge>
                  </div>
                  {expandedSource === group.source_url ? (
                    <ChevronUp className="w-4 h-4 text-white/40 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                  )}
                </button>

                {expandedSource === group.source_url && (
                  <div className="px-3 pb-3 space-y-2">
                    {group.suggestions.map((s, i) => (
                      <div key={i} className="bg-black/30 rounded-md p-2.5 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`text-[9px] ${s.pre_scan_match
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/30'
                              : 'bg-purple-500/20 text-purple-400 border-purple-400/30'
                            }`}
                            variant="outline"
                          >
                            {s.pre_scan_match ? t.preScanBadge : t.aiBadge}
                          </Badge>
                          <span className="text-xs text-white/60">{t.confidence}: {Math.round(s.confidence * 100)}%</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-white/50">{t.anchor}: </span>
                          <span className="text-amber-300 font-medium">"{s.anchor_text}"</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-white/40">
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate">{shortenUrl(s.target_url)}</span>
                          <span className="text-white/20">·</span>
                          <span className="truncate">{s.target_title}</span>
                        </div>
                        {s.context_sentence && (
                          <div className="text-[11px] text-white/30 italic truncate">
                            {s.context_sentence}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {stats && stats.total_suggestions === 0 && (
          <div className="text-center py-8 text-white/40 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/50" />
            {t.noResults}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
