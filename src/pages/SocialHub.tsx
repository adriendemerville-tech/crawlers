/**
 * Social Content Hub — Main page (/app/social)
 * Tabbed interface: Éditeur, Calendrier, Feed, Stats, Plan d'actions
 * 
 * Access: All registered users get 5 free content generations/month.
 * Admins and Pro users have unlimited access.
 */
import { memo, useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  PenTool, CalendarDays, BarChart3, Columns3, Target, Loader2, ArrowLeft, Share2, Crown, Lock, Settings, ImageIcon, Linkedin
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { SocialPostEditor } from '@/components/Social/SocialPostEditor';
import { SocialPreview } from '@/components/Social/SocialPreview';
import { SocialCalendar } from '@/components/Social/SocialCalendar';
import { SocialStatsDashboard } from '@/components/Social/SocialStatsDashboard';
import { SocialFeedColumns } from '@/components/Social/SocialFeedColumns';
import { SocialActionPlan } from '@/components/Social/SocialActionPlan';
import { SocialSettings } from '@/components/Social/SocialSettings';
import { SocialConnectModal } from '@/components/Social/SocialConnectModal';
import { SocialImageLibrary, type LibraryImage } from '@/components/Social/SocialImageLibrary';
import { createPost, updatePost, publishPost, exportZip, fetchPosts, type SocialPost } from '@/lib/api/socialHub';
import { useNavigate } from 'react-router-dom';

const FREE_MONTHLY_LIMIT = 5;

interface TrackedSite {
  id: string;
  domain: string;
  display_name?: string;
}

// ─── Simulated / Demo Data for blurred background ───
const MOCK_POSTS: Partial<SocialPost>[] = [
  { id: 'mock-1', title: '10 astuces SEO pour 2026', status: 'published', content_linkedin: 'Découvrez les 10 meilleures pratiques SEO...', hashtags: ['#SEO', '#Marketing'], publish_platforms: ['linkedin', 'facebook'], created_at: new Date().toISOString() },
  { id: 'mock-2', title: 'Optimiser votre fiche Google Business', status: 'scheduled', content_linkedin: 'Votre fiche Google Business est votre vitrine...', hashtags: ['#GEO', '#Local'], publish_platforms: ['linkedin', 'instagram'], created_at: new Date().toISOString() },
  { id: 'mock-3', title: 'Intelligence artificielle et contenu', status: 'draft', content_linkedin: 'L\'IA transforme la création de contenu...', hashtags: ['#IA', '#Content'], publish_platforms: ['linkedin'], created_at: new Date().toISOString() },
  { id: 'mock-4', title: 'Stratégie de maillage interne', status: 'published', content_linkedin: 'Le maillage interne est un levier puissant...', hashtags: ['#Cocoon', '#SEO'], publish_platforms: ['facebook', 'instagram'], created_at: new Date().toISOString() },
  { id: 'mock-5', title: 'E-E-A-T et crédibilité', status: 'scheduled', content_linkedin: 'Google valorise l\'expertise...', hashtags: ['#EEAT', '#Trust'], publish_platforms: ['linkedin', 'facebook', 'instagram'], created_at: new Date().toISOString() },
];

function BlurredDemoOverlay({ monthlyUsage, onUpgrade, onBack }: { monthlyUsage: number; onUpgrade: () => void; onBack: () => void }) {
  return (
    <div className="relative">
      {/* Blurred simulated content */}
      <div className="filter blur-sm pointer-events-none select-none opacity-60">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {MOCK_POSTS.map((post) => (
            <Card key={post.id} className="border border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={post.status === 'published' ? 'default' : post.status === 'scheduled' ? 'secondary' : 'outline'} className="text-xs">
                    {post.status === 'published' ? '✅ Publié' : post.status === 'scheduled' ? '📅 Planifié' : '📝 Brouillon'}
                  </Badge>
                  <div className="flex gap-1">
                    {post.publish_platforms?.map(p => (
                      <Badge key={p} variant="outline" className="text-[10px] px-1">{p}</Badge>
                    ))}
                  </div>
                </div>
                <h3 className="font-semibold text-sm text-foreground">{post.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{post.content_linkedin}</p>
                <div className="flex flex-wrap gap-1">
                  {post.hashtags?.map(h => (
                    <span key={h} className="text-[10px] text-muted-foreground">{h}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>👁 1.2k</span>
                  <span>❤️ 45</span>
                  <span>💬 12</span>
                  <span>🔄 8</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mock stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
          {[
            { label: 'Posts publiés', value: '24' },
            { label: 'Impressions totales', value: '12.4k' },
            { label: 'Engagement moyen', value: '3.8%' },
            { label: 'Clics vers le site', value: '847' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Overlay message */}
      <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80">
        <div className="text-center max-w-md px-6 py-8 bg-card border border-border rounded-xl shadow-xl">
          <Lock className="h-12 w-12 mx-auto text-emerald-600 dark:text-emerald-400 mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Limite gratuite atteinte</h2>
          <p className="text-muted-foreground mb-1">
            Vous avez utilisé <span className="font-semibold text-foreground">{monthlyUsage}/{FREE_MONTHLY_LIMIT}</span> contenus gratuits ce mois-ci.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Passez au plan Pro Agency pour un accès illimité au Social Content Hub, incluant la publication directe, le Smart Linking et les analytics.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            <Button onClick={onUpgrade} className="gap-1.5">
              <Crown className="h-4 w-4" /> Découvrir Pro Agency
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SocialHub = memo(function SocialHub() {
  const { user } = useAuth();
  useCanonicalHreflang('/app/social');
  const { isAgencyPro, planType } = useCredits();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('editor');
  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [currentPost, setCurrentPost] = useState<SocialPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<'linkedin' | 'facebook' | 'instagram'>('linkedin');
  const [liveContent, setLiveContent] = useState<{ linkedin: string; facebook: string; instagram: string }>({ linkedin: '', facebook: '', instagram: '' });
  const [liveHashtags, setLiveHashtags] = useState<string[]>([]);
  const [monthlyUsage, setMonthlyUsage] = useState<number>(0);
  const [usageLoaded, setUsageLoaded] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | undefined>(undefined);
  const [referenceImages, setReferenceImages] = useState<LibraryImage[]>([]);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const isPro = isAgencyPro || planType === 'agency_premium' || isAdmin;
  const isOverFreeLimit = !isPro && monthlyUsage >= FREE_MONTHLY_LIMIT;

  // Load tracked sites
  useEffect(() => {
    if (!user) return;
    supabase.from('tracked_sites').select('id, domain').eq('user_id', user.id).then(({ data }) => {
      const s = ((data || []) as unknown as TrackedSite[]).map(site => ({ ...site, display_name: site.domain }));
      setSites(s);
      if (s.length > 0 && !selectedSiteId) {
        setSelectedSiteId(s[0].id);
        setSelectedDomain(s[0].domain);
      }
    });
  }, [user]);

  // Load monthly usage count for free users
  useEffect(() => {
    if (!user || isPro) { setUsageLoaded(true); return; }
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('event_type', 'fair_use:social_generate')
      .gte('created_at', monthStart.toISOString())
      .then(({ count }) => {
        setMonthlyUsage(count || 0);
        setUsageLoaded(true);
      });
  }, [user, isPro]);

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    const site = sites.find(s => s.id === siteId);
    setSelectedDomain(site?.domain || '');
  };

  const handleSave = useCallback(async (data: any) => {
    if (!user) return;

    // Check free limit before generating
    if (!isPro && monthlyUsage >= FREE_MONTHLY_LIMIT) {
      toast.error(`Limite gratuite atteinte (${FREE_MONTHLY_LIMIT}/mois). Passez au Pro Agency !`);
      return;
    }

    setSaving(true);
    try {
      if (currentPost) {
        const updated = await updatePost(currentPost.id, data);
        setCurrentPost(updated);
        toast.success('Post sauvegardé');
      } else {
        const created = await createPost({
          ...data,
          user_id: user.id,
          tracked_site_id: selectedSiteId || null,
          status: 'draft',
          publish_platforms: ['linkedin', 'facebook', 'instagram'],
        });
        setCurrentPost(created);
        // Increment usage for free users
        if (!isPro) {
          setMonthlyUsage(prev => prev + 1);
        }
        toast.success('Brouillon créé');
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }, [user, currentPost, selectedSiteId, isPro, monthlyUsage]);

  const handlePublish = async () => {
    if (!currentPost) { toast.error('Sauvegardez d\'abord'); return; }
    try {
      const result = await publishPost(currentPost.id);
      if (result.success) toast.success('Publié avec succès !');
      else toast.error('Erreur de publication');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleExport = async () => {
    if (!currentPost) { toast.error('Sauvegardez d\'abord'); return; }
    try {
      const result = await exportZip([currentPost.id]);
      if (result.zip_base64) {
        const byteChars = atob(result.zip_base64);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArray], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `social_post_${currentPost.id.slice(0, 8)}.zip`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Export téléchargé');
      }
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateFromWorkbench = (item: any) => {
    setCurrentPost(null);
    setActiveTab('editor');
  };

  // Show blurred demo data when free limit is reached
  if (usageLoaded && isOverFreeLimit && user) {
    return (
      <>
        <Helmet>
          <title>Social Content Hub — Crawlers.fr</title>
        </Helmet>
        <Header />
        <main className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Share2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> Social Content Hub
                <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-500">beta</Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Créez, planifiez et publiez du contenu social optimisé</p>
            </div>
            <BlurredDemoOverlay
              monthlyUsage={monthlyUsage}
              onUpgrade={() => navigate('/pro-agency')}
              onBack={() => navigate(-1)}
            />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Social Content Hub — Crawlers.fr</title>
        <meta name="description" content="Créez et publiez du contenu social optimisé SEO/GEO sur LinkedIn, Facebook et Instagram." />
      </Helmet>
      <Header />
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Top bar */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Share2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> Social Content Hub
              <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-500">beta</Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Créez, planifiez et publiez du contenu social optimisé
              {!isPro && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({monthlyUsage}/{FREE_MONTHLY_LIMIT} contenus gratuits ce mois)
                </span>
              )}
            </p>
          </div>

          {/* Tabs + site selector on same line */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="editor" className="gap-1.5"><PenTool className="h-4 w-4" /> Éditeur</TabsTrigger>
                <TabsTrigger value="calendar" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Calendrier</TabsTrigger>
                <TabsTrigger value="feed" className="gap-1.5"><Columns3 className="h-4 w-4" /> Feed</TabsTrigger>
                <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Stats</TabsTrigger>
                <TabsTrigger value="actions" className="gap-1.5"><Target className="h-4 w-4" /> Plan d'actions</TabsTrigger>
                <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-4 w-4" /> Réglages</TabsTrigger>
              </TabsList>
              <Select value={selectedSiteId} onValueChange={handleSiteChange}>
                <SelectTrigger className="w-[220px] shrink-0">
                  <SelectValue placeholder="Sélectionner un site..." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.display_name || s.domain}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setConnectModalOpen(true)} className="gap-1.5 text-xs shrink-0">
                <Linkedin className="h-3.5 w-3.5" /> Connecter
              </Button>
            </div>

            {/* EDITOR TAB */}
            <TabsContent value="editor">
              <div className={`grid gap-6 ${showLibrary ? 'grid-cols-1 lg:grid-cols-[1fr_1fr_280px]' : 'grid-cols-1 lg:grid-cols-2'}`}>
                <SocialPostEditor
                  trackedSiteId={selectedSiteId}
                  domain={selectedDomain}
                  initialContent={currentPost ? {
                    linkedin: currentPost.content_linkedin || '',
                    facebook: currentPost.content_facebook || '',
                    instagram: currentPost.content_instagram || '',
                  } : undefined}
                  initialTitle={currentPost?.title || ''}
                  initialHashtags={currentPost?.hashtags || []}
                  selectedImageUrl={selectedImageUrl}
                  referenceImages={referenceImages}
                  onSave={handleSave}
                  onPublish={handlePublish}
                  onExport={handleExport}
                  saving={saving}
                  onPlatformChange={(p) => setPreviewPlatform(p as 'linkedin' | 'facebook' | 'instagram')}
                  onContentChange={(platform, content, hashtags) => {
                    setLiveContent(prev => ({ ...prev, [platform]: content }));
                    setLiveHashtags(hashtags);
                  }}
                  onToggleLibrary={() => setShowLibrary(prev => !prev)}
                />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={previewPlatform === 'linkedin' ? 'default' : 'outline'} className="text-xs cursor-pointer" onClick={() => setPreviewPlatform('linkedin')}>LinkedIn</Badge>
                    <Badge variant={previewPlatform === 'facebook' ? 'default' : 'outline'} className="text-xs cursor-pointer" onClick={() => setPreviewPlatform('facebook')}>Facebook</Badge>
                    <Badge variant={previewPlatform === 'instagram' ? 'default' : 'outline'} className="text-xs cursor-pointer" onClick={() => setPreviewPlatform('instagram')}>Instagram</Badge>
                  </div>
                  <SocialPreview
                    platform={previewPlatform}
                    content={liveContent[previewPlatform] || (
                      previewPlatform === 'linkedin' ? (currentPost?.content_linkedin || '') :
                      previewPlatform === 'facebook' ? (currentPost?.content_facebook || '') :
                      (currentPost?.content_instagram || '')
                    )}
                    imageUrl={selectedImageUrl}
                    hashtags={liveHashtags.length > 0 ? liveHashtags : currentPost?.hashtags}
                    accountName={selectedDomain}
                  />
                </div>

                {/* Image Library Panel */}
                {showLibrary && (
                  <div className="border border-border rounded-lg overflow-hidden h-[600px]">
                    <SocialImageLibrary
                      trackedSiteId={selectedSiteId}
                      onInsertImage={(url) => setSelectedImageUrl(url)}
                      onUseAsReference={(img) => {
                        setReferenceImages(prev => {
                          const exists = prev.find(r => r.path === img.path);
                          if (exists) return prev.filter(r => r.path !== img.path);
                          return [...prev, img];
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* CALENDAR TAB */}
            <TabsContent value="calendar">
              <SocialCalendar
                trackedSiteId={selectedSiteId}
                onCreatePost={(date) => { setActiveTab('editor'); setCurrentPost(null); }}
              />
            </TabsContent>

            {/* FEED TAB */}
            <TabsContent value="feed">
              <SocialFeedColumns trackedSiteId={selectedSiteId} />
            </TabsContent>

            {/* STATS TAB */}
            <TabsContent value="stats">
              <SocialStatsDashboard trackedSiteId={selectedSiteId} />
            </TabsContent>

            {/* ACTION PLAN TAB */}
            <TabsContent value="actions">
              <SocialActionPlan
                domain={selectedDomain}
                trackedSiteId={selectedSiteId}
                onCreateFromItem={handleCreateFromWorkbench}
              />
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings">
              <SocialSettings
                trackedSiteId={selectedSiteId}
                domain={selectedDomain}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
      <SocialConnectModal open={connectModalOpen} onOpenChange={setConnectModalOpen} trackedSiteId={selectedSiteId} />
    </>
  );
});

export default SocialHub;
