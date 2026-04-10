import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ImageIcon, PenLine, X } from 'lucide-react';
import { ManualAnnotationOverlay, type ManualAnnotation } from './ManualAnnotationOverlay';

interface Annotation {
  text: string;
  rect: { x: number; y: number; width: number; height: number; tag?: string } | null;
  axis: string;
  priority: string;
  suggestionIndex?: number;
  isImageAnnotation?: boolean;
  imageVerdict?: string;
  imageRecommendation?: string;
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
  manualAnnotations?: ManualAnnotation[];
  onManualAnnotationsChange?: (annotations: ManualAnnotation[]) => void;
  drawingMode?: boolean;
  onDrawingModeChange?: (active: boolean) => void;
}

const AXIS_LABELS: Record<string, string> = {
  tone: 'Ton',
  cta_pressure: 'CTA',
  alignment: 'Alignement',
  readability: 'Lisibilité',
  conversion: 'Conversion',
  mobile_ux: 'Mobile',
  keyword_usage: 'Mots-clés',
  image_quality: 'Image',
};

const BUBBLE_COLUMN_WIDTH = 320;
const BUBBLE_GAP = 14;

function annotationKey(value?: string) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
}

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
      return { border: 'border-border', bg: 'bg-muted/10', text: 'text-muted-foreground', line: '#6b7280' };
  }
}

interface AnnotatedItem {
  axis: string;
  priority: string;
  title: string;
  current_text?: string;
  suggested_text?: string;
  rationale: string;
  index: number;
  rect: { x: number; y: number; width: number; height: number; tag?: string } | null;
  yPosition: number;
  isImageAnnotation?: boolean;
  imageVerdict?: string;
  imageRecommendation?: string;
}

function buildAnnotatedSuggestions(suggestions: Suggestion[], annotations: Annotation[]): AnnotatedItem[] {
  const annotationsByIndex = new Map<number, Annotation>();
  const annotationsByText = new Map<string, Annotation>();

  for (const annotation of annotations) {
    if (typeof annotation.suggestionIndex === 'number' && annotation.rect) {
      annotationsByIndex.set(annotation.suggestionIndex, annotation);
    }
    const key = annotationKey(annotation.text);
    if (annotation.rect && key) {
      annotationsByText.set(key, annotation);
    }
  }

  const items: AnnotatedItem[] = suggestions
    .filter((suggestion) => suggestion.current_text)
    .map((suggestion, index) => {
      const annotation = annotationsByIndex.get(index) ?? annotationsByText.get(annotationKey(suggestion.current_text));
      return {
        ...suggestion,
        index,
        rect: annotation?.rect || null,
        yPosition: annotation?.rect?.y ?? 0,
      };
    });

  const imageAnnotations = annotations.filter(a => a.isImageAnnotation && a.rect);
  for (const imgAnno of imageAnnotations) {
    items.push({
      axis: 'image_quality',
      priority: imgAnno.priority,
      title: imgAnno.imageVerdict || 'Analyse image',
      rationale: imgAnno.imageRecommendation || '',
      current_text: undefined,
      suggested_text: undefined,
      index: imgAnno.suggestionIndex ?? 9000 + items.length,
      rect: imgAnno.rect,
      yPosition: imgAnno.rect?.y ?? 0,
      isImageAnnotation: true,
      imageVerdict: imgAnno.imageVerdict,
      imageRecommendation: imgAnno.imageRecommendation,
    });
  }

  return items.sort((a, b) => a.yPosition - b.yPosition);
}

/**
 * Resolve vertical overlaps by pushing bubbles down when they collide.
 * Each bubble tries to stay as close as possible to targetY (element center).
 */
function resolveOverlaps(items: { targetY: number; height: number }[], gap: number) {
  const positions: number[] = [];

  for (let i = 0; i < items.length; i += 1) {
    let y = items[i].targetY;

    if (i > 0) {
      const minY = positions[i - 1] + items[i - 1].height + gap;
      y = Math.max(y, minY);
    }

    positions.push(Math.max(8, y));
  }

  return positions;
}

/**
 * Measure actual bubble heights from the DOM after render.
 * Falls back to estimation if refs aren't ready.
 */
function estimateBubbleHeight(item: AnnotatedItem): number {
  if (item.isImageAnnotation) {
    const base = 60;
    const recoLen = item.imageRecommendation?.length || 0;
    return base + (recoLen > 0 ? Math.min(50, Math.ceil(recoLen / 38) * 15) : 0);
  }
  let h = 54; // badge + title
  const rationale = item.rationale || '';
  if (rationale.length > 0) h += Math.min(48, Math.ceil(rationale.length / 38) * 14);
  if (item.current_text) h += 18; // hover expansion possibility
  return h;
}

