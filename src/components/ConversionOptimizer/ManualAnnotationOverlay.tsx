import { useState, useRef, useCallback, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Save, Send } from 'lucide-react';

export interface ManualAnnotation {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  axis: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  comment: string;
}

const AXES = [
  { value: 'tone', label: 'Ton' },
  { value: 'cta_pressure', label: 'CTA' },
  { value: 'alignment', label: 'Alignement' },
  { value: 'readability', label: 'Lisibilité' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'mobile_ux', label: 'Mobile UX' },
  { value: 'keyword_usage', label: 'Mots-clés' },
  { value: 'chunkability', label: 'Chunkability IA' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critique', color: 'bg-red-500' },
  { value: 'high', label: 'Haute', color: 'bg-orange-500' },
  { value: 'medium', label: 'Moyenne', color: 'bg-amber-500' },
  { value: 'low', label: 'Basse', color: 'bg-emerald-500' },
];

interface Props {
  /** Whether drawing mode is active */
  isDrawing: boolean;
  /** Scale factor from natural to displayed image size */
  scale: number;
  /** Offset X of the screenshot within the container (bubble column width) */
  offsetX: number;
  /** Current manual annotations */
  annotations: ManualAnnotation[];
  /** Callback when a new annotation is added */
  onAdd: (annotation: ManualAnnotation) => void;
  /** Callback to remove an annotation */
  onRemove: (id: string) => void;
}

export const ManualAnnotationOverlay = memo(function ManualAnnotationOverlay({
  isDrawing,
  scale,
  offsetX,
  annotations,
  onAdd,
  onRemove,
}: Props) {
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [pendingRect, setPendingRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [formAxis, setFormAxis] = useState('conversion');
  const [formPriority, setFormPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [formComment, setFormComment] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || pendingRect) return;
    e.preventDefault();
    const pos = getRelativePos(e);
    setDrawStart(pos);
    setDrawCurrent(pos);
  }, [isDrawing, pendingRect, getRelativePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawStart || pendingRect) return;
    setDrawCurrent(getRelativePos(e));
  }, [drawStart, pendingRect, getRelativePos]);

  const handleMouseUp = useCallback(() => {
    if (!drawStart || !drawCurrent || pendingRect) return;

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    // Minimum size threshold (20px)
    if (width < 20 || height < 20) {
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    // Convert to natural coordinates (divide by scale)
    setPendingRect({
      x: x / scale,
      y: y / scale,
      width: width / scale,
      height: height / scale,
    });
    setDrawStart(null);
    setDrawCurrent(null);
  }, [drawStart, drawCurrent, pendingRect, scale]);

  const handleConfirm = useCallback(() => {
    if (!pendingRect) return;
    onAdd({
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rect: pendingRect,
      axis: formAxis,
      priority: formPriority,
      comment: formComment,
    });
    setPendingRect(null);
    setFormComment('');
  }, [pendingRect, formAxis, formPriority, formComment, onAdd]);

  const handleCancel = useCallback(() => {
    setPendingRect(null);
    setDrawStart(null);
    setDrawCurrent(null);
    setFormComment('');
  }, []);

  // Draw preview rectangle
  const previewRect = drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    width: Math.abs(drawCurrent.x - drawStart.x),
    height: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 z-30 ${isDrawing && !pendingRect ? 'cursor-crosshair' : ''}`}
      style={{ pointerEvents: isDrawing ? 'auto' : 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Drawing preview */}
      {previewRect && (
        <div
          className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/10 rounded"
          style={{
            left: previewRect.x,
            top: previewRect.y,
            width: previewRect.width,
            height: previewRect.height,
          }}
        />
      )}

      {/* Pending rectangle + form */}
      {pendingRect && (
        <>
          <div
            className="absolute border-2 border-cyan-500 bg-cyan-500/15 rounded animate-pulse"
            style={{
              left: pendingRect.x * scale,
              top: pendingRect.y * scale,
              width: pendingRect.width * scale,
              height: pendingRect.height * scale,
              pointerEvents: 'none',
            }}
          />
          <div
            className="absolute z-50 w-72 rounded-lg border border-border bg-background p-3 shadow-xl space-y-2"
            style={{
              left: Math.min(pendingRect.x * scale + pendingRect.width * scale + 12, (overlayRef.current?.clientWidth || 500) - 300),
              top: pendingRect.y * scale,
              pointerEvents: 'auto',
            }}
          >
            <p className="text-xs font-medium text-foreground">Nouvelle annotation manuelle</p>
            <div className="flex gap-2">
              <Select value={formAxis} onValueChange={setFormAxis}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AXES.map(a => (
                    <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={formPriority} onValueChange={(v) => setFormPriority(v as any)}>
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${p.color}`} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              placeholder="Décrivez le problème observé…"
              className="text-xs min-h-[48px] resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancel}>
                <X className="h-3 w-3 mr-1" /> Annuler
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleConfirm} disabled={!formComment.trim()}>
                <Plus className="h-3 w-3 mr-1" /> Ajouter
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Existing manual annotations - highlight rectangles */}
      {annotations.map((anno) => {
        const colors = {
          critical: { border: 'border-red-400', bg: 'bg-red-400/10' },
          high: { border: 'border-orange-400', bg: 'bg-orange-400/10' },
          medium: { border: 'border-amber-400', bg: 'bg-amber-400/10' },
          low: { border: 'border-emerald-400', bg: 'bg-emerald-400/10' },
        }[anno.priority];

        return (
          <div
            key={anno.id}
            className={`absolute border-2 border-dashed ${colors.border} ${colors.bg} rounded group`}
            style={{
              left: anno.rect.x * scale,
              top: anno.rect.y * scale,
              width: anno.rect.width * scale,
              height: anno.rect.height * scale,
              pointerEvents: isDrawing ? 'auto' : 'none',
            }}
          >
            {isDrawing && (
              <button
                className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onRemove(anno.id); }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
});
