/**
 * Multi-platform preview — Renders visual mockups of posts for LinkedIn, Facebook, Instagram.
 */
import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, MessageCircle, Share2, Bookmark, Heart, Send } from 'lucide-react';

interface SocialPreviewProps {
  platform: 'linkedin' | 'facebook' | 'instagram';
  content: string;
  imageUrl?: string;
  accountName?: string;
  hashtags?: string[];
}

export const SocialPreview = memo(function SocialPreview({ platform, content, imageUrl, accountName, hashtags }: SocialPreviewProps) {
  const name = accountName || 'Votre Page';
  const hashtagStr = hashtags?.length ? '\n\n' + hashtags.map(h => `#${h}`).join(' ') : '';
  const displayContent = content + (platform === 'instagram' ? hashtagStr : '');

  if (platform === 'linkedin') {
    return (
      <Card className="max-w-[500px] mx-auto border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-lg">{name[0]}</div>
              <div>
                <p className="font-semibold text-sm text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">À l'instant · 🌐</p>
              </div>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{displayContent || 'Votre contenu LinkedIn apparaîtra ici...'}</p>
          </div>
          {imageUrl && <img src={imageUrl} alt="Post" className="w-full h-64 object-cover" />}
          <div className="px-4 py-2 border-t border-border flex items-center justify-between text-muted-foreground">
            <button className="flex items-center gap-1 text-xs hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"><ThumbsUp className="h-4 w-4" /> J'aime</button>
            <button className="flex items-center gap-1 text-xs hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"><MessageCircle className="h-4 w-4" /> Commenter</button>
            <button className="flex items-center gap-1 text-xs hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"><Share2 className="h-4 w-4" /> Partager</button>
            <button className="flex items-center gap-1 text-xs hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"><Send className="h-4 w-4" /> Envoyer</button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (platform === 'facebook') {
    return (
      <Card className="max-w-[500px] mx-auto border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold">{name[0]}</div>
              <div>
                <p className="font-semibold text-sm text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">À l'instant · 🌐</p>
              </div>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{displayContent || 'Votre contenu Facebook apparaîtra ici...'}</p>
          </div>
          {imageUrl && <img src={imageUrl} alt="Post" className="w-full h-64 object-cover" />}
          <div className="px-4 py-2 border-t border-border flex items-center justify-between text-muted-foreground">
            <button className="flex items-center gap-1 text-xs"><ThumbsUp className="h-4 w-4" /> J'aime</button>
            <button className="flex items-center gap-1 text-xs"><MessageCircle className="h-4 w-4" /> Commenter</button>
            <button className="flex items-center gap-1 text-xs"><Share2 className="h-4 w-4" /> Partager</button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Instagram
  return (
    <Card className="max-w-[400px] mx-auto border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="p-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-xs font-bold text-foreground">{name[0]}</div>
          </div>
          <p className="font-semibold text-xs text-foreground">{name}</p>
        </div>
        <div className={`w-full aspect-square flex items-center justify-center ${imageUrl ? '' : 'bg-muted'}`}>
          {imageUrl ? <img src={imageUrl} alt="Post" className="w-full h-full object-cover" /> : <span className="text-muted-foreground text-sm">1080 × 1080</span>}
        </div>
        <div className="p-3 flex items-center gap-4 text-foreground">
          <Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><Send className="h-5 w-5" />
          <Bookmark className="h-5 w-5 ml-auto" />
        </div>
        <div className="px-3 pb-3">
          <p className="text-xs"><strong>{name}</strong> <span className="text-foreground whitespace-pre-wrap">{displayContent?.slice(0, 200) || 'Votre caption Instagram...'}</span></p>
        </div>
      </CardContent>
    </Card>
  );
});
