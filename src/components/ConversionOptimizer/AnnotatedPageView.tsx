import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
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

function priorityColor(priority: string) {
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

function buildAnnotatedSuggestions(suggestions: Suggestion[], annotations: Annotation[]) {
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
        yPosition: annotation?.rect?.y ?? (idx * 200 + 100),
      };
    })
    .sort((a, b) => a.yPosition - b.yPosition);
}

// Resolve overlapping bubbles: push apart vertically while staying close to target Y
function resolveOverlaps(items: { targetY: number }[], bubbleHeight: number, gap: number) {
  const positions: number[] = [];
  for (let i = 0; i < items.length; i++) {
    let y = items[i].targetY;
    if (i > 0) {
      const minY = positions[i - 1] + bubbleHeight + gap;
      y = Math.max(y, minY);
    }
    positions.push(Math.max(8, y));
  }
  return positions;
}

export const AnnotatedPageView = memo(function AnnotatedPageView({
  screenshotUrl,
  screenshotHeight,
  annotations,
  suggestions,
  onSelectSuggestion,
}: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState({ w: 1280, h: screenshotHeight || 3000 });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const annotatedSuggestions = useMemo(
    () => buildAnnotatedSuggestions(suggestions, annotations),
    [suggestions, annotations]
  );

  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageNaturalSize({
        w: imageRef.current.naturalWidth,
        h: imageRef.current.naturalHeight,
      });
    }
    setImageLoaded(true);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      setViewportHeight(scrollRef.current.clientHeight);
    }
  }, [imageLoaded]);

  const scale = imageLoaded && imageRef.current
    ? imageRef.current.clientWidth / imageNaturalSize.w
    : 1;

  // Compute bubble Y positions (aligned with rect center, de-overlapped)
  const BUBBLE_H = 64;
  const BUBBLE_GAP = 8;
  const bubbleTargets = annotatedSuggestions.map(s => ({
    targetY: (s.rect ? s.rect.y + s.rect.height / 2 : s.yPosition) * scale - BUBBLE_H / 2,
  }));
  const bubbleYPositions = resolveOverlaps(bubbleTargets, BUBBLE_H, BUBBLE_GAP);

  // Determine which bubbles are visible based on scroll
  const isVisible = (topPx: number) => {
    const reveal = scrollTop + viewportHeight * 0.85; // reveal when 85% into viewport
    return topPx < reveal;
  };

  return (
    <Card className="overflow-hidden border-border/50">
      <div className="p-3 border-b border-border/50 flex items-center justify-between bg-muted/30">
        <span className="text-sm font-medium text-foreground">Vue annotée</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded-full bg-red-500" /> Critique</span>
          <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded-full bg-orange-500" /> Haute</span>
          <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded-full bg-amber-500" /> Moyenne</span>
          <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded-full bg-emerald-500" /> OK</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative flex overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '500px' }}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        {/* Left column: Annotation bubbles */}
        <div className="w-60 flex-shrink-0 relative" style={{ minHeight: imageLoaded && imageRef.current ? imageRef.current.clientHeight : screenshotHeight * scale }}>
          {annotatedSuggestions.map((s, i) => {
            const colors = priorityColor(s.priority);
            const topPx = bubbleYPositions[i];
            const visible = isVisible(topPx);
            const isHovered = hoveredIdx === i;

            return (
              <div
                key={i}
                className={`absolute left-2 right-2 rounded-lg p-2 cursor-pointer border-2 ${colors.border} ${colors.bg} ${isHovered ? 'shadow-lg z-20' : 'z-10'}`}
                style={{
                  top: `${topPx}px`,
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateX(0)' : 'translateX(-20px)',
                  transition: 'opacity 0.4s ease, transform 0.4s ease',
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onSelectSuggestion?.(s.index)}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${colors.text} border-current`}>
                    {AXIS_LABELS[s.axis] || s.axis}
                  </Badge>
                </div>
                <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-2">{s.title}</p>
                {isHovered && s.current_text && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">« {s.current_text.slice(0, 80)}… »</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Screenshot + overlays + connectors */}
        <div className="flex-1 relative">
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

          {imageLoaded && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 15 }}>
              {annotatedSuggestions.map((s, i) => {
                const colors = priorityColor(s.priority);
                const isHovered = hoveredIdx === i;
                const bubbleTop = bubbleYPositions[i];
                const bubbleCenterY = bubbleTop + BUBBLE_H / 2;
                const visible = isVisible(bubbleTop);

                if (!s.rect) return null;

                const rx = s.rect.x * scale;
                const ry = s.rect.y * scale;
                const rw = s.rect.width * scale;
                const rh = s.rect.height * scale;
                const rectCenterY = ry + rh / 2;

                return (
                  <g key={i} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
                    {/* Highlight frame around element */}
                    <rect
                      x={rx} y={ry} width={rw} height={rh}
                      fill={isHovered ? colors.line + '18' : 'transparent'}
                      stroke={colors.line}
                      strokeWidth={isHovered ? 3 : 2}
                      strokeDasharray={isHovered ? 'none' : '6 3'}
                      rx={4}
                    />
                    {/* Connector line: bubble right edge → rect left edge */}
                    <line
                      x1={0} y1={bubbleCenterY}
                      x2={rx} y2={rectCenterY}
                      stroke={colors.line}
                      strokeWidth={isHovered ? 2 : 1}
                      strokeDasharray="4 3"
                      opacity={isHovered ? 0.9 : 0.4}
                    />
                    {/* Small dot at rect end */}
                    <circle cx={rx} cy={rectCenterY} r={isHovered ? 4 : 3} fill={colors.line} opacity={isHovered ? 0.9 : 0.5} />
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