export const AnnotatedPageView = memo(function AnnotatedPageView({
  screenshotUrl,
  screenshotHeight,
  annotations,
  suggestions,
  onSelectSuggestion,
  manualAnnotations = [],
  onManualAnnotationsChange,
  drawingMode = false,
  onDrawingModeChange,
}: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState({ w: 1280, h: screenshotHeight || 3000 });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [measuredHeights, setMeasuredHeights] = useState<number[] | null>(null);

  const annotatedSuggestions = useMemo(
    () => buildAnnotatedSuggestions(suggestions, annotations),
    [suggestions, annotations]
  );

  const positionedSuggestions = useMemo(
    () => annotatedSuggestions.filter((suggestion) => suggestion.rect),
    [annotatedSuggestions]
  );

  const updateViewportHeight = useCallback(() => {
    if (scrollRef.current) {
      setViewportHeight(scrollRef.current.clientHeight);
    }
  }, []);

  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageNaturalSize({
        w: imageRef.current.naturalWidth,
        h: imageRef.current.naturalHeight,
      });
    }
    setImageLoaded(true);
    updateViewportHeight();
  }, [updateViewportHeight]);

  useEffect(() => {
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    return () => window.removeEventListener('resize', updateViewportHeight);
  }, [updateViewportHeight]);

  // Measure real bubble heights after first render
  useEffect(() => {
    if (!imageLoaded || positionedSuggestions.length === 0) return;
    
    const timer = setTimeout(() => {
      const heights: number[] = [];
      for (let i = 0; i < positionedSuggestions.length; i++) {
        const el = bubbleRefs.current.get(i);
        heights.push(el ? el.offsetHeight : estimateBubbleHeight(positionedSuggestions[i]));
      }
      setMeasuredHeights(heights);
    }, 100);

    return () => clearTimeout(timer);
  }, [imageLoaded, positionedSuggestions]);

  const scale = imageLoaded && imageRef.current
    ? imageRef.current.clientWidth / imageNaturalSize.w
    : 1;

  const contentHeight = imageLoaded && imageRef.current
    ? imageRef.current.clientHeight
    : Math.max(500, Math.min(screenshotHeight || 900, 900));

  const bubbleHeights = positionedSuggestions.map((s, i) =>
    measuredHeights?.[i] ?? estimateBubbleHeight(s)
  );

  const bubbleTargets = positionedSuggestions.map((suggestion, i) => {
    const rectCenterY = ((suggestion.rect?.y || 0) + (suggestion.rect?.height || 0) / 2) * scale;
    return {
      targetY: rectCenterY - bubbleHeights[i] / 2,
      height: bubbleHeights[i],
    };
  });

  const bubbleYPositions = resolveOverlaps(bubbleTargets, BUBBLE_GAP);

  const isVisible = (topPx: number) => {
    const revealLine = scrollTop + viewportHeight * 0.85;
    return topPx < revealLine;
  };

  const setBubbleRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      bubbleRefs.current.set(index, el);
    } else {
      bubbleRefs.current.delete(index);
    }
  }, []);

  return (
    <Card className="overflow-hidden border-border/50">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 p-3">
        <span className="text-sm font-medium text-foreground">Vue annotée</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px]"><span className="h-2 w-2 rounded-full bg-red-500" /> Critique</span>
          <span className="flex items-center gap-1 text-[10px]"><span className="h-2 w-2 rounded-full bg-orange-500" /> Haute</span>
          <span className="flex items-center gap-1 text-[10px]"><span className="h-2 w-2 rounded-full bg-amber-500" /> Moyenne</span>
          <span className="flex items-center gap-1 text-[10px]"><span className="h-2 w-2 rounded-full bg-emerald-500" /> OK</span>
          <span className="flex items-center gap-1 text-[10px]"><span className="h-2 w-2 rounded-full bg-violet-500" /> Image</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '500px' }}
        onScroll={(event) => setScrollTop((event.target as HTMLDivElement).scrollTop)}
      >
        <div className="relative flex min-w-full" style={{ minHeight: contentHeight }}>
          {/* SVG overlay: connector lines + element highlight rectangles */}
          {imageLoaded && positionedSuggestions.length > 0 && (
            <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
              {positionedSuggestions.map((suggestion, index) => {
                if (!suggestion.rect) return null;

                const isImage = suggestion.isImageAnnotation;
                const colors = isImage
                  ? { border: 'border-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-500', line: '#8b5cf6' }
                  : priorityColor(suggestion.priority);
                const isHovered = hoveredIdx === index;
                const bubbleTop = bubbleYPositions[index];
                const bHeight = bubbleHeights[index];
                const bubbleCenterY = bubbleTop + bHeight / 2;
                const visible = isVisible(bubbleTop);

                // Element rect in screenshot coordinates (offset by bubble column)
                const rectX = BUBBLE_COLUMN_WIDTH + suggestion.rect.x * scale;
                const rectY = suggestion.rect.y * scale;
                const rectWidth = Math.max(18, suggestion.rect.width * scale);
                const rectHeight = Math.max(18, suggestion.rect.height * scale);
                const rectCenterY = rectY + rectHeight / 2;

                // Straight horizontal connector from bubble to element
                const startX = BUBBLE_COLUMN_WIDTH - 8;
                const endX = rectX;
                // Use the element's Y center for the line
                const lineY = rectCenterY;

                return (
                  <g key={`${suggestion.index}-${suggestion.title}`} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.35s ease' }}>
                    {/* Horizontal line from bubble column edge to element */}
                    <line
                      x1={startX}
                      y1={lineY}
                      x2={endX}
                      y2={lineY}
                      stroke={colors.line}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      opacity={isHovered ? 0.95 : 0.55}
                      strokeLinecap="round"
                    />
                    {/* Element highlight rectangle */}
                    <rect
                      x={rectX}
                      y={rectY}
                      width={rectWidth}
                      height={rectHeight}
                      rx={4}
                      fill={`${colors.line}${isHovered ? '20' : '0d'}`}
                      stroke={colors.line}
                      strokeWidth={isHovered ? 3 : 2}
                      strokeDasharray={isHovered ? 'none' : 'none'}
                    />
                    {/* Anchor dot on element */}
                    <circle cx={endX} cy={rectCenterY} r={isHovered ? 4 : 3} fill={colors.line} opacity={0.9} />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Bubble column */}
          <div className="relative z-20 flex-shrink-0" style={{ width: BUBBLE_COLUMN_WIDTH, minHeight: contentHeight }}>
            {positionedSuggestions.map((suggestion, index) => {
              const isImage = suggestion.isImageAnnotation;
              const colors = isImage
                ? { border: 'border-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-500', line: '#8b5cf6' }
                : priorityColor(suggestion.priority);
              const topPx = bubbleYPositions[index];
              const visible = imageLoaded && isVisible(topPx);
              const isHovered = hoveredIdx === index;

              return (
                <div
                  key={`${suggestion.index}-${suggestion.title}`}
                  ref={(el) => setBubbleRef(index, el)}
                  className={`absolute left-2 right-2 cursor-pointer rounded-lg border-2 p-2.5 ${colors.border} ${colors.bg} ${isHovered ? 'z-30 shadow-lg' : 'z-20'}`}
                  style={{
                    top: `${topPx}px`,
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateX(0)' : 'translateX(-20px)',
                    transition: 'opacity 0.4s ease, transform 0.4s ease',
                  }}
                  onMouseEnter={() => setHoveredIdx(index)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => !isImage && onSelectSuggestion?.(suggestion.index)}
                >
                  <div className="mb-1 flex items-center gap-1">
                    {isImage && <ImageIcon className="h-3 w-3 text-violet-500" />}
                    <Badge variant="outline" className={`border-current px-1 py-0 text-[9px] ${colors.text}`}>
                      {AXIS_LABELS[suggestion.axis] || suggestion.axis}
                    </Badge>
                  </div>
                  {isImage ? (
                    <>
                      <p className="text-[11px] font-medium leading-snug text-foreground">{suggestion.imageVerdict}</p>
                      {suggestion.imageRecommendation && (
                        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{suggestion.imageRecommendation}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-medium leading-snug text-foreground">{suggestion.title}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground line-clamp-3">{suggestion.rationale}</p>
                      {isHovered && suggestion.current_text && (
                        <p className="mt-1 text-[10px] italic text-muted-foreground/70 line-clamp-2">« {suggestion.current_text.slice(0, 100)}… »</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Screenshot */}
          <div className="relative flex-1">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            <img
              ref={imageRef}
              src={screenshotUrl}
              alt="Capture de la page analysée"
              className="block h-auto w-full"
              onLoad={handleImageLoad}
            />

            {imageLoaded && annotatedSuggestions.length > 0 && positionedSuggestions.length === 0 && (
              <div className="absolute inset-x-6 top-6 z-20 rounded-lg border border-border bg-background/92 p-3 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
                Cet audit n'a pas de coordonnées visuelles enregistrées, donc les bulles reliées ne peuvent pas être affichées sur cette capture.
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});
