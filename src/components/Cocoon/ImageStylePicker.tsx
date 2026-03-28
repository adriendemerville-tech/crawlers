import { useState, useEffect, useMemo } from 'react';
import { Image, Loader2, Sparkles, X } from 'lucide-react';
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

interface ImageColumnProps {
  pageType: string;
  trackedSiteId?: string;
  targetUrl?: string;
  identityCard?: Record<string, any> | null;
  generatedImage: string | null;
  onImageGenerated: (dataUri: string) => void;
  onImageRemoved: () => void;
}

export function ImageColumn({ pageType, trackedSiteId, targetUrl, identityCard, generatedImage, onImageGenerated, onImageRemoved }: ImageColumnProps) {
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [userHistory, setUserHistory] = useState<{ style_key: string; usage_count: number }[]>([]);

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

  // Smart suggestions
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

  // Build default prompt from identity card
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

  const handleGenerate = async () => {
    if (!selectedStyle || !imagePrompt) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt: imagePrompt, style: selectedStyle },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onImageGenerated(data.dataUri);

      // Track preference
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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
      toast.success('Image générée !');
    } catch (err: any) {
      toast.error(err.message || 'Erreur de génération d\'image');
    } finally {
      setGenerating(false);
    }
  };

  const stylesToShow = showAllStyles ? ALL_STYLES : suggestedStyles;

  return (
    <div className="w-[260px] shrink-0 border-l border-white/10 flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <Image className="w-3.5 h-3.5 text-[#fbbf24]" />
        <span className="text-xs font-semibold text-white/80">Image IA</span>
      </div>

      {/* Top: image preview */}
      <div className="shrink-0 border-b border-white/10">
        {generatedImage ? (
          <div className="relative">
            <img src={generatedImage} alt="Image générée" className="w-full aspect-square object-contain bg-black/30" />
            <button
              onClick={onImageRemoved}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            >
              <X className="w-3 h-3 text-white/70" />
            </button>
          </div>
        ) : (
          <div className="w-full aspect-square flex items-center justify-center bg-white/[0.02]">
            <div className="text-center space-y-2">
              <Image className="w-8 h-8 text-white/10 mx-auto" />
              <p className="text-[10px] text-white/20">Aucune image générée</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: params */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Style selector */}
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
                  <span>{style.emoji}</span>
                  <span>{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Provider badge */}
          {selectedStyle && (
            <Badge variant="outline" className="text-[8px] border-white/10 text-white/30">
              {ALL_STYLES.find(s => s.key === selectedStyle)?.provider === 'imagen3' ? '🔵 Imagen 3' :
               ALL_STYLES.find(s => s.key === selectedStyle)?.provider === 'flux' ? '🟣 FLUX' : '🟢 Ideogram'}
            </Badge>
          )}

          {/* Prompt */}
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
        </div>
      </ScrollArea>

      {/* Fixed footer: generate button */}
      <div className="shrink-0 p-3 border-t border-white/10">
        <Button
          onClick={handleGenerate}
          disabled={!selectedStyle || !imagePrompt || generating}
          className="w-full h-8 text-[11px] bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-semibold"
        >
          {generating ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Génération…</>
          ) : (
            <><Image className="w-3.5 h-3.5 mr-1.5" />Générer l'image</>
          )}
        </Button>
      </div>
    </div>
  );
}
