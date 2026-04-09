import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface Annotation {
  text: string;
  rect: { x: number; y: number; width: number; height: number; tag?: string } | null;
  axis: string;
  priority: string;
}

interface Suggestion {
  axis: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  current_text?: string;
  suggested_text?: string;
  rationale: string;
}

interface Props {
  screenshotUrl: string;
  screenshotHeight: number;
  annotations: Annotation[];
  suggestions: Suggestion[];
  onSelectSuggestion?: (index: number) => void;
}

const AXIS_LABELS: Record<string, string> = {
  tone: 'Ton',
  cta_pressure: 'CTA',
  alignment: 'Alignement',
  readability: 'Lisibilité',
  conversion: 'Conversion',
  mobile_ux: 'Mobile',
  keyword_usage: 'Mots-clés',
};

function priorityColor(priority: string): { border: string; bg: string; text: string; line: string } {
  switch (priority) {
    case 'critical':
      return { border: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-500', line: '#ef4444' };
    case 'high':
      return { border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-500', line: '#f97316' };
    case 'medium':
      return { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-500', line: '#f59e0b' };
    case 'low':
      return { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500', line: '#10b981' };
    default:
      return { border: 'border-muted', bg: 'bg-muted/10', text: 'text-muted-foreground', line: '#6b7280' };
  }
}

// Build annotations from suggestions + detected positions
function buildAnnotatedSuggestions(suggestions: Suggestion[], annotations: Annotation[]) {
  // Map annotations by text match
  const annotationMap = new Map<string, Annotation>();
  for (const a of annotations) {
    if (a.rect && a.text) {
      annotationMap.set(a.text.toLowerCase().slice(0, 60), a);
    }
  }

  return suggestions
    .filter(s => s.current_text)
    .map((s, idx) => {
      const key = (s.current_text || '').toLowerCase().slice(0, 60);
      const annotation = annotationMap.get(key);
      return {
        ...s,
        index: idx,
        rect: annotation?.rect || null,
        yPosition: annotation?.rect?.y ?? (idx * 200 + 100), // fallback: distribute evenly
      };
    })
    .sort((a, b) => a.yPosition - b.yPosition);
}

export const AnnotatedPageView = memo(function AnnotatedPageView({
  screenshotUrl,
  screenshotHeight,
  annotations,
  suggestions,
  onSelectSuggestion,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState({ w: 1280, h: screenshotHeight || 3000 });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const annotatedSuggestions = buildAnnotatedSuggestions(suggestions, annotations);

  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageNaturalSize({
        w: imageRef.current.naturalWidth,
        h: imageRef.current.naturalHeight,
      });
    }
    setImageLoaded(true);
  }, []);

  // Calculate scale factor between natural screenshot size and displayed size
  const getScale = useCallback(() => {
    if (!imageRef.current || !imageLoaded) return 1;
    return imageRef.current.clientWidth / imageNaturalSize.w;
  }, [imageLoaded, imageNaturalSize.w]);

  return (
    <Card className="overflow-hidden border-border/50">
      <div className="p-3 border-b border-border/50 flex items-center justify-between bg-muted/30">
        <span className="text-sm font-medium text-foreground">Vue annotée</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Critique
          </span>
          <span className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Haute
          </span>
          <span className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Moyenne
          </span>
          <span className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> OK
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative flex overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '500px' }}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        {/* Left column: Annotation bubbles */}
        <div className="w-64 flex-shrink-0 relative border-r border-border/30 bg-muted/10 p-2 space-y-0">
          {annotatedSuggestions.map((s, i) => {
            const colors = priorityColor(s.priority);
            const scale = getScale();
            // Position bubble at the same Y as the element on the screenshot
            const topPx = s.rect ? s.rect.y * scale : s.yPosition * scale;
            const isHovered = hoveredIdx === i;
            
            return (
              <div
                key={i}
                className={`absolute left-2 right-2 rounded-lg p-2 cursor-pointer transition-all duration-200 border-2 ${colors.border} ${colors.bg} ${isHovered ? 'shadow-lg z-20 scale-[1.02]' : 'z-10'}`}
                style={{ top: `${Math.max(8, topPx - 20)}px` }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onSelectSuggestion?.(s.index)}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${colors.text} border-current`}>
                    {AXIS_LABELS[s.axis] || s.axis}
                  </Badge>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${colors.text} border-current`}>
                    {s.priority}
                  </Badge>
                </div>
                <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-2">{s.title}</p>
                {isHovered && s.current_text && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    « {s.current_text.slice(0, 80)}… »
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Center: Screenshot with overlaid highlight boxes */}
        <div ref={containerRef} className="flex-1 relative">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          <img
            ref={imageRef}
            src={screenshotUrl}
            alt="Capture de la page analysée"
            className="w-full h-auto block"
            onLoad={handleImageLoad}
          />

          {/* Overlay: highlight rectangles on the screenshot */}
          {imageLoaded && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 15 }}
            >
              {annotatedSuggestions.map((s, i) => {
                if (!s.rect) return null;
                const scale = getScale();
                const x = s.rect.x * scale;
                const y = s.rect.y * scale;
                const w = s.rect.width * scale;
                const h = s.rect.height * scale;
                const colors = priorityColor(s.priority);
                const isHovered = hoveredIdx === i;

                return (
                  <g key={i}>
                    {/* Highlight rect */}
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={isHovered ? colors.line + '15' : colors.line + '08'}
                      stroke={colors.line}
                      strokeWidth={isHovered ? 3 : 2}
                      strokeDasharray={isHovered ? 'none' : '6 3'}
                      rx={4}
                      className="transition-all duration-200"
                    />
                    {/* Connection line from left edge to bubble column */}
                    <line
                      x1={0}
                      y1={y + h / 2}
                      x2={x}
                      y2={y + h / 2}
                      stroke={colors.line}
                      strokeWidth={isHovered ? 2 : 1}
                      strokeDasharray="4 4"
                      opacity={isHovered ? 0.8 : 0.3}
                      className="transition-all duration-200"
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </Card>
  );
});
