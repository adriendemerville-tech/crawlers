import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Trash2, Sparkles, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Feature = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  marketing_angle: string;
  target_audience: string | null;
  priority: number;
  is_active: boolean;
  last_used_at: string | null;
  use_count: number;
};

type Post = {
  id: string;
  feature_id: string | null;
  status: string;
  media_type: string;
  generated_text: string;
  edited_text: string | null;
  hashtags: string[];
  media_urls: string[];
  media_generation_status: string;
  media_error: string | null;
  linkedin_post_url: string | null;
  publish_error: string | null;
  created_at: string;
  llm_tokens_used: number | null;
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  pending_review: 'secondary',
  approved: 'default',
  publishing: 'default',
  published: 'default',
  failed: 'destructive',
  expired: 'outline',
  rejected: 'outline',
};

export function LinkedInAutomationDashboard() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>('auto');
  const [mediaType, setMediaType] = useState<'auto' | 'carousel' | 'video' | 'text_only'>('auto');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: feats }, { data: p }] = await Promise.all([
      supabase
        .from('linkedin_features_catalog')
        .select('*')
        .order('priority', { ascending: false }),
      supabase
        .from('linkedin_scheduled_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    setFeatures(feats || []);
    setPosts(p || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-post-generator', {
        body: {
          ...(selectedFeatureId !== 'auto' ? { feature_id: selectedFeatureId } : {}),
          ...(mediaType !== 'auto' ? { media_type: mediaType } : {}),
        },
      });
      if (error) throw error;
      toast.success(`Brouillon créé pour : ${data.feature?.title}`);
      await loadAll();
    } catch (e: any) {
      toast.error(`Échec génération : ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const saveEdited = async (id: string, edited: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from('linkedin_scheduled_posts')
      .update({ edited_text: edited })
      .eq('id', id);
    setSavingId(null);
    if (error) toast.error(error.message);
    else toast.success('Texte enregistré');
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('linkedin_scheduled_posts')
      .update({ status })
      .eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Statut : ${status}`);
      await loadAll();
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Supprimer ce brouillon ?')) return;
    const { error } = await supabase.from('linkedin_scheduled_posts').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Supprimé');
      await loadAll();
    }
  };

  const toggleFeature = async (id: string, is_active: boolean) => {
    const { error } = await supabase
      .from('linkedin_features_catalog')
      .update({ is_active: !is_active })
      .eq('id', id);
    if (error) toast.error(error.message);
    else await loadAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Automatisation LinkedIn</h2>
        <p className="text-muted-foreground">
          Publication hebdomadaire automatisée valorisant les fonctionnalités Crawlers. Sprint 1 : génération de texte uniquement (médias en Sprint 2/3).
        </p>
      </div>

      {/* Générateur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Générer un nouveau brouillon
          </CardTitle>
          <CardDescription>
            Sélectionne une feature (ou laisse la rotation automatique) et le format média cible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Feature</label>
              <Select value={selectedFeatureId} onValueChange={setSelectedFeatureId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Rotation automatique</SelectItem>
                  {features.filter(f => f.is_active).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Format média</label>
              <Select value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Alternance auto (semaine paire/impaire)</SelectItem>
                  <SelectItem value="carousel">Carrousel 6 images</SelectItem>
                  <SelectItem value="video">Vidéo screencast</SelectItem>
                  <SelectItem value="text_only">Texte seul</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="outline" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Générer le brouillon
          </Button>
        </CardContent>
      </Card>

      {/* Posts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Brouillons & posts ({posts.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {posts.length === 0 && (
            <p className="text-muted-foreground text-sm">Aucun brouillon pour le moment.</p>
          )}
          {posts.map((p) => {
            const feature = features.find((f) => f.id === p.feature_id);
            const currentText = p.edited_text ?? p.generated_text;
            return (
              <Card key={p.id} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={statusVariant[p.status] || 'outline'}>{p.status}</Badge>
                      <Badge variant="outline">{p.media_type}</Badge>
                      {feature && <span className="text-sm font-medium">{feature.title}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString('fr-FR')}
                      {p.llm_tokens_used && ` · ${p.llm_tokens_used} tokens`}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    className="min-h-[220px] font-mono text-sm"
                    defaultValue={currentText}
                    onBlur={(e) => {
                      if (e.target.value !== currentText) saveEdited(p.id, e.target.value);
                    }}
                  />
                  {p.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.hashtags.map((h) => (
                        <Badge key={h} variant="outline" className="text-xs">{h}</Badge>
                      ))}
                    </div>
                  )}
                  {p.media_error && (
                    <p className="text-sm text-destructive">Erreur média : {p.media_error}</p>
                  )}
                  {p.publish_error && (
                    <p className="text-sm text-destructive">Erreur publication : {p.publish_error}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {p.status === 'pending_review' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => updateStatus(p.id, 'approved')}>
                          Approuver
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => updateStatus(p.id, 'rejected')}>
                          Rejeter
                        </Button>
                      </>
                    )}
                    {p.status === 'approved' && (
                      <Badge variant="default">
                        Approuvé — publication automatique (Sprint 2/3 requis pour publier)
                      </Badge>
                    )}
                    {p.linkedin_post_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={p.linkedin_post_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" /> Voir sur LinkedIn
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePost(p.id)}
                      disabled={savingId === p.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      {/* Catalogue features */}
      <Card>
        <CardHeader>
          <CardTitle>Catalogue des fonctionnalités ({features.length})</CardTitle>
          <CardDescription>
            La rotation automatique sélectionne d'abord les features actives les moins récemment utilisées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {features.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between border rounded-md px-3 py-2 gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{f.title}</span>
                    <Badge variant="outline" className="text-xs">Priorité {f.priority}</Badge>
                    <Badge variant="outline" className="text-xs">Utilisé {f.use_count}x</Badge>
                    {f.last_used_at && (
                      <span className="text-xs text-muted-foreground">
                        dernière : {new Date(f.last_used_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{f.marketing_angle}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFeature(f.id, f.is_active)}
                >
                  {f.is_active ? 'Actif' : 'Inactif'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
