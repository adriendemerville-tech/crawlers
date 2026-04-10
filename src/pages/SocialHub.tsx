/**
 * Social Content Hub — Main page (/app/social)
 * Tabbed interface: Éditeur, Calendrier, Feed, Stats, Plan d'actions
 */
import { memo, useState, useEffect, lazy, Suspense, useCallback } from 'react';
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
  PenTool, CalendarDays, BarChart3, Columns3, Target, Loader2, ArrowLeft, Share2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { supabase } from '@/integrations/supabase/client';
import { SocialPostEditor } from '@/components/Social/SocialPostEditor';
import { SocialPreview } from '@/components/Social/SocialPreview';
import { SocialCalendar } from '@/components/Social/SocialCalendar';
import { SocialStatsDashboard } from '@/components/Social/SocialStatsDashboard';
import { SocialFeedColumns } from '@/components/Social/SocialFeedColumns';
import { SocialActionPlan } from '@/components/Social/SocialActionPlan';
import { createPost, updatePost, publishPost, exportZip, fetchPosts, type SocialPost } from '@/lib/api/socialHub';
import { useNavigate } from 'react-router-dom';

interface TrackedSite {
  id: string;
  domain: string;
  display_name?: string;
}

const SocialHub = memo(function SocialHub() {
  const { user } = useAuth();
  const { isAgencyPro, planType } = useCredits();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('editor');
  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [currentPost, setCurrentPost] = useState<SocialPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<'linkedin' | 'facebook' | 'instagram'>('linkedin');
  const [previewContent, setPreviewContent] = useState('');

  const isPro = isAgencyPro || planType === 'agency_premium';

  // Load tracked sites
  useEffect(() => {
    if (!user) return;
    supabase.from('tracked_sites').select('id, domain, display_name').eq('user_id', user.id).then(({ data }) => {
      const s = (data || []) as TrackedSite[];
      setSites(s);
      if (s.length > 0 && !selectedSiteId) {
        setSelectedSiteId(s[0].id);
        setSelectedDomain(s[0].domain);
      }
    });
  }, [user]);

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    const site = sites.find(s => s.id === siteId);
    setSelectedDomain(site?.domain || '');
  };

  const handleSave = useCallback(async (data: any) => {
    if (!user) return;
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
        toast.success('Brouillon créé');
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }, [user, currentPost, selectedSiteId]);

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
    // Pre-fill will be done via the editor's initial props
  };

  // Pro access gate
  if (!isPro && user) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-8">
          <div className="max-w-lg mx-auto text-center px-4 py-20">
            <Share2 className="h-16 w-16 mx-auto text-primary mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-3">Social Content Hub</h1>
            <p className="text-muted-foreground mb-6">Le Social Content Hub est réservé aux abonnés Pro Agency. Créez, planifiez et publiez du contenu social alimenté par vos données SEO/GEO.</p>
            <div className="flex items-center gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Button>
              <Button onClick={() => navigate('/pro-agency')}>Découvrir Pro Agency</Button>
            </div>
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Share2 className="h-6 w-6 text-primary" /> Social Content Hub
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Créez, planifiez et publiez du contenu social optimisé</p>
            </div>
            <Select value={selectedSiteId} onValueChange={handleSiteChange}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Sélectionner un site..." />
              </SelectTrigger>
              <SelectContent>
                {sites.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.display_name || s.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex-wrap h-auto gap-1">
              <TabsTrigger value="editor" className="gap-1.5"><PenTool className="h-4 w-4" /> Éditeur</TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Calendrier</TabsTrigger>
              <TabsTrigger value="feed" className="gap-1.5"><Columns3 className="h-4 w-4" /> Feed</TabsTrigger>
              <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Stats</TabsTrigger>
              <TabsTrigger value="actions" className="gap-1.5"><Target className="h-4 w-4" /> Plan d'actions</TabsTrigger>
            </TabsList>

            {/* EDITOR TAB */}
            <TabsContent value="editor">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  onSave={handleSave}
                  onPublish={handlePublish}
                  onExport={handleExport}
                  saving={saving}
                />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setPreviewPlatform('linkedin')}>LinkedIn</Badge>
                    <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setPreviewPlatform('facebook')}>Facebook</Badge>
                    <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setPreviewPlatform('instagram')}>Instagram</Badge>
                  </div>
                  <SocialPreview
                    platform={previewPlatform}
                    content={
                      previewPlatform === 'linkedin' ? (currentPost?.content_linkedin || '') :
                      previewPlatform === 'facebook' ? (currentPost?.content_facebook || '') :
                      (currentPost?.content_instagram || '')
                    }
                    hashtags={currentPost?.hashtags}
                    accountName={selectedDomain}
                  />
                </div>
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
          </Tabs>
        </div>
      </main>
      <Footer />
    </>
  );
});

export default SocialHub;
