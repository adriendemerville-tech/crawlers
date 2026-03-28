import { useState, useEffect, useMemo } from 'react';
import { Image, Loader2, Sparkles } from 'lucide-react';
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

interface ImageStylePickerProps {
  pageType: string;
  trackedSiteId?: string;
  targetUrl?: string;
  identityCard?: Record<string, any> | null;
  onGenerate: (style: ImageStyle, prompt: string) => void;
  generating?: boolean;
}

export function ImageStylePicker({ pageType, trackedSiteId, targetUrl, identityCard, onGenerate, generating }: ImageStylePickerProps) {
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [userHistory, setUserHistory] = useState<{ style_key: string; usage_count: number }[]>([]);

  // Load user style history
  useEffect(() => {
    if (!trackedSiteId) return;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const query = supabase
        .from('image_style_preferences')
        .select('style_key, usage_count')
        .eq('user_id', user.id);

      if (targetUrl) {
        query.eq('target_url', targetUrl);
      } else if (trackedSiteId) {
        query.eq('tracked_site_id', trackedSiteId);
      }

      const { data } = await query.order('usage_count', { ascending: false }).limit(5);
      if (data) setUserHistory(data);
    };
    load();
  }, [trackedSiteId, targetUrl]);

  // Smart suggestions: top 3 styles based on context
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

    // Ensure user's most-used style is always suggested
    if (userHistory.length > 0) {
      const topUsed = userHistory[0];
      if (topUsed && !top3.some(s => s.key === topUsed.style_key)) {
        top3[2] = scored.find(s => s.key === topUsed.style_key) || top3[2];
      }
    }

    return top3;
  }, [pageType, identityCard, userHistory]);

  // Auto-select first suggested style
  useEffect(() => {
    if (!selectedStyle && suggestedStyles.length > 0) {
      setSelectedStyle(suggestedStyles[0].key);
    }
  }, [suggestedStyles]);

  // Build default prompt from identity card context
  useEffect(() => {
    if (imagePrompt) return; // Don't overwrite user edits
    const parts: string[] = [];
    if (identityCard?.brand_name) parts.push(`pour ${identityCard.brand_name}`);
    if (identityCard?.sector) parts.push(`secteur ${identityCard.sector}`);
    if (identityCard?.products?.[0]) parts.push(`produit: ${identityCard.products[0]}`);
    if (identityCard?.target_audience) parts.push(`audience: ${identityCard.target_audience}`);
    if (parts.length > 0) {
      setImagePrompt(`Image illustrative ${parts.join(', ')}`);
    }
  }, [identityCard]);

  const stylesToShow = showAllStyles ? ALL_STYLES : suggestedStyles;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1">
          <Image className="w-3 h-3" /> Style d'image
        </label>
        <button
          onClick={() => setShowAllStyles(!showAllStyles)}
          className="text-[10px] text-[#fbbf24]/60 hover:text-[#fbbf24] transition-colors"
        >
          {showAllStyles ? 'Suggestions' : 'Voir tous les styles'}
        </button>
      </div>

      {/* Suggested badge */}
      {!showAllStyles && suggestedStyles.length > 0 && (
        <div className="flex items-center gap-1 mb-1">
          <Sparkles className="w-2.5 h-2.5 text-[#fbbf24]/50" />
          <span className="text-[9px] text-white/30">Suggérés pour votre contexte</span>
        </div>
      )}

      {/* Style chips */}
      <div className={`flex flex-wrap gap-1.5 ${showAllStyles ? 'max-h-32 overflow-y-auto' : ''}`}>
        {stylesToShow.map(style => (
          <button
            key={style.key}
            onClick={() => setSelectedStyle(style.key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all border ${
              selectedStyle === style.key
                ? 'bg-[#fbbf24]/20 border-[#fbbf24]/50 text-[#fbbf24]'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            <span>{style.emoji}</span>
            <span>{style.label}</span>
          </button>
        ))}
      </div>

      {/* Prompt */}
      <Textarea
        value={imagePrompt}
        onChange={e => setImagePrompt(e.target.value)}
        placeholder="Décrivez l'image souhaitée…"
        rows={2}
        className="bg-white/5 border-white/10 text-white text-xs resize-none"
      />

      {/* Provider info */}
      {selectedStyle && (
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-[9px] border-white/10 text-white/30">
            {ALL_STYLES.find(s => s.key === selectedStyle)?.provider === 'imagen3' ? 'Imagen 3' :
             ALL_STYLES.find(s => s.key === selectedStyle)?.provider === 'flux' ? 'FLUX' : 'Ideogram'}
          </Badge>
          <Button
            size="sm"
            onClick={() => selectedStyle && imagePrompt && onGenerate(selectedStyle, imagePrompt)}
            disabled={!selectedStyle || !imagePrompt || generating}
            className="h-7 text-[10px] bg-[#fbbf24]/80 hover:bg-[#fbbf24] text-[#0f0a1e] font-semibold"
          >
            {generating ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" />Génération…</>
            ) : (
              <><Image className="w-3 h-3 mr-1" />Générer l'image</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
