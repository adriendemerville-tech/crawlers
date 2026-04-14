import { useMemo } from 'react';
import { Radius } from 'lucide-react';
import { Filter, Sparkles, FileText, Layers, ArrowDown, ArrowUp, ArrowLeftRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { CocoonTheme, DEFAULT_THEME } from '@/hooks/useCocoonTheme';

// ── Label maps ──
const PAGE_TYPE_LABELS: Record<string, Record<string, string>> = {
  homepage: { fr: 'Accueil', en: 'Home', es: 'Inicio' },
  blog: { fr: 'Blog', en: 'Blog', es: 'Blog' },
  produit: { fr: 'Produit', en: 'Product', es: 'Producto' },
  'catégorie': { fr: 'Catégorie', en: 'Category', es: 'Categoría' },
  faq: { fr: 'FAQ', en: 'FAQ', es: 'FAQ' },
  contact: { fr: 'Contact', en: 'Contact', es: 'Contacto' },
  tarifs: { fr: 'Tarifs', en: 'Pricing', es: 'Precios' },
  guide: { fr: 'Guide', en: 'Guide', es: 'Guía' },
  'légal': { fr: 'Légal', en: 'Legal', es: 'Legal' },
  'à propos': { fr: 'À propos', en: 'About', es: 'Acerca de' },
  page: { fr: 'Page', en: 'Page', es: 'Página' },
  unknown: { fr: 'Autre', en: 'Other', es: 'Otro' },
};

const JUICE_TYPE_LABELS: Record<string, Record<string, string>> = {
  authority: { fr: 'Autorité', en: 'Authority', es: 'Autoridad' },
  semantic: { fr: 'Sémantique', en: 'Semantic', es: 'Semántica' },
  traffic: { fr: 'Trafic', en: 'Traffic', es: 'Tráfico' },
  hierarchy: { fr: 'Hiérarchie', en: 'Hierarchy', es: 'Jerarquía' },
};

export interface CocoonFilters {
  visiblePageTypes: Set<string>;
  visibleJuiceTypes: Set<string>;
  visibleLinkDirections: Set<string>;
  showAllClusters: boolean;
  showParticles: boolean;
  showFanBeams: boolean;
}

interface CocoonFilterSelectorProps {
  nodes: any[];
  filters: CocoonFilters;
  onFiltersChange: (filters: CocoonFilters) => void;
  language: string;
  theme?: CocoonTheme;
}

const LINK_DIRECTION_LABELS: Record<string, Record<string, string>> = {
  descending: { fr: 'Liens descendants', en: 'Downstream links', es: 'Enlaces descendentes' },
  ascending: { fr: 'Liens ascendants', en: 'Upstream links', es: 'Enlaces ascendentes' },
  lateral: { fr: 'Liens latéraux', en: 'Lateral links', es: 'Enlaces laterales' },
};

const LINK_DIRECTION_COLORS: Record<string, string> = {
  descending: '#fbbf24',
  ascending: '#60a5fa',
  lateral: '#7864dc',
};

const i18n: Record<string, Record<string, string>> = {
  fr: { title: 'Filtres', pageTypes: 'Types de pages', particles: 'Flux de particules', linkDirections: 'Direction des liens', clusters: 'Afficher tous les clusters', hideParticles: 'Masquer les particules', fanBeams: 'Faisceaux de famille' },
  en: { title: 'Filters', pageTypes: 'Page types', particles: 'Particle flows', linkDirections: 'Link directions', clusters: 'Show all clusters', hideParticles: 'Hide particles', fanBeams: 'Family beams' },
  es: { title: 'Filtros', pageTypes: 'Tipos de página', particles: 'Flujos de partículas', linkDirections: 'Dirección de enlaces', clusters: 'Mostrar todos los clústeres', hideParticles: 'Ocultar partículas', fanBeams: 'Haces de familia' },
};

export function CocoonFilterSelector({ nodes, filters, onFiltersChange, language, theme }: CocoonFilterSelectorProps) {
  const t = i18n[language] || i18n.fr;
  const nodeColors = theme?.nodeColors ?? DEFAULT_THEME.nodeColors;
  const particleColors = theme?.particleColors ?? DEFAULT_THEME.particleColors;

  // Detect present page types from nodes
  const presentPageTypes = useMemo(() => {
    const types = new Set<string>();
    nodes.forEach((n: any) => {
      const pt = n.page_type || 'unknown';
      types.add(pt);
    });
    return Array.from(types).sort();
  }, [nodes]);

  // Detect present juice types from similarity edges (aligned with graph logic)
  const presentJuiceTypes = useMemo(() => {
    const types = new Set<string>();
    const urlToNode = new Map(nodes.map((n: any) => [n.url, n]));
    const maxAuth = Math.max(1, ...nodes.map((n: any) => n.page_authority ?? 0));
    const maxTraffic = Math.max(1, ...nodes.map((n: any) => n.traffic_estimate ?? 0));
    const homeNode = nodes.find((n: any) => n.page_type === 'homepage') 
      || [...nodes].sort((a: any, b: any) => (a.crawl_depth ?? 99) - (b.crawl_depth ?? 99))[0];
    const homeId = homeNode?.id;

    for (const node of nodes) {
      for (const edge of node.similarity_edges || []) {
        const targetNode = urlToNode.get(edge.target_url);
        if (!targetNode || targetNode.id === node.id) continue;
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

  const toggleLinkDirection = (dir: string) => {
    const next = new Set(filters.visibleLinkDirections);
    if (next.has(dir)) next.delete(dir);
    else next.add(dir);
    onFiltersChange({ ...filters, visibleLinkDirections: next });
  };

  const toggleClusters = () => {
    onFiltersChange({ ...filters, showAllClusters: !filters.showAllClusters });
  };

  const toggleParticles = () => {
    if (!filters.showParticles) {
      // Turning particles ON → turn fan beams OFF
      onFiltersChange({ ...filters, showParticles: true, showFanBeams: false });
    } else {
      onFiltersChange({ ...filters, showParticles: false });
    }
  };

  const toggleFanBeams = () => {
    if (!filters.showFanBeams) {
      // Turning fan beams ON → turn particles OFF
      onFiltersChange({ ...filters, showFanBeams: true, showParticles: false });
    } else {
      onFiltersChange({ ...filters, showFanBeams: false });
    }
  };

  // Count active filters vs total
  const totalOptions = presentPageTypes.length + presentJuiceTypes.length + 3 + 2; // 3 link directions + clusters + particles
  const activeFilters = filters.visiblePageTypes.size + filters.visibleJuiceTypes.size + filters.visibleLinkDirections.size + (filters.showAllClusters ? 1 : 0) + (filters.showParticles ? 1 : 0);
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
              const labels = PAGE_TYPE_LABELS[type] || PAGE_TYPE_LABELS.unknown;
              const label = labels[language] || labels.fr;
              const color = nodeColors[type] || nodeColors.unknown || '#7a7a9e';
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
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
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
              const labels = JUICE_TYPE_LABELS[type];
              if (!labels) return null;
              const label = labels[language] || labels.fr;
              const color = particleColors[type] || '#508cff';
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
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-white/70 group-hover:text-white transition-colors">{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <Separator className="bg-white/5 my-1" />

        {/* Link Directions */}
        <div className="px-3 py-1">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <ArrowDown className="w-3 h-3" />
            {t.linkDirections}
          </p>
          <div className="space-y-1.5">
            {(['descending', 'ascending', 'lateral'] as const).map(dir => {
              const labels = LINK_DIRECTION_LABELS[dir];
              const label = labels[language] || labels.fr;
              const color = LINK_DIRECTION_COLORS[dir];
              const checked = filters.visibleLinkDirections.has(dir);
              const DirIcon = dir === 'descending' ? ArrowDown : dir === 'ascending' ? ArrowUp : ArrowLeftRight;
              return (
                <label
                  key={dir}
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => toggleLinkDirection(dir)}
                >
                  <Checkbox
                    checked={checked}
                    className="border-white/20 data-[state=checked]:bg-transparent data-[state=checked]:border-white/40"
                    tabIndex={-1}
                  />
                  <DirIcon className="w-3 h-3 shrink-0" style={{ color }} />
                  <span className="text-xs text-white/70 group-hover:text-white transition-colors">{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <Separator className="bg-white/5 my-1" />

        {/* Show All Clusters */}
        <div className="px-3 py-2 space-y-1.5">
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
          <label
            className="flex items-center gap-2 cursor-pointer group"
            onClick={toggleParticles}
          >
            <Checkbox
              checked={!filters.showParticles}
              className="border-white/20 data-[state=checked]:bg-transparent data-[state=checked]:border-white/40"
              tabIndex={-1}
            />
            <Sparkles className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/70 group-hover:text-white transition-colors">{t.hideParticles}</span>
          </label>
          <label
            className="flex items-center gap-2 cursor-pointer group"
            onClick={toggleFanBeams}
          >
            <Checkbox
              checked={filters.showFanBeams}
              className="border-white/20 data-[state=checked]:bg-transparent data-[state=checked]:border-white/40"
              tabIndex={-1}
            />
            <Radius className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/70 group-hover:text-white transition-colors">{t.fanBeams}</span>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
