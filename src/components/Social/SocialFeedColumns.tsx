/**
 * Multi-column feed view (TweetDeck-style) — Shows published posts per platform.
 */
import { memo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Linkedin, Facebook, Instagram, Heart, MessageCircle, Share2, Eye, ExternalLink } from 'lucide-react';
import { fetchPosts, type SocialPost } from '@/lib/api/socialHub';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { SIMULATED_FEED_POSTS } from '@/data/socialSimulatedData';

interface SocialFeedColumnsProps {
  trackedSiteId?: string;
}

const PlatformIcon = ({ platform }: { platform: string }) => {
  if (platform === 'linkedin') return <Linkedin className="h-4 w-4" />;
  if (platform === 'facebook') return <Facebook className="h-4 w-4" />;
  return <Instagram className="h-4 w-4" />;
};

const PostCard = memo(function PostCard({ post, platform, isDemoMode }: { post: SocialPost; platform: string; isDemoMode?: boolean }) {
  const content = platform === 'linkedin' ? post.content_linkedin : platform === 'facebook' ? post.content_facebook : post.content_instagram;
  const [metrics, setMetrics] = useState<any>((post as any).metrics || null);

  useEffect(() => {
    if (isDemoMode || (post as any).metrics) return;
    supabase.from('social_post_metrics' as any).select('*').eq('post_id', post.id).eq('platform', platform).order('measured_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setMetrics(data[0]); });
  }, [post.id, platform, isDemoMode]);

  if (!content) return null;

  return (
    <Card className="border-border mb-2">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-[10px]">
            {post.published_at ? new Date(post.published_at).toLocaleDateString('fr') : 'Brouillon'}
          </Badge>
          <Badge variant={post.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">
            {post.status}
          </Badge>
        </div>
        {post.title && <p className="font-medium text-sm text-foreground mb-1">{post.title}</p>}
        <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">{content}</p>
        {post.image_urls?.length > 0 && (
          <img src={post.image_urls[0]} alt="" className="w-full h-32 object-cover rounded mt-2" />
        )}
        {metrics && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {metrics.impressions}</span>
            <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {metrics.likes}</span>
            <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /> {metrics.comments}</span>
            <span className="flex items-center gap-0.5"><Share2 className="h-3 w-3" /> {metrics.shares}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export const SocialFeedColumns = memo(function SocialFeedColumns({ trackedSiteId }: SocialFeedColumnsProps) {
  const { isDemoMode } = useDemoMode();
  const [posts, setPosts] = useState<SocialPost[]>([]);

  useEffect(() => {
    if (isDemoMode) {
      setPosts(SIMULATED_FEED_POSTS as unknown as SocialPost[]);
      return;
    }
    fetchPosts(trackedSiteId, 'published').then(setPosts).catch(console.error);
  }, [trackedSiteId, isDemoMode]);

  const platforms = ['linkedin', 'facebook', 'instagram'] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {platforms.map(platform => {
        const platformPosts = posts.filter(p => p.publish_platforms?.includes(platform) || (p as any)[`content_${platform}`]);
        return (
          <Card key={platform} className="border-border">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <PlatformIcon platform={platform} />
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
                <Badge variant="secondary" className="text-[10px] ml-auto">{platformPosts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[500px]">
                {platformPosts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Aucun post publié</p>
                ) : (
                  platformPosts.map(post => <PostCard key={post.id} post={post} platform={platform} isDemoMode={isDemoMode} />)
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});
