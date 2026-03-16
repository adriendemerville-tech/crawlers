import { useMemo } from 'react';
import { Filter, Sparkles, FileText, Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

// ── Color maps (match CocoonForceGraph3D) ──
const PAGE_TYPE_META: Record<string, { color: string; label: Record<string, string> }> = {
  homepage: { color: '#ffc83c', label: { fr: 'Accueil', en: 'Home', es: 'Inicio' } },
  blog: { color: '#8c78ff', label: { fr: 'Blog', en: 'Blog', es: 'Blog' } },
  produit: { color: '#3cdca0', label: { fr: 'Produit', en: 'Product', es: 'Producto' } },
  'catégorie': { color: '#50aaff', label: { fr: 'Catégorie', en: 'Category', es: 'Categoría' } },
  faq: { color: '#ff9650', label: { fr: 'FAQ', en: 'FAQ', es: 'FAQ' } },
  contact: { color: '#f078b4', label: { fr: 'Contact', en: 'Contact', es: 'Contacto' } },
  tarifs: { color: '#ffc83c', label: { fr: 'Tarifs', en: 'Pricing', es: 'Precios' } },
  guide: { color: '#b48cff', label: { fr: 'Guide', en: 'Guide', es: 'Guía' } },
  'légal': { color: '#a0aab4', label: { fr: 'Légal', en: 'Legal', es: 'Legal' } },
  'à propos': { color: '#50dce6', label: { fr: 'À propos', en: 'About', es: 'Acerca de' } },
  page: { color: '#8c64fa', label: { fr: 'Page', en: 'Page', es: 'Página' } },
  unknown: { color: '#8c64fa', label: { fr: 'Autre', en: 'Other', es: 'Otro' } },
};

const JUICE_TYPE_META: Record<string, { color: string; label: Record<string, string> }> = {
  authority: { color: '#ffc83c', label: { fr: 'Autorité', en: 'Authority', es: 'Autoridad' } },
  semantic: { color: '#508cff', label: { fr: 'Sémantique', en: 'Semantic', es: 'Semántica' } },
  traffic: { color: '#3cdc8c', label: { fr: 'Trafic', en: 'Traffic', es: 'Tráfico' } },
  hierarchy: { color: '#b464ff', label: { fr: 'Hiérarchie', en: 'Hierarchy', es: 'Jerarquía' } },
};

export interface CocoonFilters {
  visiblePageTypes: Set<string>;
  visibleJuiceTypes: Set<string>;
  showAllClusters: boolean;
}

interface CocoonFilterSelectorProps {
  nodes: any[];
  filters: CocoonFilters;
  onFiltersChange: (filters: CocoonFilters) => void;
  language: string;
}

const i18n: Record<string, Record<string, string>> = {
  fr: { title: 'Filtres', pageTypes: 'Types de pages', particles: 'Flux de particules', clusters: 'Afficher tous les clusters' },
  en: { title: 'Filters', pageTypes: 'Page types', particles: 'Particle flows', clusters: 'Show all clusters' },
  es: { title: 'Filtros', pageTypes: 'Tipos de página', particles: 'Flujos de partículas', clusters: 'Mostrar todos los clústeres' },
};

export function CocoonFilterSelector({ nodes, filters, onFiltersChange, language }: CocoonFilterSelectorProps) {
  const t = i18n[language] || i18n.fr;

  // Detect present page types from nodes
  const presentPageTypes = useMemo(() => {
    const types = new Set<string>();
    nodes.forEach((n: any) => {
      const pt = n.page_type || 'unknown';
      types.add(pt);
    });
    return Array.from(types).sort();
  }, [nodes]);

  // Detect present juice types from similarity edges
  const presentJuiceTypes = useMemo(() => {
    const types = new Set<string>();
    // Derive from graph structure (same logic as CocoonForceGraph3D)
    const maxAuth = Math.max(1, ...nodes.map((n: any) => n.page_authority ?? 0));
    const maxTraffic = Math.max(1, ...nodes.map((n: any) => n.traffic_estimate ?? 0));
    const nodeById = new Map(nodes.map((n: any) => [n.id, n]));
    const homeNode = nodes.find((n: any) => n.page_type === 'homepage') 
      || [...nodes].sort((a: any, b: any) => (a.crawl_depth ?? 99) - (b.crawl_depth ?? 99))[0];
    const homeId = homeNode?.id;

    for (const node of nodes) {
      for (const edge of node.similarity_edges || []) {
        const targetNode = nodes.find((n: any) => n.url === edge.target_url);
        if (!targetNode) continue;
        const srcDepth = node.crawl_depth ?? node.depth ?? 0;
        const tgtDepth = targetNode.crawl_depth ?? targetNode.depth ?? 0;
        const depthDelta = Math.abs(srcDepth - tgtDepth);
        const isHomeSrc = node.id === homeId;
        const isHomeTgt = targetNode.id === homeId;
        const avgAuth = ((node.page_authority ?? 0) + (targetNode.page_authority ?? 0)) / 2;
        const avgTraffic = ((node.traffic_estimate ?? 0) + (targetNode.traffic_estimate ?? 0)) / 2;

        let juiceType = 'semantic';
        if (depthDelta >= 1 && (isHomeSrc || isHomeTgt)) juiceType = 'hierarchy';
        else if (avgAuth / maxAuth > 0.5) juiceType = 'authority';
        else if (avgTraffic / maxTraffic > 0.4) juiceType = 'traffic';
        types.add(juiceType);
      }
    }
    return Array.from(types).sort();
  }, [nodes]);

  const togglePageType = (type: string) => {
    const next = new Set(filters.visiblePageTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onFiltersChange({ ...filters, visiblePageTypes: next });
  };

  const toggleJuiceType = (type: string) => {
    const next = new Set(filters.visibleJuiceTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onFiltersChange({ ...filters, visibleJuiceTypes: next });
  };

  const toggleClusters = () => {
    onFiltersChange({ ...filters, showAllClusters: !filters.showAllClusters });
  };

  // Count active filters vs total
  const totalOptions = presentPageTypes.length + presentJuiceTypes.length + 1;
  const activeFilters = filters.visiblePageTypes.size + filters.visibleJuiceTypes.size + (filters.showAllClusters ? 1 : 0);
  const hasInactiveFilters = activeFilters < totalOptions;

  if (nodes.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`relative flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-2.5 rounded-md border text-[10px] sm:text-xs font-medium transition-colors ${
            hasInactiveFilters
              ? 'bg-[#fbbf24]/10 border-[#fbbf24]/30 text-[#fbbf24]'
              : 'bg-white/5 border-[hsl(263,70%,20%)] text-white/60 hover:text-white'
          }`}
        >
          <Filter className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          <span className="hidden sm:inline">{t.title}</span>
          {hasInactiveFilters && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#fbbf24] text-[#0f0a1e] text-[7px] font-bold flex items-center justify-center">
              {totalOptions - activeFilters}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-56 p-0 bg-[#1a1035] border-[hsl(263,70%,20%)] shadow-xl"
      >
        {/* Page Types */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <FileText className="w-3 h-3" />
            {t.pageTypes}
          </p>
          <div className="space-y-1.5">
            {presentPageTypes.map(type => {
              const meta = PAGE_TYPE_META[type] || PAGE_TYPE_META.unknown;
              const label = meta.label[language] || meta.label.fr;
              const checked = filters.visiblePageTypes.has(type);
              const count = nodes.filter((n: any) => (n.page_type || 'unknown') === type).length;
              return (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => togglePageType(type)}
                >
                  <Checkbox
                    checked={checked}
                    className="border-white/20 data-[state=checked]:bg-transparent data-[state=checked]:border-white/40"
                    tabIndex={-1}
                  />
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="text-xs text-white/70 group-hover:text-white transition-colors flex-1">{label}</span>
                  <span className="text-[10px] text-white/30">{count}</span>
                </label>
              );
            })}
          </div>
        </div>

        <Separator className="bg-white/5 my-1" />

        {/* Juice / Particle Types */}
        <div className="px-3 py-1">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3" />
            {t.particles}
          </p>
          <div className="space-y-1.5">
            {presentJuiceTypes.map(type => {
              const meta = JUICE_TYPE_META[type];
              if (!meta) return null;
              const label = meta.label[language] || meta.label.fr;
              const checked = filters.visibleJuiceTypes.has(type);
              return (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => toggleJuiceType(type)}
                >
                  <Checkbox
                    checked={checked}
                    className="border-white/20 data-[state=checked]:bg-transparent data-[state=checked]:border-white/40"
                    tabIndex={-1}
                  />
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="text-xs text-white/70 group-hover:text-white transition-colors">{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <Separator className="bg-white/5 my-1" />

        {/* Show All Clusters */}
        <div className="px-3 py-2 pb-3">
          <label
            className="flex items-center gap-2 cursor-pointer group"
            onClick={toggleClusters}
          >
            <Checkbox
              checked={filters.showAllClusters}
              className="border-white/20 data-[state=checked]:bg-transparent data-[state=checked]:border-white/40"
              tabIndex={-1}
            />
            <Layers className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/70 group-hover:text-white transition-colors">{t.clusters}</span>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
