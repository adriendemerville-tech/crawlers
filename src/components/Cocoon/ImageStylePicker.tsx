import { useState, useEffect, useMemo, useRef } from 'react';
import { Image, Loader2, Sparkles, X, ChevronLeft, ChevronRight, ImagePlus, MousePointerClick, Upload, FolderOpen, Wand2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ImageStyle =
  | 'photo' | 'cinematic' | 'flat' | 'watercolor' | 'isometric'
  | 'sketch' | 'popart' | 'vintage' | 'typography' | 'infographic'
  | 'bw_photo' | 'classic_painting';

interface StyleOption {
  key: ImageStyle;
  label: string;
  emoji: string;
  provider: string;
  suitableFor: string[];
  suitableSectors: string[];
}

const ALL_STYLES: StyleOption[] = [
  { key: 'photo', label: 'Photo réaliste', emoji: '📸', provider: 'imagen3', suitableFor: ['product', 'landing', 'homepage'], suitableSectors: ['ecommerce', 'immobilier', 'tourisme', 'restauration', 'mode'] },
  { key: 'cinematic', label: 'Cinématique', emoji: '🌙', provider: 'imagen3', suitableFor: ['landing', 'homepage', 'article'], suitableSectors: ['luxe', 'mode', 'culture', 'entertainment', 'tourisme'] },
  { key: 'flat', label: 'Illustration flat', emoji: '🎨', provider: 'flux', suitableFor: ['article', 'landing', 'faq'], suitableSectors: ['tech', 'saas', 'startup', 'education', 'finance'] },
  { key: 'watercolor', label: 'Aquarelle', emoji: '🖌️', provider: 'flux', suitableFor: ['article', 'landing'], suitableSectors: ['art', 'bien-etre', 'nature', 'education', 'culture'] },
  { key: 'isometric', label: 'Isométrique 3D', emoji: '🏗️', provider: 'flux', suitableFor: ['landing', 'article', 'product'], suitableSectors: ['tech', 'saas', 'immobilier', 'industrie', 'logistique'] },
  { key: 'sketch', label: 'Croquis', emoji: '✏️', provider: 'flux', suitableFor: ['article', 'faq'], suitableSectors: ['architecture', 'design', 'education', 'artisanat'] },
  { key: 'popart', label: 'Pop Art', emoji: '🌈', provider: 'flux', suitableFor: ['landing', 'article'], suitableSectors: ['culture', 'entertainment', 'mode', 'media'] },
  { key: 'vintage', label: 'Vintage', emoji: '🪵', provider: 'flux', suitableFor: ['article', 'landing'], suitableSectors: ['artisanat', 'restauration', 'culture', 'mode', 'tourisme'] },
  { key: 'typography', label: 'Typographique', emoji: '🔤', provider: 'ideogram', suitableFor: ['landing', 'homepage', 'category'], suitableSectors: ['marketing', 'media', 'education', 'saas'] },
  { key: 'infographic', label: 'Infographie', emoji: '📊', provider: 'ideogram', suitableFor: ['article', 'faq', 'landing'], suitableSectors: ['finance', 'sante', 'tech', 'education', 'b2b'] },
  { key: 'bw_photo', label: 'Noir & Blanc', emoji: '⚫', provider: 'ideogram', suitableFor: ['article', 'landing', 'homepage'], suitableSectors: ['luxe', 'architecture', 'art', 'mode', 'culture'] },
  { key: 'classic_painting', label: 'Peinture classique', emoji: '🖼️', provider: 'ideogram', suitableFor: ['article', 'landing'], suitableSectors: ['art', 'culture', 'tourisme', 'restauration', 'luxe', 'vin'] },
];

const MAX_IMAGES = 2;
const MAX_ITERATIONS = 3;
const MAX_REFS = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export interface GeneratedImageItem {
  dataUri: string;
  style: ImageStyle;
  placement?: 'header' | 'body' | null;
}

export interface ReferenceImage {
  url: string;
  name: string;
  path: string;
}

interface ImageColumnProps {
  pageType: string;
  trackedSiteId?: string;
  targetUrl?: string;
  identityCard?: Record<string, any> | null;
  generatedImages: GeneratedImageItem[];
  iterationsUsed: number;
  onImageGenerated: (dataUri: string, style: ImageStyle) => void;
  onImageRemoved: (index: number) => void;
  onImagePlacement: (index: number, placement: 'header' | 'body') => void;
}

type TabMode = 'generate' | 'library';
type RefMode = 'inspiration' | 'edit';

export function ImageColumn({
  pageType, trackedSiteId, targetUrl, identityCard,
  generatedImages, iterationsUsed,
  onImageGenerated, onImageRemoved, onImagePlacement,
}: ImageColumnProps) {
  const [tab, setTab] = useState<TabMode>('generate');
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [userHistory, setUserHistory] = useState<{ style_key: string; usage_count: number }[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Library state
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedRef, setSelectedRef] = useState<ReferenceImage | null>(null);
  const [refMode, setRefMode] = useState<RefMode>('inspiration');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load references from storage
  useEffect(() => {
    loadReferences();
  }, [trackedSiteId]);

  const loadReferences = async () => {
    setLoadingRefs(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const folder = trackedSiteId ? `${user.id}/${trackedSiteId}` : user.id;
      const { data, error } = await supabase.storage.from('image-references').list(folder, { limit: 50 });
      if (error) throw error;
      const refs: ReferenceImage[] = (data || [])
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(f => {
          const path = `${folder}/${f.name}`;
          const { data: urlData } = supabase.storage.from('image-references').getPublicUrl(path);
          return { url: urlData.publicUrl, name: f.name, path };
        });
      setReferences(refs);
    } catch (e) {
      console.error('[ImageRef] load error:', e);
    } finally {
      setLoadingRefs(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Non connecté'); return; }

    if (references.length + files.length > MAX_REFS) {
      toast.error(`Maximum ${MAX_REFS} images de référence`);
      return;
    }

    setUploading(true);
    const folder = trackedSiteId ? `${user.id}/${trackedSiteId}` : user.id;

    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`Format non supporté: ${file.name}. Utilisez JPG ou PNG.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Fichier trop volumineux: ${file.name} (max 5 Mo)`);
        continue;
      }
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const path = `${folder}/${safeName}`;
      const { error } = await supabase.storage.from('image-references').upload(path, file, { contentType: file.type });
      if (error) {
        toast.error(`Erreur upload: ${file.name}`);
        console.error(error);
      }
    }
    await loadReferences();
    setUploading(false);
    toast.success('Image(s) importée(s)');
  };

  const handleDeleteRef = async (ref: ReferenceImage) => {
    const { error } = await supabase.storage.from('image-references').remove([ref.path]);
    if (error) { toast.error('Erreur suppression'); return; }
    if (selectedRef?.path === ref.path) setSelectedRef(null);
    setReferences(prev => prev.filter(r => r.path !== ref.path));
    toast.success('Image supprimée');
  };

  // Drag & drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  };

  // Load user style history
  useEffect(() => {
    if (!trackedSiteId) return;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const query = supabase
        .from('image_style_preferences' as any)
        .select('style_key, usage_count')
        .eq('user_id', user.id);
      if (targetUrl) {
        query.eq('target_url', targetUrl);
      } else if (trackedSiteId) {
        query.eq('tracked_site_id', trackedSiteId);
      }
      const { data } = await query.order('usage_count', { ascending: false }).limit(5);
      if (data) setUserHistory(data as any[]);
    };
    load();
  }, [trackedSiteId, targetUrl]);

  const suggestedStyles = useMemo(() => {
    const sector = (identityCard?.sector || identityCard?.industry || '').toLowerCase();
    const pt = (pageType || 'article').toLowerCase();
    const scored = ALL_STYLES.map(style => {
      let score = 0;
      if (style.suitableFor.includes(pt)) score += 3;
      if (sector && style.suitableSectors.some(s => sector.includes(s))) score += 2;
      const hist = userHistory.find(h => h.style_key === style.key);
      if (hist) score += Math.min(5, hist.usage_count);
      return { ...style, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);
    if (userHistory.length > 0) {
      const topUsed = userHistory[0];
      if (topUsed && !top3.some(s => s.key === topUsed.style_key)) {
        const found = scored.find(s => s.key === topUsed.style_key);
        if (found) top3[2] = found;
      }
    }
    return top3;
  }, [pageType, identityCard, userHistory]);

  useEffect(() => {
    if (!selectedStyle && suggestedStyles.length > 0) {
      setSelectedStyle(suggestedStyles[0].key);
    }
  }, [suggestedStyles]);

  useEffect(() => {
    if (imagePrompt) return;
    const parts: string[] = [];
    if (identityCard?.brand_name) parts.push(`pour ${identityCard.brand_name}`);
    if (identityCard?.sector) parts.push(`secteur ${identityCard.sector}`);
    if (identityCard?.products?.[0]) parts.push(`produit: ${identityCard.products[0]}`);
    if (identityCard?.target_audience) parts.push(`audience: ${identityCard.target_audience}`);
    if (parts.length > 0) {
      setImagePrompt(`Image illustrative ${parts.join(', ')}`);
    }
  }, [identityCard]);

  const canGenerate = iterationsUsed < MAX_ITERATIONS && generatedImages.length < MAX_IMAGES;

  const handleGenerate = async () => {
    if (!selectedStyle || !imagePrompt || !canGenerate) return;
    setGenerating(true);
    try {
      const body: any = { prompt: imagePrompt, style: selectedStyle };

      // If a reference image is selected, include it
      if (selectedRef) {
        body.referenceImageUrl = selectedRef.url;
        body.referenceMode = refMode; // 'inspiration' or 'edit'
      }

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Upload generated image to storage for persistence
      const { data: { user } } = await supabase.auth.getUser();
      let persistedUrl = data.dataUri;
      if (user) {
        try {
          const base64Match = data.dataUri.match(/^data:(image\/\w+);base64,(.+)$/);
          if (base64Match) {
            const mimeType = base64Match[1];
            const ext = mimeType === 'image/png' ? 'png' : 'jpg';
            const raw = atob(base64Match[2]);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            const blob = new Blob([bytes], { type: mimeType });
            const folder = trackedSiteId ? `${user.id}/${trackedSiteId}/generated` : `${user.id}/generated`;
            const fileName = `${Date.now()}_${selectedStyle}.${ext}`;
            const filePath = `${folder}/${fileName}`;
            const { error: uploadErr } = await supabase.storage.from('image-references').upload(filePath, blob, { contentType: mimeType });
            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('image-references').getPublicUrl(filePath);
              persistedUrl = urlData.publicUrl;
            }
          }
        } catch (e) {
          console.warn('[ImageColumn] Storage upload failed, keeping dataUri:', e);
        }

        await supabase.from('image_style_preferences' as any).upsert(
          {
            user_id: user.id,
            tracked_site_id: trackedSiteId || null,
            target_url: targetUrl || null,
            style_key: selectedStyle,
            usage_count: 1,
            last_used_at: new Date().toISOString(),
          } as any,
          { onConflict: 'user_id,tracked_site_id,target_url,style_key', ignoreDuplicates: false }
        );
      }
      onImageGenerated(persistedUrl, selectedStyle);
      setCarouselIndex(generatedImages.length);
      toast.success('Image générée !');
    } catch (err: any) {
      toast.error(err.message || 'Erreur de génération d\'image');
    } finally {
      setGenerating(false);
    }
  };

  const handleDoubleClick = (index: number) => {
    const img = generatedImages[index];
    if (!img) return;
    if (!img.placement) {
      onImagePlacement(index, 'header');
      toast.success('Image assignée en entête');
    } else if (img.placement === 'header') {
      onImagePlacement(index, 'body');
      toast.success('Image assignée dans le corps');
    } else {
      onImagePlacement(index, 'header');
      toast.success('Image assignée en entête');
    }
  };

  const stylesToShow = showAllStyles ? ALL_STYLES : suggestedStyles;

  return (
    <div className="w-[260px] shrink-0 border-l border-white/10 flex flex-col">
      {/* Header with tabs */}
      <div className="px-1 py-1.5 border-b border-white/10 flex items-center gap-0.5">
        <button
          onClick={() => setTab('generate')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium transition-all ${
            tab === 'generate'
              ? 'bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/30'
              : 'text-white/40 hover:text-white/60 border border-transparent'
          }`}
        >
          <Wand2 className="w-3 h-3" />
          Générer
        </button>
        <button
          onClick={() => setTab('library')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium transition-all ${
            tab === 'library'
              ? 'bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/30'
              : 'text-white/40 hover:text-white/60 border border-transparent'
          }`}
        >
          <FolderOpen className="w-3 h-3" />
          Bibliothèque
          {references.length > 0 && (
            <span className="text-[8px] bg-white/10 rounded-full px-1">{references.length}</span>
          )}
        </button>
      </div>

      {tab === 'generate' ? (
        <>
          {/* Carousel preview */}
          <div className="shrink-0 border-b border-white/10">
            {generatedImages.length > 0 ? (
              <div className="relative">
                <img
                  src={generatedImages[carouselIndex]?.dataUri}
                  alt={`Image ${carouselIndex + 1}`}
                  className="w-full aspect-square object-contain bg-black/30 cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(carouselIndex)}
                  title="Double-clic : assigner en entête ou corps"
                />
                {generatedImages[carouselIndex]?.placement && (
                   <Badge className="absolute top-2 left-2 text-[8px] bg-[#fbbf24]/90 text-[#0f0a1e] border-none">
                    {generatedImages[carouselIndex].placement === 'header' ? 'Entête' : 'Corps'}
                  </Badge>
                )}
                <button
                  onClick={() => {
                    onImageRemoved(carouselIndex);
                    setCarouselIndex(Math.max(0, carouselIndex - 1));
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                  <X className="w-3 h-3 text-white/70" />
                </button>
                {generatedImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setCarouselIndex(i => Math.max(0, i - 1))}
                      disabled={carouselIndex === 0}
                      className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-3 h-3 text-white" />
                    </button>
                    <button
                      onClick={() => setCarouselIndex(i => Math.min(generatedImages.length - 1, i + 1))}
                      disabled={carouselIndex >= generatedImages.length - 1}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-3 h-3 text-white" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {generatedImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCarouselIndex(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${
                            i === carouselIndex ? 'bg-[#fbbf24] scale-125' : 'bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 rounded px-1.5 py-0.5">
                  <MousePointerClick className="w-2.5 h-2.5 text-white/50" />
                  <span className="text-[7px] text-white/40">2×clic = placer</span>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square flex items-center justify-center bg-white/[0.02]">
                <div className="text-center space-y-2">
                  <ImagePlus className="w-8 h-8 text-white/10 mx-auto" />
                  <p className="text-[10px] text-white/20">Aucune image générée</p>
                  <p className="text-[8px] text-white/15">Max {MAX_IMAGES} images · {MAX_ITERATIONS} itérations</p>
                </div>
              </div>
            )}
          </div>

          {/* Selected reference indicator */}
          {selectedRef && (
            <div className="px-3 py-1.5 border-b border-white/10 flex items-center gap-2 bg-[#fbbf24]/5">
              <img src={selectedRef.url} alt="" className="w-6 h-6 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-[8px] text-white/50 truncate">Réf: {selectedRef.name}</p>
                <div className="flex gap-1 mt-0.5">
                  <button
                    onClick={() => setRefMode('inspiration')}
                    className={`text-[7px] px-1 py-0.5 rounded ${refMode === 'inspiration' ? 'bg-[#fbbf24]/20 text-[#fbbf24]' : 'text-white/30'}`}
                  >
                    <Sparkles className="w-2 h-2 inline mr-0.5" />Inspiration
                  </button>
                  <button
                    onClick={() => setRefMode('edit')}
                    className={`text-[7px] px-1 py-0.5 rounded ${refMode === 'edit' ? 'bg-[#fbbf24]/20 text-[#fbbf24]' : 'text-white/30'}`}
                  >
                    <Pencil className="w-2 h-2 inline mr-0.5" />Édition
                  </button>
                </div>
              </div>
              <button onClick={() => setSelectedRef(null)} className="text-white/30 hover:text-white/60">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Params */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/30">
                  {iterationsUsed}/{MAX_ITERATIONS} itér. · {generatedImages.length}/{MAX_IMAGES} img
                </span>
              </div>

              {/* Prompt FIRST */}
              <div className="space-y-1">
                <label className="text-[10px] text-white/50 uppercase tracking-wider">Prompt image</label>
                <Textarea
                  value={imagePrompt}
                  onChange={e => setImagePrompt(e.target.value)}
                  placeholder="Décrivez l'image souhaitée…"
                  rows={3}
                  className="bg-white/5 border-white/10 text-white text-[11px] resize-none"
                />
              </div>

              {/* Styles AFTER prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">Style</label>
                  <button
                    onClick={() => setShowAllStyles(!showAllStyles)}
                    className="text-[9px] text-[#fbbf24]/60 hover:text-[#fbbf24] transition-colors"
                  >
                    {showAllStyles ? '← Suggestions' : 'Tous →'}
                  </button>
                </div>
                {!showAllStyles && (
                  <div className="flex items-center gap-1 mb-0.5">
                    <Sparkles className="w-2.5 h-2.5 text-[#fbbf24]/40" />
                    <span className="text-[8px] text-white/25">Suggérés pour votre contexte</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {stylesToShow.map(style => (
                    <button
                      key={style.key}
                      onClick={() => setSelectedStyle(style.key)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all border ${
                        selectedStyle === style.key
                          ? 'bg-[#fbbf24]/20 border-[#fbbf24]/50 text-[#fbbf24]'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {!canGenerate && (
                <div className="rounded bg-red-500/10 border border-red-500/20 p-2">
                  <p className="text-[9px] text-red-400">
                    {generatedImages.length >= MAX_IMAGES
                      ? `Maximum ${MAX_IMAGES} images atteint. Supprimez-en une pour en générer une nouvelle.`
                      : `Maximum ${MAX_ITERATIONS} itérations atteint pour ce contenu.`}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="shrink-0 p-3 border-t border-white/10">
            <Button
              onClick={handleGenerate}
              disabled={!selectedStyle || !imagePrompt || generating || !canGenerate}
              className="w-full h-8 text-[11px] bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-semibold"
            >
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Génération…</>
              ) : (
                <><Image className="w-3.5 h-3.5 mr-1.5" />
                  {selectedRef ? (refMode === 'edit' ? 'Éditer depuis réf.' : 'Générer (inspiré)') : 'Générer l\'image'}
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        /* ── Library Tab ── */
        <>
          <div
            className="flex-1 flex flex-col"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {/* Upload zone */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || references.length >= MAX_REFS}
                  className="w-full border-2 border-dashed border-white/10 hover:border-[#fbbf24]/30 rounded-lg p-4 flex flex-col items-center gap-2 transition-colors disabled:opacity-40"
                >
                  {uploading ? (
                    <Loader2 className="w-6 h-6 text-[#fbbf24] animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-white/20" />
                  )}
                  <span className="text-[9px] text-white/30">
                    {uploading ? 'Import en cours…' : 'Glissez ou cliquez pour importer'}
                  </span>
                  <span className="text-[8px] text-white/15">JPG, PNG — max 5 Mo — {references.length}/{MAX_REFS}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={e => handleUpload(e.target.files)}
                />

                {/* Reference grid */}
                {loadingRefs ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
                  </div>
                ) : references.length === 0 ? (
                  <p className="text-center text-[9px] text-white/20 py-4">
                    Aucune image importée pour ce site
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {references.map(ref => (
                      <div
                        key={ref.path}
                        className={`relative group rounded overflow-hidden cursor-pointer border-2 transition-all ${
                          selectedRef?.path === ref.path
                            ? 'border-[#fbbf24] ring-1 ring-[#fbbf24]/30'
                            : 'border-transparent hover:border-white/20'
                        }`}
                        onClick={() => {
                          setSelectedRef(selectedRef?.path === ref.path ? null : ref);
                          if (selectedRef?.path !== ref.path) setTab('generate');
                        }}
                      >
                        <img src={ref.url} alt={ref.name} className="w-full aspect-square object-cover" />
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteRef(ref); }}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5 text-white/70" />
                        </button>
                        {selectedRef?.path === ref.path && (
                          <div className="absolute bottom-0 inset-x-0 bg-[#fbbf24]/90 text-[#0f0a1e] text-[7px] text-center py-0.5 font-semibold">
                            ✓ Sélectionnée
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[8px] text-white/20 leading-relaxed">
                  Sélectionnez une image puis passez à l'onglet <strong>Générer</strong> pour l'utiliser comme référence visuelle (inspiration ou édition).
                </p>
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
